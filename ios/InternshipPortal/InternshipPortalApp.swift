// Internship Portal — the iOS client for portal.mohamedfuad.com.
//
// The app is deliberately light: the web owns the résumé editor and the LaTeX
// compile; the phone owns the things you do away from a desk — checking new
// roles, moving an application forward, and knowing what is next on the calendar.
import SwiftUI

@main
struct InternshipPortalApp: App {
    /// Owned here, injected above RootView. Presented sheets only inherit the
    /// environment of the view the `.sheet` modifier hangs off — injecting inside
    /// RootView leaves every sheet without a store.
    @State private var store = CatalogStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                // The design is a single, deliberate light world (the reference's
                // #F4F7F6 paper). A naive dark inversion would fight every token,
                // so the app commits rather than half-supporting both.
                .preferredColorScheme(.light)
        }
    }
}
