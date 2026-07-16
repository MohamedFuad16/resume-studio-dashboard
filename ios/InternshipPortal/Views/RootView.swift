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

/// The floating tab bar, in Liquid Glass.
///
/// Both layers are real glass: the bar itself, and a second glass capsule marking
/// the selected tab. Because the selection shares one `glassEffectID` inside a
/// `GlassEffectContainer`, moving tabs makes the two lenses merge and separate —
/// the material flows between them instead of a highlight cross-fading in place.
/// That fluidity is the entire point of the material, and it is why the selection
/// is not just a tinted `Capsule` any more.
struct GlassNav: View {
    @Binding var tab: Tab
    @Namespace private var glass

    var body: some View {
        GlassEffectContainer(spacing: 20) {
            HStack(spacing: 2) {
                ForEach(Tab.allCases) { item in
                    NavButton(item: item, isActive: tab == item, glass: glass) {
                        withAnimation(.spring(response: 0.4, dampingFraction: 0.72)) {
                            tab = item
                        }
                    }
                }
            }
            .padding(6)
            .glassEffect(.regular.interactive(), in: .capsule)
        }
        .floatShadow()
    }
}

private struct NavButton: View {
    var item: Tab
    var isActive: Bool
    var glass: Namespace.ID
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: item.symbol)
                    .font(.system(size: 19, weight: isActive ? .semibold : .regular))
                    .frame(height: 26)
                Text(item.label)
                    .font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(isActive ? Palette.ink : Palette.ink400)
            .frame(width: 72)
            .padding(.vertical, 7)
            .background {
                if isActive {
                    // .clear + glassEffect, not a filled shape: the fill is the
                    // material, and giving it the shared ID is what lets it flow
                    // to the next tab rather than fade.
                    Capsule()
                        .fill(.clear)
                        .glassEffect(.regular.tint(Palette.card.opacity(0.55)), in: .capsule)
                        .glassEffectID("selection", in: glass)
                }
            }
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
