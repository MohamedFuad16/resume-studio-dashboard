// Firebase Auth for the iOS client — the same account wall the web app uses
// (editor/src/auth/*), so a signed-in user sees the same Firestore data on both.
//
// Email/password + Google, matching the web's two providers. There is deliberately
// no anonymous path: every read below is scoped to `users/{uid}`, and the deployed
// rules are owner-only, so an unauthenticated session has nothing to show.
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import Observation
import SwiftUI

@Observable
@MainActor
final class AuthService {
    enum Phase: Equatable {
        case starting          // waiting for Firebase to restore a session
        case signedOut
        case signedIn(uid: String, email: String?, name: String?)
    }

    var phase: Phase = .starting
    var busy = false
    /// Surfaced under the form. Firebase's own messages are decent, but its codes
    /// are not, so the common ones are translated below.
    var error: String?

    private var handle: AuthStateDidChangeListenerHandle?

    var uid: String? {
        if case .signedIn(let uid, _, _) = phase { return uid }
        return nil
    }

    var email: String? {
        if case .signedIn(_, let email, _) = phase { return email }
        return nil
    }

    var displayName: String? {
        if case .signedIn(_, _, let name) = phase { return name }
        return nil
    }

    init() {
        // Fires immediately with the restored session (or nil), then on every change.
        handle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.apply(user)
            }
        }

        // Failsafe: if that first callback never arrives, the app would sit on the
        // launch spinner with no way out. It happened for real — a keychain
        // entitlement failure (SecItem -34018) silently swallows the callback — and
        // an unreachable app is a worse outcome than an unnecessary login form.
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(5))
            if case .starting = phase {
                phase = .signedOut
                error = "Couldn't restore your session. Please sign in again."
            }
        }
    }

    /// `isolated deinit` (SE-0371): runs on the main actor, so it can read the
    /// stored handle directly — no `nonisolated(unsafe)` escape hatch needed.
    isolated deinit {
        if let handle { Auth.auth().removeStateDidChangeListener(handle) }
    }

    private func apply(_ user: User?) {
        if let user {
            phase = .signedIn(uid: user.uid, email: user.email, name: user.displayName)
        } else {
            phase = .signedOut
        }
    }

    // MARK: - Email / password

    func signIn(email: String, password: String) async {
        await run { try await Auth.auth().signIn(withEmail: email, password: password) }
    }

    func signUp(email: String, password: String) async {
        await run { try await Auth.auth().createUser(withEmail: email, password: password) }
    }

    func resetPassword(email: String) async {
        busy = true
        error = nil
        do {
            try await Auth.auth().sendPasswordReset(withEmail: email)
            error = "Password reset sent — check \(email)."
        } catch {
            self.error = Self.message(for: error)
        }
        busy = false
    }

    /// Renames the account — the greeting and Settings read displayName, so the
    /// change is committed to Firebase, the user reloaded, and the phase
    /// re-applied so every view updates at once.
    func updateDisplayName(_ name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        await run {
            guard let user = Auth.auth().currentUser else { return }
            let change = user.createProfileChangeRequest()
            change.displayName = trimmed
            try await change.commitChanges()
            try await user.reload()
        }
        apply(Auth.auth().currentUser)
    }

    // MARK: - Google

    func signInWithGoogle() async {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            error = "Google sign-in isn't configured for this build."
            return
        }
        guard let presenter = Self.topViewController() else {
            error = "Couldn't open the Google sign-in screen."
            return
        }

        busy = true
        error = nil
        do {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString else {
                throw AuthError.missingGoogleToken
            }
            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            try await Auth.auth().signIn(with: credential)
        } catch let error as NSError where error.code == GIDSignInError.canceled.rawValue {
            // The user backed out; that is not a failure worth shouting about.
        } catch {
            self.error = Self.message(for: error)
        }
        busy = false
    }

    func signOut() {
        try? Auth.auth().signOut()
        GIDSignIn.sharedInstance.signOut()
    }

    // MARK: - Plumbing

    private func run(_ work: () async throws -> Void) async {
        busy = true
        error = nil
        do {
            try await work()
        } catch {
            self.error = Self.message(for: error)
        }
        busy = false
    }

    enum AuthError: LocalizedError {
        case missingGoogleToken
        var errorDescription: String? { "Google didn't return a sign-in token. Try again." }
    }

    /// Firebase's raw errors leak codes at the user ("ERROR_INVALID_CREDENTIAL").
    /// Say what went wrong and what to do instead.
    static func message(for error: Error) -> String {
        let code = AuthErrorCode(rawValue: (error as NSError).code)
        switch code {
        case .invalidEmail: return "That email address doesn't look right."
        case .invalidCredential, .wrongPassword: return "Wrong email or password."
        case .userNotFound: return "No account with that email. Create one below."
        case .emailAlreadyInUse: return "That email already has an account. Sign in instead."
        case .weakPassword: return "Passwords need at least 6 characters."
        case .networkError: return "Can't reach Firebase. Check your connection."
        case .tooManyRequests: return "Too many attempts. Wait a minute and try again."
        default: return error.localizedDescription
        }
    }

    /// GIDSignIn needs a presenting controller; SwiftUI doesn't hand us one.
    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
