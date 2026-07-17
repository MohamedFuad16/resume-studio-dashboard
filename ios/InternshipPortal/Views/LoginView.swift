// The sign-in wall. Same two providers as the web (editor/src/auth), same account,
// so signing in here shows the applications you already track on the desktop.
import SwiftUI

struct LoginView: View {
    @Environment(AuthService.self) private var auth

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?

    private enum Mode { case signIn, signUp }
    private enum Field { case email, password }

    private var canSubmit: Bool {
        email.contains("@") && password.count >= 6 && !auth.busy
    }

    var body: some View {
        AmbientCanvas {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 40)

                    IconTile(symbol: "location.north.circle", tint: .teal, size: 52, glyph: 24)
                        .padding(.bottom, 20)

                    // Serif matches the web's "Welcome back" wall — the brand's
                    // display voice.
                    Text(mode == .signIn ? "Welcome back" : "Create your account")
                        .font(.system(size: 30, weight: .semibold, design: .serif))
                        .foregroundStyle(Palette.ink)
                        .contentTransition(.opacity)

                    Text("Track internships, research companies, and keep every application in one place.")
                        .font(Font2.body)
                        .foregroundStyle(Palette.ink500)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 6)
                        .padding(.bottom, 28)

                    Button {
                        Task { await auth.signInWithGoogle() }
                    } label: {
                        HStack(spacing: 10) {
                            GoogleMark()
                            Text("Continue with Google")
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Palette.ink, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .disabled(auth.busy)

                    HStack(spacing: 12) {
                        line
                        Text("or").font(Font2.caption).foregroundStyle(Palette.ink400)
                        line
                    }
                    .padding(.vertical, 20)

                    VStack(spacing: 10) {
                        AuthField(
                            text: $email, placeholder: "Enter email address",
                            symbol: "envelope", isSecure: false
                        )
                        .focused($focus, equals: .email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.next)
                        .onSubmit { focus = .password }

                        AuthField(
                            text: $password, placeholder: "Enter password",
                            symbol: "lock", isSecure: true
                        )
                        .focused($focus, equals: .password)
                        .textContentType(mode == .signIn ? .password : .newPassword)
                        .submitLabel(.go)
                        .onSubmit { submit() }
                    }

                    if let error = auth.error {
                        Label(error, systemImage: "exclamationmark.circle.fill")
                            .font(Font2.caption)
                            .foregroundStyle(Palette.orange600)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 12)
                            .transition(.opacity)
                    }

                    Button(action: submit) {
                        HStack(spacing: 8) {
                            if auth.busy { ProgressView().tint(.white).controlSize(.small) }
                            Text(mode == .signIn ? "Sign in" : "Create account")
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(canSubmit ? Palette.teal : Palette.ink300, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSubmit)
                    .padding(.top, 16)

                    HStack(spacing: 4) {
                        Text(mode == .signIn ? "Don't have an account?" : "Already have an account?")
                            .foregroundStyle(Palette.ink500)
                        Button(mode == .signIn ? "Sign up" : "Sign in") {
                            withAnimation(.easeOut(duration: 0.2)) {
                                mode = mode == .signIn ? .signUp : .signIn
                                auth.error = nil
                            }
                        }
                        .foregroundStyle(Palette.ink)
                        .fontWeight(.semibold)
                        .buttonStyle(.plain)
                    }
                    .font(Font2.caption)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 20)

                    if mode == .signIn {
                        Button("Forgot password?") {
                            Task { await auth.resetPassword(email: email) }
                        }
                        .font(Font2.caption)
                        .foregroundStyle(Palette.ink400)
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 10)
                        .disabled(!email.contains("@"))
                    }

                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 28)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var line: some View {
        Rectangle().fill(Palette.hairline).frame(height: 1)
    }

    private func submit() {
        guard canSubmit else { return }
        focus = nil
        Task {
            switch mode {
            case .signIn: await auth.signIn(email: email, password: password)
            case .signUp: await auth.signUp(email: email, password: password)
            }
        }
    }
}

/// A rounded text field matching the reference's inputs. Named AuthField, not
/// Field, so it can't collide with the focus enum above.
private struct AuthField: View {
    @Binding var text: String
    var placeholder: String
    var symbol: String
    var isSecure: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14))
                .foregroundStyle(Palette.ink400)
                .frame(width: 18)
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .font(Font2.body)
            .foregroundStyle(Palette.ink)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .background(Palette.card, in: .capsule)
        .overlay { Capsule().strokeBorder(Palette.hairline, lineWidth: 1) }
    }
}

/// Google's mark, drawn rather than bundled — four arcs, no asset, no licence file.
private struct GoogleMark: View {
    var body: some View {
        ZStack {
            Circle().fill(.white).frame(width: 20, height: 20)
            Text("G")
                .font(.system(size: 13, weight: .bold, design: .default))
                .foregroundStyle(Color(hex: 0x4285F4))
        }
        .accessibilityHidden(true)
    }
}

#if DEBUG
#Preview("Sign in") {
    LoginView().environment(AuthService())
}
#endif
