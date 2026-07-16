// The app shell — four content tabs, per the planner reference (Home / Tasks /
// To-do / Stats): search is a tool inside the Roles list, never a destination,
// so there is deliberately NO search tab and no navigation-bar search field.
// The system Liquid Glass bar renders selection in ink, like the reference.
import SwiftUI

enum AppTab: String {
    case home, roles, timeline, settings
}

// Tab selection, shared through the environment so in-content controls
// (the header's circular buttons, "See all" pills) can switch tabs.
@Observable
final class NavModel {
    var tab: AppTab

    init() {
        let args = ProcessInfo.processInfo.arguments
        // "--tab <name>" selects an initial tab — headless-run hook, like --browse.
        if let flag = args.firstIndex(of: "--tab"), args.indices.contains(flag + 1),
           let initial = AppTab(rawValue: args[flag + 1]) {
            tab = initial
        } else {
            tab = .home
        }
    }
}

struct MainTabView: View {
    @State private var catalog = CatalogStore()
    @State private var nav = NavModel()

    var body: some View {
        @Bindable var nav = nav
        TabView(selection: $nav.tab) {
            Tab("Home", systemImage: "house", value: .home) {
                DashboardView()
            }
            Tab("Roles", systemImage: "list.bullet", value: .roles) {
                RadarView()
            }
            Tab("Timeline", systemImage: "clock", value: .timeline) {
                TimelineView()
            }
            Tab("Settings", systemImage: "gearshape", value: .settings) {
                SettingsView()
            }
        }
        // The reference's selected tab is ink, not a brand color.
        .tint(Theme.ink)
        .tabBarMinimizeBehavior(.onScrollDown)
        .environment(catalog)
        .environment(nav)
        .task { await catalog.load() }
    }
}

#Preview {
    MainTabView().environment(SessionStore())
}
