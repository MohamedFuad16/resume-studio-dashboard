// Settings — the fifth tab. Profile lives here (identity card on top, now
// editable: photo + name), then language, integrations and data controls,
// matching the web's SettingsPanel + ProfileView.
import PhotosUI
import SwiftUI

/// The profile photo, device-local. Firebase Storage isn't wired (the web app
/// keeps its photo inside the résumé document), so the avatar is a file in
/// Application Support — good enough for "my face on my phone", and honest:
/// Settings labels it as on-device.
@MainActor
enum AvatarStore {
    private static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("profile-avatar.jpg")
    }

    static func load() -> UIImage? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    /// Downscales before writing: an avatar renders at 64pt, storing a 12MP
    /// photo for it wastes disk and decode time on every Settings visit.
    static func save(_ data: Data) -> UIImage? {
        guard let raw = UIImage(data: data) else { return nil }
        let side: CGFloat = 256
        let scale = side / max(raw.size.width, raw.size.height, 1)
        let size = CGSize(width: raw.size.width * scale, height: raw.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            raw.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = image.jpegData(compressionQuality: 0.85) else { return nil }
        try? jpeg.write(to: url, options: .atomic)
        return image
    }

    static func clear() {
        try? FileManager.default.removeItem(at: url)
    }
}

/// The in-app language override. iOS picks the app's language from the device
/// locale once ja.lproj exists; this row lets the user force it either way.
/// AppleLanguages is read at process start, so changes apply on next launch.
enum AppLanguage: String, CaseIterable, Identifiable {
    case system, english, japanese

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: String(localized: "System")
        case .english: "English"
        case .japanese: "日本語"
        }
    }

    static var current: AppLanguage {
        guard let override = UserDefaults.standard.stringArray(forKey: "AppleLanguages")?.first,
              UserDefaults.standard.object(forKey: "appLanguageOverride") != nil
        else { return .system }
        return override.hasPrefix("ja") ? .japanese : .english
    }

    func apply() {
        switch self {
        case .system:
            UserDefaults.standard.removeObject(forKey: "AppleLanguages")
            UserDefaults.standard.removeObject(forKey: "appLanguageOverride")
        case .english:
            UserDefaults.standard.set(["en"], forKey: "AppleLanguages")
            UserDefaults.standard.set("en", forKey: "appLanguageOverride")
        case .japanese:
            UserDefaults.standard.set(["ja"], forKey: "AppleLanguages")
            UserDefaults.standard.set("ja", forKey: "appLanguageOverride")
        }
    }
}

struct SettingsView: View {
    @Environment(CatalogStore.self) private var store
    @Environment(AuthService.self) private var auth
    @Environment(\.openURL) private var openURL

    @State private var confirmSignOut = false
    @State private var avatar: UIImage? = AvatarStore.load()
    @State private var language = AppLanguage.current
    private let webURL = URL(string: "https://portal.mohamedfuad.com")!

    /// Prefer the account's own name, fall back to the email's local part.
    private var name: String {
        if let displayName = auth.displayName, !displayName.isEmpty { return displayName }
        if let email = auth.email { return String(email.split(separator: "@").first ?? "Account") }
        return "Account"
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    identityCard
                        .padding(.bottom, 16)

                    // The pipeline at a glance — the web dashboard's strip, trimmed
                    // to the stages that carry news.
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach([ApplicationStatus.applied, .interview, .saved, .rejected]) { status in
                            Card(radius: Radius.row, padding: 16) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("\(store.count(of: status))")
                                        .font(Font2.heroValue)
                                        .foregroundStyle(Palette.ink)
                                        .monospacedDigit()
                                    HStack(spacing: 6) {
                                        Circle()
                                            .fill(status.tint.fg)
                                            .frame(width: 6, height: 6)
                                        Text(status.label)
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundStyle(Palette.ink500)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .padding(.bottom, 20)

                    Card(radius: Radius.card, padding: 6) {
                        VStack(spacing: 0) {
                            SettingsRow(
                                symbol: "globe", tint: .indigo,
                                title: String(localized: "App language"),
                                subtitle: String(localized: "Applies after relaunch"),
                                action: nil
                            ) {
                                Menu {
                                    Picker("App language", selection: $language) {
                                        ForEach(AppLanguage.allCases) { option in
                                            Text(option.label).tag(option)
                                        }
                                    }
                                } label: {
                                    HStack(spacing: 5) {
                                        Text(language.label)
                                            .lineLimit(1)
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.system(size: 9, weight: .semibold))
                                    }
                                    .fixedSize()
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Palette.ink600)
                                    .padding(.horizontal, 11)
                                    .padding(.vertical, 7)
                                    .background(Palette.tile, in: .capsule)
                                }
                                .padding(.trailing, 6)
                                .onChange(of: language) { _, next in next.apply() }
                            }
                        }
                    }
                    .padding(.bottom, 16)

                    Card(radius: Radius.card, padding: 6) {
                        VStack(spacing: 0) {
                            SettingsRow(
                                symbol: "doc.text", tint: .blue,
                                title: String(localized: "Résumé & details"),
                                subtitle: String(localized: "Edit on the web")
                            ) { openURL(webURL) }

                            SettingsRow(
                                symbol: "sparkles", tint: .purple,
                                title: String(localized: "AI & API keys"),
                                subtitle: String(localized: "OpenRouter · managed on the web")
                            ) { openURL(webURL) }

                            SettingsRow(
                                symbol: "envelope", tint: .orange,
                                title: "Gmail",
                                subtitle: String(localized: "Auto-tracks replies and interviews"),
                                action: nil
                            ) {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(Palette.teal)
                                        .frame(width: 7, height: 7)
                                    Text("Connected")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Palette.teal)
                                }
                                .padding(.trailing, 6)
                            }
                        }
                    }
                    .padding(.bottom, 16)

                    Card(radius: Radius.card, padding: 6) {
                        VStack(spacing: 0) {
                            SettingsRow(
                                symbol: "arrow.clockwise", tint: .teal,
                                title: String(localized: "Refresh data"),
                                subtitle: catalogSummary
                            ) {
                                Task { await store.load() }
                            }
                            SettingsRow(
                                symbol: "safari", tint: .indigo,
                                title: String(localized: "Open the web portal"),
                                subtitle: "portal.mohamedfuad.com"
                            ) { openURL(webURL) }
                        }
                    }
                    .padding(.bottom, 16)

                    Card(radius: Radius.card, padding: 6) {
                        SettingsRow(
                            symbol: "rectangle.portrait.and.arrow.right", tint: .gray,
                            title: String(localized: "Sign out"),
                            subtitle: auth.email,
                            action: { confirmSignOut = true }
                        ) { EmptyView() }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
            .background(Palette.canvas)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { auth.signOut() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your applications stay in your account — nothing is deleted.")
            }
        }
    }

    /// Identity card: one tap opens the profile editor — no icon confetti on the
    /// card itself, just a chevron like every other row that goes somewhere.
    private var identityCard: some View {
        NavigationLink {
            EditProfileView(avatar: $avatar)
        } label: {
            Card(radius: Radius.hero, padding: 20) {
                HStack(spacing: 16) {
                    AvatarView(avatar: avatar, initials: initials, size: 64)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(name)
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Palette.ink)
                            .lineLimit(1)
                        if let email = auth.email {
                            Label(email, systemImage: "envelope")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Palette.ink500)
                                .lineLimit(1)
                        }
                        // Says where the data on screen actually comes from,
                        // so an empty list is never a mystery.
                        Label(
                            store.isCloudBacked
                                ? String(localized: "Synced with the web app")
                                : String(localized: "Local data only"),
                            systemImage: store.isCloudBacked ? "checkmark.icloud" : "externaldrive"
                        )
                        .font(.system(size: 11))
                        .foregroundStyle(store.isCloudBacked ? Palette.teal : Palette.ink400)
                    }
                    Spacer(minLength: 0)
                    Chevron()
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(String(localized: "Edit profile"))
    }

    private var catalogSummary: String {
        switch store.phase {
        case .loading: String(localized: "Refreshing…")
        case .failed: String(localized: "Last attempt failed")
        default: String(localized: "\(store.internships.count) roles · \(store.tracker.count) tracked")
        }
    }
}

