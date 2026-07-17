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
    case home, radar, applications, calendar

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: "Home"
        case .radar: "Radar"
        case .applications: "Applications"
        case .calendar: "Calendar"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .radar: "location.north.circle"
        case .applications: "briefcase"
        case .calendar: "calendar"
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
    case profile

    var id: String {
        switch self {
        case .internship(let item): "internship-\(item.id)"
        case .record(let record): "record-\(record.id)"
        case .addEvent: "add-event"
        case .interviewDate(let id, _): "interview-\(id)"
        case .profile: "profile"
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
                AmbientCanvas(active: route == nil) { ApplicationsView(route: $route) }
            }
            SwiftUI.Tab(AppTab.calendar.label, systemImage: AppTab.calendar.symbol, value: AppTab.calendar) {
                AmbientCanvas(active: route == nil) { CalendarView(route: $route) }
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
            case .profile:
                ProfileSheet()
            }
        }
    }

    @ViewBuilder private var toast: some View {
        if let message = store.toast {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Palette.teal400)
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(Palette.ink, in: .rect(cornerRadius: Radius.row, style: .continuous))
            .floatShadow()
            .padding(.bottom, 76)   // rides above the system tab bar
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task {
                try? await Task.sleep(for: .seconds(3))
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { store.toast = nil }
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

#Preview("Whole app") {
    RootView()
        .environment(CatalogStore.preview)
        .environment(AuthService())
}
