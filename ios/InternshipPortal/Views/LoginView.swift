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

/// Google's four-colour "G", the official mark drawn from its own path geometry
/// (translated from Google's 48×48 brand SVG to absolute Bézier coordinates), so
/// it is pixel-faithful rather than an arc approximation — and still no bundled
/// asset or licence file. Four filled paths: blue, green, yellow, red.
private struct GoogleMark: View {
    var body: some View {
        ZStack {
            Circle().fill(.white)
            GoogleG().padding(4)
        }
        .frame(width: 22, height: 22)
        .accessibilityHidden(true)
    }
}

private struct GoogleG: View {
    var body: some View {
        ZStack {
            shape(Self.blue).fill(Color(hex: 0x4285F4))
            shape(Self.green).fill(Color(hex: 0x34A853))
            shape(Self.yellow).fill(Color(hex: 0xFBBC05))
            shape(Self.red).fill(Color(hex: 0xEA4335))
        }
        .aspectRatio(1, contentMode: .fit)
    }

    /// Each segment as (start, [(control1, control2, end)]) in the 48×48 space,
    /// scaled into the view. Lines are curves with both controls on the segment.
    private func shape(_ seg: Segment) -> some Shape {
        GPath(segment: seg)
    }

    typealias P = CGPoint
    struct Segment { let start: P; let curves: [(P, P, P)] }

    // Coordinates in a 48×48 box (y-down), from Google's brand SVG.
    static let blue = Segment(start: P(x: 45.12, y: 24.5), curves: [
        (P(x: 45.12, y: 22.94), P(x: 44.98, y: 21.44), P(x: 44.72, y: 20.0)),
        (P(x: 44.72, y: 20.0), P(x: 24, y: 20.0), P(x: 24, y: 20.0)),
        (P(x: 24, y: 20.0), P(x: 24, y: 28.51), P(x: 24, y: 28.51)),
        (P(x: 24, y: 28.51), P(x: 35.84, y: 28.51), P(x: 35.84, y: 28.51)),
        (P(x: 35.33, y: 31.26), P(x: 33.78, y: 33.59), P(x: 31.45, y: 35.15)),
        (P(x: 31.45, y: 35.15), P(x: 31.45, y: 40.67), P(x: 31.45, y: 40.67)),
        (P(x: 31.45, y: 40.67), P(x: 38.56, y: 40.67), P(x: 38.56, y: 40.67)),
        (P(x: 42.72, y: 36.84), P(x: 45.12, y: 31.20), P(x: 45.12, y: 24.5)),
    ])
    static let green = Segment(start: P(x: 24, y: 46), curves: [
        (P(x: 29.94, y: 46), P(x: 34.92, y: 44.03), P(x: 38.56, y: 40.67)),
        (P(x: 38.56, y: 40.67), P(x: 31.45, y: 35.15), P(x: 31.45, y: 35.15)),
        (P(x: 29.48, y: 36.47), P(x: 26.96, y: 37.25), P(x: 24.0, y: 37.25)),
        (P(x: 18.27, y: 37.25), P(x: 13.42, y: 33.38), P(x: 11.69, y: 28.18)),
        (P(x: 11.69, y: 28.18), P(x: 4.34, y: 28.18), P(x: 4.34, y: 28.18)),
        (P(x: 4.34, y: 28.18), P(x: 4.34, y: 33.88), P(x: 4.34, y: 33.88)),
        (P(x: 7.96, y: 40.98), P(x: 15.4, y: 46), P(x: 24, y: 46)),
    ])
    static let yellow = Segment(start: P(x: 11.69, y: 28.18), curves: [
        (P(x: 11.25, y: 26.86), P(x: 11, y: 25.45), P(x: 11, y: 24)),
        (P(x: 11, y: 22.55), P(x: 11.25, y: 21.14), P(x: 11.69, y: 19.82)),
        (P(x: 11.69, y: 19.82), P(x: 11.69, y: 14.12), P(x: 11.69, y: 14.12)),
        (P(x: 11.69, y: 14.12), P(x: 4.34, y: 14.12), P(x: 4.34, y: 14.12)),
        (P(x: 2.85, y: 17.09), P(x: 2, y: 20.45), P(x: 2, y: 24)),
        (P(x: 2, y: 27.55), P(x: 2.85, y: 30.91), P(x: 4.34, y: 33.88)),
        (P(x: 4.34, y: 33.88), P(x: 11.69, y: 28.18), P(x: 11.69, y: 28.18)),
    ])
    static let red = Segment(start: P(x: 24, y: 10.75), curves: [
        (P(x: 27.23, y: 10.75), P(x: 30.13, y: 11.86), P(x: 32.41, y: 14.04)),
        (P(x: 32.41, y: 14.04), P(x: 38.72, y: 7.73), P(x: 38.72, y: 7.73)),
        (P(x: 34.91, y: 4.18), P(x: 29.93, y: 2), P(x: 24, y: 2)),
        (P(x: 15.4, y: 2), P(x: 7.96, y: 7.02), P(x: 4.34, y: 14.12)),
        (P(x: 4.34, y: 14.12), P(x: 11.69, y: 19.82), P(x: 11.69, y: 19.82)),
        (P(x: 13.42, y: 14.62), P(x: 18.27, y: 10.75), P(x: 24.0, y: 10.75)),
    ])
}

/// Renders one GoogleG.Segment, scaling its 48×48 coordinates into the frame.
private struct GPath: Shape {
    let segment: GoogleG.Segment

    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 48
        func f(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * s, y: p.y * s) }
        var path = Path()
        path.move(to: f(segment.start))
        for (c1, c2, end) in segment.curves {
            path.addCurve(to: f(end), control1: f(c1), control2: f(c2))
        }
        path.closeSubpath()
        return path
    }
}

#if DEBUG
#Preview("Sign in") {
    LoginView().environment(AuthService())
}
#endif
