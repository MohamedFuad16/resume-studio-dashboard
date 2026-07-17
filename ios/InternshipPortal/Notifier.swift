// Local notifications for applications the inbox found on its own.
//
// The point is that the app tells you something you did not already know: an
// application email landed, the drain picked it up, and here is the company —
// with its logo, so it is recognisable from the lock screen without reading.
//
// These are LOCAL notifications, not push. The drain is what discovers a record,
// so whoever runs the drain can post the banner directly; there is no server
// round-trip, no APNs certificate, and nothing to keep in sync. The cost is that
// discovery only happens while the app is running or being brought forward, which
// is exactly when RootView drains anyway.
import UIKit
import UserNotifications

@MainActor
enum Notifier {
    /// Actions already announced. Persisted, because "new" has to mean new to YOU,
    /// not new to this launch — without it, every cold start would re-announce the
    /// same applications from the top of the queue.
    private static let announcedKey = "announcedApplicationIDs"

    /// Ask once, quietly. A denied prompt is not an error: the drain still works
    /// and the app still updates, you just do not get the banner.
    static func requestAuthorization() async {
        _ = try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])
    }

    private static var announced: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: announcedKey) ?? []) }
        set { UserDefaults.standard.set(Array(newValue), forKey: announcedKey) }
    }

    /// Records the given keys as already-announced WITHOUT notifying.
    ///
    /// The first drain on a fresh install applies the entire backlog — 41 actions
    /// the day this was written. Announcing those would fire 41 banners for mail
    /// the user read weeks ago, which is spam, not news. So the first drain
    /// establishes the baseline silently and only later arrivals are announced.
    static func seed(_ keys: [String]) {
        announced.formUnion(keys)
    }

    static var hasBaseline: Bool {
        !(UserDefaults.standard.stringArray(forKey: announcedKey) ?? []).isEmpty
            || UserDefaults.standard.bool(forKey: "\(announcedKey).seeded")
    }

    static func markBaselineSeeded() {
        UserDefaults.standard.set(true, forKey: "\(announcedKey).seeded")
    }

    /// Announce one application, if it has not been announced before.
    ///
    /// - Parameter key: stable per application event (company + status), so a
    ///   rejection after an application is worth its own banner but re-draining
    ///   the same email is not.
    static func announce(
        key: String,
        company: String,
        role: String,
        status: ApplicationStatus,
        logoCandidates: [String]
    ) async {
        guard !announced.contains(key) else { return }
        announced.insert(key)

        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional else { return }

        let content = UNMutableNotificationContent()
        content.title = company
        content.body = Self.body(role: role, status: status)
        content.sound = .default
        if let attachment = await logoAttachment(candidates: logoCandidates, key: key) {
            content.attachments = [attachment]
        }

        // nil trigger = deliver now. iOS suppresses the banner when the app is
        // frontmost, which is correct — the row is already on screen.
        let request = UNNotificationRequest(
            identifier: key, content: content, trigger: nil
        )
        try? await UNUserNotificationCenter.current().add(request)
    }

    private static func body(role: String, status: ApplicationStatus) -> String {
        switch status {
        case .rejected:
            String(localized: "Rejected — \(role)")
        case .interview:
            String(localized: "Interview scheduled — \(role)")
        default:
            String(localized: "You applied for \(role)")
        }
    }

    /// The company's real logo, written to a file because that is the only thing
    /// UNNotificationAttachment accepts.
    ///
    /// Re-encoded as PNG rather than saved raw: the chain hands back .ico and
    /// .webp bytes that UIImage decodes happily but the notification service
    /// refuses, and a wrong extension is rejected outright. Going through UIImage
    /// means whatever we attach is something iOS has already proven it can render.
    private static func logoAttachment(
        candidates: [String], key: String
    ) async -> UNNotificationAttachment? {
        guard let logo = await LogoLoader.load(candidates: candidates),
              let png = logo.image.pngData() else { return nil }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("notif-\(abs(key.hashValue)).png")
        do {
            try png.write(to: url)
            return try UNNotificationAttachment(identifier: "", url: url, options: nil)
        } catch {
            return nil
        }
    }
}
