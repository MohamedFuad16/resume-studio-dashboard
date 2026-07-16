// Profile + Settings — the reference's ProfileTab, presented from Home's Profile
// card rather than occupying a tab (the four tabs are the app's real work).
// Web counterparts: ProfileView.jsx + SettingsPanel.jsx.
import SwiftUI

struct ProfileSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private let webURL = URL(string: "https://portal.mohamedfuad.com")!

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Card(radius: Radius.hero, padding: 20) {
                        HStack(spacing: 16) {
                            RoundedRectangle(cornerRadius: Radius.avatar, style: .continuous)
                                .fill(Palette.teal50)
                                .frame(width: 64, height: 64)
                                .overlay {
                                    Text("MF")
                                        .font(.system(size: 20, weight: .bold))
                                        .foregroundStyle(Palette.teal)
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Mohamed Fuad")
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(Palette.ink)
                                Label("Tokyo, Japan", systemImage: "mappin.and.ellipse")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Palette.ink500)
                                Label("Tokai University (Mar 2028)", systemImage: "graduationcap")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Palette.ink400)
                            }
                            Spacer(minLength: 0)
                        }
                    }
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
                                symbol: "doc.text", tint: .blue,
                                title: "Résumé & details",
                                subtitle: "Edit on the web"
                            ) { openURL(webURL) }

                            SettingsRow(
                                symbol: "sparkles", tint: .purple,
                                title: "AI & API keys",
                                subtitle: "OpenRouter · managed on the web"
                            ) { openURL(webURL) }

                            SettingsRow(
                                symbol: "envelope", tint: .orange,
                                title: "Gmail",
                                subtitle: "Auto-tracks replies and interviews",
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
                                title: "Refresh data",
                                subtitle: catalogSummary
                            ) {
                                Task { await store.load() }
                            }
                            SettingsRow(
                                symbol: "safari", tint: .indigo,
                                title: "Open the web portal",
                                subtitle: "portal.mohamedfuad.com"
                            ) { openURL(webURL) }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
            .background(Palette.canvas)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
        .presentationCornerRadius(Radius.sheet)
    }

    private var catalogSummary: String {
        switch store.phase {
        case .loading: "Refreshing…"
        case .failed: "Last attempt failed"
        default: "\(store.internships.count) roles · \(store.tracker.count) tracked"
        }
    }
}
