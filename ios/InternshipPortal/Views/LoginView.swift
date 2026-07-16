// The auth gate — a faithful port of the web LoginScreen (ADR-0028): warm paper,
// serif display headline, placeholder-only pill fields, black primary buttons.
// The login screen is the one surface that deliberately keeps its black pills
// (the accent blue is reserved for in-app primary actions), same as the web.
//
// Sign-in is stubbed until the Firebase SDK lands; "Browse without an account"
// is real and drops into the catalog, which needs no auth.
import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var showAuthStub = false

    private var ready: Bool { !email.isEmpty && !password.isEmpty }

    var body: some View {
        ZStack {
            Theme.paper.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 48)

                // Serif display, exactly the web's role for Instrument Serif.
                Text("Welcome back")
                    .font(.system(size: 40, weight: .regular, design: .serif))
                    .foregroundStyle(Theme.ink)

                Text("Sign in to track internships, research companies, and build bilingual résumés.")
                    .font(.footnote)
                    .foregroundStyle(Theme.faint)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 44)
                    .padding(.top, 10)

                VStack(spacing: 12) {
                    Button {
                        showAuthStub = true
                    } label: {
                        Label("Continue with Google", systemImage: "g.circle.fill")
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.ink)

                    LabeledDivider(text: "or")

                    LoginField(placeholder: "Enter email address", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    LoginField(placeholder: "Enter password", text: $password, secure: true)

                    Button {
                        showAuthStub = true
                    } label: {
                        Text("Continue")
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.ink)
                    .disabled(!ready)
                }
                .buttonBorderShape(.capsule)
                .padding(.horizontal, 36)
                .padding(.top, 30)

                Spacer()

                // Real today: the catalog is public, so browsing needs no account.
                Button {
                    session.browseWithoutAccount()
                } label: {
                    Text("Browse internships without an account")
                        .font(.footnote.weight(.medium))
                }
                .buttonStyle(.glass)
                .buttonBorderShape(.capsule)

                Text("By continuing, you agree to the Terms of Service and Privacy Policy.")
                    .font(.caption2)
                    .foregroundStyle(Theme.faint)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 60)
                    .padding(.vertical, 18)
            }
        }
        .alert("Sign-in isn't wired up yet", isPresented: $showAuthStub) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Account sign-in arrives with the Firebase SDK. Browse without an account to see the live catalog now.")
        }
    }
}

private struct LoginField: View {
    let placeholder: String
    @Binding var text: String
    var secure = false

    var body: some View {
        Group {
            if secure {
                SecureField(placeholder, text: $text)
            } else {
                TextField(placeholder, text: $text)
            }
        }
        .multilineTextAlignment(.center)
        .font(.subheadline)
        .padding(.vertical, 13)
        .background(.white, in: .capsule)
        .overlay(Capsule().strokeBorder(.black.opacity(0.08)))
    }
}

private struct LabeledDivider: View {
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(.black.opacity(0.08)).frame(height: 1)
            Text(text).font(.caption).foregroundStyle(Theme.faint)
            Rectangle().fill(.black.opacity(0.08)).frame(height: 1)
        }
    }
}

#Preview {
    LoginView().environment(SessionStore())
}
