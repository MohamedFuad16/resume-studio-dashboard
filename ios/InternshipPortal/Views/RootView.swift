// The app shell: four tabs behind a floating pill nav, plus the shared sheets.
//
// The reference hand-builds its nav as a floating white pill rather than using a
// system tab bar, so this does too — but on iOS 26+ the pill is real Liquid Glass
// (GlassEffectContainer + .glassEffect), which the web can only approximate with a
// shadow. Content scrolls *under* it, which is the whole point of the material.
import SwiftUI

enum Tab: String, CaseIterable, Identifiable {
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
    @State private var tab: Tab = Tab(rawValue: UserDefaults.standard.string(forKey: "tab") ?? "") ?? .home
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
        ZStack(alignment: .bottom) {
            AmbientCanvas(active: route == nil) {
                Group {
                    switch tab {
                    case .home: HomeView(tab: $tab, route: $route)
                    case .radar: RadarView(route: $route)
                    case .applications: ApplicationsView(route: $route)
                    case .calendar: CalendarView(route: $route)
                    }
                }
                .transition(.opacity.combined(with: .offset(y: 8)))
            }

            GlassNav(tab: $tab)
                .padding(.bottom, 8)
        }
        .task {
            await store.load()
            applyLaunchHooks()
        }
        .animation(.easeOut(duration: 0.2), value: tab)
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
            .padding(.bottom, 104)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .task {
                try? await Task.sleep(for: .seconds(3))
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { store.toast = nil }
            }
        }
    }
}

/// The floating pill. Liquid Glass on iOS 26+, with the reference's white pill as
/// the fallback so the design survives on anything older.
struct GlassNav: View {
    @Binding var tab: Tab
    @Namespace private var glass

    var body: some View {
        GlassEffectContainer(spacing: 18) {
            HStack(spacing: 2) {
                ForEach(Tab.allCases) { item in
                    NavButton(item: item, isActive: tab == item) {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                            tab = item
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .glassEffect(.regular.interactive(), in: .capsule)
            .glassEffectID("nav", in: glass)
        }
        .floatShadow()
    }
}

private struct NavButton: View {
    var item: Tab
    var isActive: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                ZStack {
                    if isActive {
                        Capsule()
                            .fill(Palette.canvas.opacity(0.9))
                            .frame(width: 46, height: 30)
                            .transition(.scale.combined(with: .opacity))
                    }
                    Image(systemName: item.symbol)
                        .font(.system(size: 19, weight: isActive ? .semibold : .regular))
                        .foregroundStyle(isActive ? Palette.ink : Palette.ink400)
                        .frame(height: 30)
                }
                Text(item.label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(isActive ? Palette.ink : Palette.ink400)
            }
            .frame(width: 74)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.label)
        .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
    }
}

/// Standard scroll container for a tab: reference padding (px-5 pt-10) and enough
/// bottom inset that the last row clears the floating nav.
struct TabScroll<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)      // reference: pt-10, less the navigation-free safe area
            .padding(.bottom, 132)  // clears the floating nav + home indicator
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

#Preview("Nav bar") {
    @Previewable @State var tab: Tab = .home
    ZStack {
        Palette.canvas
        VStack {
            Spacer()
            GlassNav(tab: $tab)
        }
    }
    .ignoresSafeArea()
}
