// Internship detail — the web's drawer, as a pushed screen. Same sections in the
// same order: header with match, tag chips, about, why-it-fits, tech stack,
// eligibility, and the one blue primary action (Apply).
import SwiftUI

struct InternshipDetailView: View {
    let item: Internship

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                tagChips

                if let about = item.about {
                    section("What the internship is about") {
                        Text(about).font(.subheadline).foregroundStyle(Theme.muted)
                    }
                }

                if let reasons = item.reasons, !reasons.isEmpty {
                    section("Why this is a strong fit") {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(reasons, id: \.self) { reason in
                                Label {
                                    Text(reason).font(.subheadline).foregroundStyle(Theme.ink)
                                } icon: {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.ink)
                                }
                            }
                        }
                    }
                }

                if let stack = item.techStack, !stack.isEmpty {
                    section("Tech stack / likely tools") {
                        FlowChips(items: stack)
                    }
                }

                if let auth = item.workAuth {
                    section("Eligibility") {
                        Text(auth).font(.subheadline).foregroundStyle(Theme.muted)
                    }
                }

                if let verified = item.verifiedDate {
                    Text("Link verified \(verified). Openings can close without notice.")
                        .font(.caption2)
                        .foregroundStyle(Theme.faint)
                }
            }
            .padding()
            .padding(.bottom, 80)
        }
        .background(Theme.canvas)
        .navigationTitle(item.displayCompany)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if let url = item.url.flatMap(URL.init) {
                Link(destination: url) {
                    Label("Apply now", systemImage: "arrow.up.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 34)
                }
                .buttonStyle(.glassProminent)
                .tint(Theme.accent)
                .padding(.horizontal)
                .padding(.bottom, 6)
            }
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            CompanyMark(item: item)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayCompany)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.ink)
                Text(item.displayRole)
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            if let score = item.score {
                VStack(spacing: 0) {
                    Text("\(score)%")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.match)
                    Text(score >= 90 ? "Excellent" : score >= 80 ? "Strong" : "Worth a look")
                        .font(.caption2)
                        .foregroundStyle(Theme.faint)
                }
            }
        }
    }

    private var tagChips: some View {
        FlowChips(items: [
            item.displayLocation,
            item.language,
            item.duration,
            item.deadline.map { "Deadline: \($0)" },
        ].compactMap { $0 })
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.ink)
            content()
        }
    }
}

// Small glass chips that wrap — the detail drawer's tag rows.
struct FlowChips: View {
    let items: [String]

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { text in
                Text(text)
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 6)
                    .glassEffect(.regular, in: .capsule)
            }
        }
    }
}

// Minimal wrapping layout for the chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal: proposal, subviews: subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placement = arrange(proposal: proposal, subviews: subviews)
        for (subview, point) in zip(subviews, placement.points) {
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var points: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, width: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            width = max(width, x - spacing)
        }
        return (CGSize(width: width, height: y + rowHeight), points)
    }
}

#Preview {
    NavigationStack {
        InternshipDetailView(item: Internship(
            id: "preview", company: "HENNGE", role: "Global Internship Program — Front-End Pathway",
            location: "Shibuya, Tokyo, Japan", city: "Tokyo", workMode: "On-site",
            language: "English (fluent)", languageType: "English-first", duration: "5 weeks",
            deadline: "Rolling", deadlineDate: nil, compensation: nil, track: "Frontend",
            score: 99, priority: true,
            reasons: ["Exact React 19 and TypeScript fit", "English-first Tokyo program"],
            fitNote: nil, url: "https://recruit.hennge.com/en/gip/", sourceUrl: nil,
            companyDomain: "hennge.com", logoUrl: nil, verifiedDate: "2026-06-27",
            prestigeTier: "Tier 1 Japan tech",
            about: "Frontend pathway for building TypeScript applications with React or Vue.",
            aboutJa: nil, techStack: ["TypeScript", "React or Vue", "Git"], workAuth: "Third-year undergraduate or higher"
        ))
    }
}
