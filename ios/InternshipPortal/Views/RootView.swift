// The app shell: four tabs plus the shared sheets.
//
// The tab bar is the SYSTEM TabView, on purpose, after two hand-rolled attempts:
// a glass selection capsule nested in a glass bar went flat grey (glass cannot
// sample other glass), and a plain white indicator inside the glass pill read as
// two rings fighting. The fluid part of Liquid Glass — the droplet that slides and
// stretches between items, the lensing while it moves, the minimize-on-scroll —
// lives in the system bar and is not reachable from public API. On iOS 26+ the
// native bar IS the floating liquid pill; trying to imitate it above it only ever
// produces a worse copy.
import SwiftUI

/// Named AppTab, not Tab: the iOS 18+ TabView syntax has its own `SwiftUI.Tab`
/// type, and shadowing it turns every `Tab("…")` line into our enum.
enum AppTab: String, CaseIterable, Identifiable {
    case home, radar, applications, calendar, settings

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: String(localized: "Home")
        case .radar: String(localized: "Radar")
        case .applications: String(localized: "Applications")
        case .calendar: String(localized: "Calendar")
        case .settings: String(localized: "Settings")
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .radar: "location.north.circle"
        case .applications: "briefcase"
        case .calendar: "calendar"
        case .settings: "gearshape"
        }
    }
}

/// What can be presented over any tab. One enum keeps presentation in one place
/// instead of scattering @State bools across screens.
enum Route: Identifiable, Hashable {
    case internship(Internship)
    case record(TrackerRecord)
    case addEvent
    case interviewDate(recordId: String, company: String)

    var id: String {
        switch self {
        case .internship(let item): "internship-\(item.id)"
        case .record(let record): "record-\(record.id)"
        case .addEvent: "add-event"
        case .interviewDate(let id, _): "interview-\(id)"
        }
    }
}

struct RootView: View {
    @Environment(CatalogStore.self) private var store
    @State private var tab: AppTab = AppTab(rawValue: UserDefaults.standard.string(forKey: "tab") ?? "") ?? .home
    @State private var route: Route?

    /// Screenshot/QA hook: `simctl launch … -tab radar -sheet first` opens straight
    /// to a tab, and optionally to the first internship's sheet. Launch arguments
    /// prefixed with `-` land in UserDefaults automatically.
    private func applyLaunchHooks() {
        #if DEBUG
        // DEBUGGING PHASE: run the Gmail rebuild ONCE per tag, here (after load, so
        // the Firestore profile is resolved and the purge writes to the right
        // place). Bump the tag to force a fresh repair on the next cold launch.
        // Same mechanism as the onboarding-review reset — a stored tag, not a
        // launch argument, because devicectl doesn't reliably pass args into
        // NSUserDefaults' argument domain.
        let rebuildTag = "gmail-rebuild-2026-07-19b"   // b: first run may have purged the KV store, not Firestore
        if UserDefaults.standard.string(forKey: "gmailRebuildTag") != rebuildTag {
            Task {
                // Wait out the auth/hydration race: RootView's first load can
                // finish before AuthGate's setUser resolves the Firestore
                // profile. The rebuild refuses to run unhydrated, so poll
                // briefly instead of losing this launch's attempt to timing.
                var waited = 0.0
                while store.profileID == nil && waited < 15 {
                    try? await Task.sleep(for: .seconds(0.5))
                    waited += 0.5
                }
                // Consume the tag ONLY when the purge actually persisted. The
                // previous version consumed it up front, so one launch where the
                // rebuild bailed (offline / auth still restoring / Gmail check
                // failed) burned the repair silently — which is exactly how the
                // stale micro1/Turing rows survived a "successful" rebuild build.
                if await store.rebuildFromGmail() {
                    UserDefaults.standard.set(rebuildTag, forKey: "gmailRebuildTag")
                }
            }
        }
        #endif

        guard UserDefaults.standard.string(forKey: "sheet") == "first",
              let first = store.internships.first else { return }
        route = .internship(first)
    }

