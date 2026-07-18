// Internship Portal — the iOS client for portal.mohamedfuad.com.
//
// The app is deliberately light: the web owns the résumé editor and the LaTeX
// compile; the phone owns the things you do away from a desk — checking new
// roles, moving an application forward, and knowing what is next on the calendar.
import BackgroundTasks
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import SwiftUI

@main
struct InternshipPortalApp: App {
    /// Owned here, injected above RootView. Presented sheets only inherit the
    /// environment of the view the `.sheet` modifier hangs off — injecting inside
    /// RootView leaves every sheet without a store.
    @State private var store = CatalogStore()
    @State private var auth: AuthService

    init() {
        // Must run before any Auth/Firestore call. Reads GoogleService-Info.plist.
        FirebaseApp.configure()
        _auth = State(initialValue: AuthService())
    }

    @State private var showSplash = true
    @Environment(\.scenePhase) private var scenePhase
    /// First launch only: the onboarding screens between the splash and the gate.
    @AppStorage("hasOnboarded") private var hasOnboarded = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                AuthGate()

                // First launch: the splash fades into onboarding, which fades into
                // the gate. Every launch after that goes splash → gate directly.
                if !hasOnboarded {
                    OnboardingView {
                        withAnimation(.easeOut(duration: 0.4)) { hasOnboarded = true }
                    }
                    .zIndex(1)
                    .transition(.opacity)
                }

                // The intro splash sits over the gate and fades; it also covers the
                // beat where Firebase restores the session, so a returning user
                // goes canvas → bubbles → Home without ever seeing a spinner.
                if showSplash {
                    SplashView {
                        withAnimation(.easeOut(duration: 0.45)) { showSplash = false }
                    }
                    .zIndex(2)
                    .transition(.opacity)
                }
            }
            .environment(store)
            .environment(auth)
            // The design is a single, deliberate light world (the reference's
            // #F4F7F6 paper). A naive dark inversion would fight every token,
            // so the app commits rather than half-supporting both.
            .preferredColorScheme(.light)
            .onOpenURL { url in
                // Google Sign-In's callback into com.googleusercontent.apps.*
                GIDSignIn.sharedInstance.handle(url)
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .active:
                    // Coming forward is the app's cue to check the inbox. This is
                    // what makes a new application "just appear": you apply, the
                    // reply lands in Gmail, and the next time you open the app it
                    // is already there with a banner.
                    Task { await store.drainGmail() }
                case .background:
                    // Going away is the cue to book the next background wake.
                    Self.scheduleBackgroundRefresh()
                default:
                    break
                }
                // NB: the splash is shown on COLD LAUNCH only. It used to replay on
                // every foreground, but taking a screenshot briefly deactivates and
                // reactivates the app, which made the splash flash back every time
                // you tried to capture a screen.
            }
            .task {
                // Ask once the UI is up, not during init: a permission sheet over a
                // launch screen is the classic way to get told no.
                // `-skipNotifPrompt YES` suppresses it for screenshot/UI runs, where
                // the system sheet would otherwise sit over every screen.
                if !UserDefaults.standard.bool(forKey: "skipNotifPrompt") {
                    await Notifier.requestAuthorization()
                }

                #if DEBUG
                // DEBUGGING PHASE: replay first-run onboarding ONCE per review tag,
                // so it can be seen on a device that already onboarded — without
                // forcing four screens on every single foreground. Bump the tag to
                // show it again. Remove this block before shipping.
                let tag = "onboarding-review-2026-07-18b"
                if UserDefaults.standard.string(forKey: "onboardingReviewTag") != tag {
                    hasOnboarded = false
                    UserDefaults.standard.set(tag, forKey: "onboardingReviewTag")
                }
                #endif
            }
        }
        // Background refresh: iOS wakes the app (typically every few hours, at its
        // own discretion — the earliestBeginDate below is a floor, not a schedule),
        // the drain pulls whatever Gmail queued, and Notifier posts the "You
        // applied for <role> at <company>" banner with the real logo. This is how
        // an application shows up on the phone without the app ever being opened.
        .backgroundTask(.appRefresh(Self.refreshTaskID)) {
            await Self.scheduleBackgroundRefresh()   // book the next wake first
            await backgroundDrain()
        }
    }

    static let refreshTaskID = "com.mohamedfuad.internshipportal.refresh"

    /// Ask for a wake no sooner than 30 minutes out. iOS decides the real cadence
    /// from usage patterns; submitting again while one is pending is a no-op error
    /// we deliberately ignore.
    static func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: refreshTaskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    /// The background wake's work. ~30s budget from iOS; the drain's own request
    /// timeouts keep it inside that.
    ///
    /// A background launch has NO UI: AuthGate never runs, so the store arrives
    /// empty — no uid, no profile, no tracker. Draining in that state would apply
    /// actions onto an empty tracker and save it to the wrong store (the KV
    /// fallback). Restore the Firebase session synchronously and hydrate first;
    /// a signed-out phone has nothing to sync in the background.
    @MainActor
    private func backgroundDrain() async {
        if store.uid == nil, let uid = Auth.auth().currentUser?.uid {
            await store.setUser(uid)   // resolves profileID + loads the tracker
        }
        guard store.uid != nil else { return }
        await store.drainGmail()
    }
}

/// Chooses between the wall and the app, and keeps the store's user in step.
///
/// Every tracker read is scoped to `users/{uid}`, so the uid is not a display
/// detail — it decides which data exists at all. Pushing it into the store from one
/// place keeps that from drifting.
struct AuthGate: View {
    @Environment(AuthService.self) private var auth
    @Environment(CatalogStore.self) private var store

    /// `simctl launch … -previewMode YES` skips the wall and runs against the KV
    /// path, for screenshots and UI checks without typing an account password.
    /// DEBUG-only by construction — the flag does not exist in a release build, so
    /// it can never become a way past the login screen in the wild. Mirrors the
    /// web's `VITE_AUTH_DISABLED`, which exists for the same reason (E2E).
    private var previewMode: Bool {
        #if DEBUG
        UserDefaults.standard.bool(forKey: "previewMode")
        #else
        false
        #endif
    }

    var body: some View {
        Group {
            if previewMode {
                RootView().task { await store.setUser(nil) }
            } else {
                gated
            }
        }
    }

    @ViewBuilder private var gated: some View {
        Group {
            switch auth.phase {
            case .starting:
                // Firebase restores the session asynchronously. Showing the login
                // form here would flash it at users who are already signed in.
                AmbientCanvas {
                    ProgressView().tint(Palette.ink400)
                }
            case .signedOut:
                LoginView()
                    .transition(.opacity)
            case .signedIn(let uid, _, _):
                RootView()
                    .transition(.opacity)
                    .task(id: uid) { await store.setUser(uid) }
            }
        }
        .animation(.easeOut(duration: 0.25), value: auth.phase)
        .onChange(of: auth.phase) { _, phase in
            // Signing out must drop the previous account's records immediately,
            // not leave them on screen behind the login form.
            if case .signedOut = phase {
                Task { await store.setUser(nil) }
            }
        }
    }
}
