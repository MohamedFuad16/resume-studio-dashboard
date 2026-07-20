import Foundation
import OSLog

/// One-shot data repairs that must run on a real device, exactly once each.
///
/// This replaces the `#if DEBUG` + "bump a tag string" scaffolding that used to
/// live in `RootView.applyLaunchHooks`. Two things were wrong with that shape.
/// The compile-time gate meant a repair could only ever reach a Debug build, so
/// the moment the app ships Release the data stays broken with no way to fix it
/// short of a new feature. And a single shared tag key meant migrations
/// overwrote each other: running the second one marked the first as done.
///
/// The contract here is deliberately narrow:
///
/// - Each migration has a stable `id`. Completion is recorded per id, so adding
///   a second migration never re-runs or cancels the first.
/// - A migration is marked done **only when it reports success**. The old code
///   consumed its tag up front, so a launch where the repair bailed — offline,
///   auth still restoring, Gmail check failed — burned the one attempt silently.
///   That is precisely how the stale micro1/Turing rows survived a "successful"
///   rebuild.
/// - Nothing runs before the store is hydrated. A rebuild against a signed-out
///   tracker purges the local KV copy, reports success, and leaves the Firestore
///   junk untouched — success by every measure except the one that matters.
@MainActor
enum TrackerMigrations {
    private static let defaultsKey = "trackerMigrationsCompleted"

    /// A data repair that leaves no trace is a repair nobody can confirm ran.
    /// Three rounds of this bug were "fixed" on the strength of a build that
    /// compiled; each time the rows came back, and there was no way to tell
    /// whether the migration had bailed, succeeded against the wrong store, or
    /// never fired. Read it with:
    ///
    ///     log stream --device --predicate 'subsystem == "com.mohamedfuad.internshipportal"'
    private static let logger = Logger(
        subsystem: "com.mohamedfuad.internshipportal", category: "migrations"
    )

    /// Logger is the right home for this in a shipping build, but reading os_log
    /// off an attached device requires root — so a Debug build also prints to
    /// stdout, which `devicectl process launch --console` bridges. That is what
    /// makes a repair verifiable from a laptop without touching the phone.
    private static func log(_ message: String) {
        logger.info("\(message, privacy: .public)")
        #if DEBUG
        print("[migrations] \(message)")
        #endif
    }

    /// Migrations in run order. Append; never renumber or reuse an id.
    ///
    /// **A migration must never delete data it cannot itself restore.** This list
    /// is empty because the first entry broke that rule and cost the owner a
    /// tracker: it called `rebuildFromGmail`, which purges every Gmail-derived
    /// row, commits that purge, and only THEN asks the server to re-derive them.
    /// On 2026-07-20 the purge wrote 21 rows → 0 and the re-scan returned
    /// nothing, so the tracker was simply empty. Rebuild is destructive by
    /// design, which is why the UI puts it behind a confirmation alert — running
    /// it unattended at launch removed the one safeguard it had.
    ///
    /// The rule for anything added here: it must be idempotent, and it must be
    /// safe to run with the network down and the server returning nothing. A
    /// repair that edits rows in place (stripping bad milestones, renaming a
    /// field, fixing a status) qualifies. Purge-and-refetch does not, unless the
    /// replacement data is in hand and verified BEFORE the delete commits.
    private static let all: [(id: String, run: (CatalogStore) async -> Bool)] = []

    private static var completed: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: defaultsKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: defaultsKey) }
    }

    /// Runs any migration that has not yet succeeded on this device.
    ///
    /// Call from a launch hook, not from `init` — it waits on hydration, and it
    /// deliberately gives up rather than blocking the app if auth never resolves.
    /// A migration that does not run today simply runs on the next launch.
    static func run(on store: CatalogStore) async {
        var done = completed
        let pending = all.filter { !done.contains($0.id) }
        guard !pending.isEmpty else {
            log("no pending migrations (\(done.count) already done)")
            return
        }
        log("pending: \(pending.map(\.id).joined(separator: ", "))")

        // Wait out the auth/hydration race: the first load can finish before
        // AuthGate resolves the Firestore profile. 15s is generous for a warm
        // launch and short enough that a genuinely signed-out device gives up
        // instead of hanging on a repair it cannot perform correctly anyway.
        var waited = 0.0
        while store.profileID == nil && waited < 15 {
            try? await Task.sleep(for: .seconds(0.5))
            waited += 0.5
        }
        guard let profile = store.profileID else {
            log("gave up after \(waited)s — profile never hydrated; will retry next launch")
            return
        }
        log("hydrated as \(profile) after \(waited)s")

        for migration in pending {
            let ok = await migration.run(store)
            log("\(migration.id): \(ok ? "succeeded" : "bailed — will retry next launch")")
            guard ok else { continue }
            done.insert(migration.id)
            completed = done
        }
        log("tracker now holds \(store.tracker.count) rows")
    }
}