    var body: some View {
        TabView(selection: $tab) {
            SwiftUI.Tab(AppTab.home.label, systemImage: AppTab.home.symbol, value: AppTab.home) {
                AmbientCanvas(active: route == nil) { HomeView(tab: $tab, route: $route) }
            }
            SwiftUI.Tab(AppTab.radar.label, systemImage: AppTab.radar.symbol, value: AppTab.radar) {
                AmbientCanvas(active: route == nil) { RadarView(route: $route) }
            }
            SwiftUI.Tab(AppTab.applications.label, systemImage: AppTab.applications.symbol, value: AppTab.applications) {
                // No AmbientCanvas HERE: Applications owns a NavigationStack (for
                // the Companies push), and a stack paints its own opaque ground
                // over anything behind it — the canvas must live inside the stack
                // or cards sit on flat white and stop reading as cards.
                ApplicationsView(route: $route)
            }
            SwiftUI.Tab(AppTab.calendar.label, systemImage: AppTab.calendar.symbol, value: AppTab.calendar) {
                AmbientCanvas(active: route == nil) { CalendarView(route: $route) }
            }
            SwiftUI.Tab(AppTab.settings.label, systemImage: AppTab.settings.symbol, value: AppTab.settings) {
                SettingsView()
            }
        }
        // The bar shrinks to a droplet while you scroll a long list — the system
        // behaviour, and half of what makes the material feel alive.
        .tabBarMinimizeBehavior(.onScrollDown)
        // Selected items wear the app's ink, not the default blue.
        .tint(Palette.ink)
        .task {
            await store.load()
            applyLaunchHooks()
        }
        .overlay(alignment: .bottom) { toast }
        .sheet(item: $route) { route in
            switch route {
            case .internship(let item):
                InternshipSheet(item: item)
            case .record(let record):
                RecordSheet(record: record)
            case .addEvent:
                AddEventSheet()
            case .interviewDate(let recordId, let company):
                InterviewDateSheet(recordId: recordId, company: company)
            }
        }
    }

    /// The status pill. Two states, because "syncing" and "synced" are not the
    /// same news: a message still in progress (trailing ellipsis) shows a spinner
    /// and holds longer; a finished one shows a check and leaves quickly. It rises
    /// and settles on a spring rather than sliding flatly in — the same motion
    /// language as the rest of the app.
    @ViewBuilder private var toast: some View {
        if let message = store.toast {
            let working = message.hasSuffix("…")

            HStack(spacing: 10) {
                Group {
                    if working {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Palette.teal400)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Palette.teal400)
                    }
                }
                .frame(width: 18, height: 18)

                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 13)
            .background {
                // Ink, but slightly translucent over a blur so it reads as a layer
                // floating above the content rather than a flat black slab.
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay { Capsule(style: .continuous).fill(Palette.ink.opacity(0.92)) }
            }
            .clipShape(.capsule(style: .continuous))
            .floatShadow()
            .padding(.horizontal, 24)
            .padding(.bottom, 76)   // rides above the system tab bar
            .transition(.asymmetric(
                insertion: .move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.92, anchor: .bottom)),
                removal: .opacity.combined(with: .scale(scale: 0.96, anchor: .bottom))
            ))
            .task(id: message) {
                try? await Task.sleep(for: .seconds(working ? 6 : 3))
                withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) { store.toast = nil }
            }
        }
    }
}

/// Standard scroll container for a tab: reference padding (px-5 pt-10). The system
/// tab bar contributes to the safe area, so only a small bottom inset is needed —
/// content scrolls under the glass, which is what the material wants.
struct TabScroll<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)      // reference: pt-10, less the navigation-free safe area
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Whole app") {
    RootView()
        .environment(CatalogStore.preview)
        .environment(AuthService())
}
#endif
