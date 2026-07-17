// Internship Portal — native iOS client for the same product as editor/ (web).
//
// Design: iOS 27 Liquid Glass throughout — system TabView, glass toolbars and
// controls — with the product's own identity mapped on top (see Theme.swift and
// agent/decisions.md ADR-0028..0031 for the web design language this mirrors):
// ink #101113, one accent blue #1A56F0 that means "primary action" only, warm
// paper on the auth screen, serif display for the welcome headline.
//
// Auth note: the web app signs in through Firebase (email/password + Google).
// The Firebase SDK is deliberately NOT wired yet — LoginView is the real design
// with a stubbed submit, and "Browse without an account" uses the public catalog
// API, which needs no auth. See SessionStore.
import SwiftUI

@main
struct InternshipPortalApp: App {
    @State private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .tint(Theme.accent)
        }
    }
}

struct RootView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        if session.isBrowsing {
            MainTabView()
        } else {
            LoginView()
        }
    }
}

// Session state. `isBrowsing` is what gates the shell; real Firebase auth will
// replace `signInStubbed` and keep the same surface, so views don't churn.
@Observable
final class SessionStore {
    // "--browse" jumps straight past the auth gate — used by headless
    // simulator runs and UI snapshots, never set in a normal launch.
    var isBrowsing = ProcessInfo.processInfo.arguments.contains("--browse")
    var displayName = ""

    func browseWithoutAccount() {
        displayName = ""
        isBrowsing = true
    }

    func signOut() {
        displayName = ""
        isBrowsing = false
    }
}