/// The avatar as it renders on cards: photo when set, initials otherwise.
struct AvatarView: View {
    var avatar: UIImage?
    var initials: String
    var size: CGFloat

    var body: some View {
        Group {
            if let avatar {
                Image(uiImage: avatar)
                    .resizable()
                    .scaledToFill()
            } else {
                Palette.teal50.overlay {
                    Text(initials)
                        .font(.system(size: size * 0.31, weight: .bold))
                        .foregroundStyle(Palette.teal)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(.rect(cornerRadius: size * 0.31, style: .continuous))
    }
}

/// The profile editor — its own page, so the Settings card stays clean.
/// Photo is device-local (AvatarStore); the name writes through to Firebase.
struct EditProfileView: View {
    @Environment(AuthService.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @Binding var avatar: UIImage?
    @State private var photoItem: PhotosPickerItem?
    @State private var name = ""
    @State private var saving = false

    private var initials: String {
        let source = name.isEmpty ? (auth.email ?? "?") : name
        let parts = source.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }

    /// Saving is only offered when there is something to save.
    private var nameChanged: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed != (auth.displayName ?? "")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // The photo IS the button — tapping your own face to change it
                // is the convention every profile screen has taught.
                PhotosPicker(selection: $photoItem, matching: .images) {
                    AvatarView(avatar: avatar, initials: initials, size: 112)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "Change photo"))

                HStack(spacing: 18) {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Text("Change photo")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Palette.teal)
                    }
                    .buttonStyle(.plain)

                    if avatar != nil {
                        Button {
                            AvatarStore.clear()
                            avatar = nil
                        } label: {
                            Text("Remove photo")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Palette.ink400)
                        }
                        .buttonStyle(.plain)
                    }
                }

                Card(radius: Radius.card, padding: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Your name")
                            .font(Font2.micro)
                            .foregroundStyle(Palette.ink400)
                        TextField(String(localized: "Your name"), text: $name)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .submitLabel(.done)
                    }
                }

                Text("Shown in the greeting and on this card.")
                    .font(Font2.caption)
                    .foregroundStyle(Palette.ink500)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)

                Spacer(minLength: 0)
            }
            .padding(20)
        }
        .scrollIndicators(.hidden)
        .background(Palette.canvas)
        .navigationTitle(Text("Edit profile"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    saving = true
                    Task {
                        await auth.updateDisplayName(name)
                        saving = false
                        dismiss()
                    }
                } label: {
                    if saving {
                        ProgressView()
                    } else {
                        Text("Save").fontWeight(.semibold)
                    }
                }
                .disabled(!nameChanged || saving)
            }
        }
        .onAppear { name = auth.displayName ?? "" }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    avatar = AvatarStore.save(data)
                }
                photoItem = nil
            }
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Settings") {
    SettingsView()
        .environment(CatalogStore.preview)
        .environment(AuthService())
}

#Preview("Edit profile") {
    @Previewable @State var avatar: UIImage?
    NavigationStack { EditProfileView(avatar: $avatar) }
        .environment(AuthService())
}
#endif
