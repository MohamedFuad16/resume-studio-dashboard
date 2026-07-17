// Settings — the web SettingsPanel's shape, scoped to what exists without
// sign-in. Account, AI keys and model pickers arrive with Firebase; showing
// them disabled would promise something the build can't do yet.
import SwiftUI

struct SettingsView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Status", value: "Browsing without an account")
                    Text("Sign-in (email and Google), your saved pipeline, and AI research keys arrive with the Firebase integration.")
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                }

                Section("Data") {
                    LabeledContent("Catalog source") {
                        Text("portal-compile-jp · Japan East")
                            .font(.footnote)
                            .foregroundStyle(Theme.muted)
                    }
                    Link("Open the web portal", destination: URL(string: "https://portal.mohamedfuad.com")!)
                        .foregroundStyle(Theme.accent)
                }

                Section {
                    Button("Back to sign-in", role: .destructive) {
                        session.signOut()
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    MainTabView().environment(SessionStore())
}
