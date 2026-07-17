// The internship detail sheet — the phone equivalent of the web's DetailPanel
// drawer (InternshipDashboard.jsx). Reference: InternshipModal (85% height,
// rounded-t-[32px], sticky header, Apply pinned to the bottom).
import SwiftUI

struct InternshipSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var item: Internship
    @State private var showInterviewPrompt = false

    private var status: ApplicationStatus? { store.status(for: item.id) }

    var body: some View {
        SheetShell(
            mark: AnyView(CompanyMark(company: item.displayCompany, candidates: item.logoCandidates, size: 48)),
            action: { applyButton }
        ) {
            VStack(alignment: .leading, spacing: 0) {
                if let score = item.score {
                    HStack(spacing: 5) {
                        Image(systemName: "sparkles").font(.system(size: 11))
                        Text("\(score)% match")
                    }
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Palette.teal)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Palette.teal50, in: .rect(cornerRadius: 6, style: .continuous))
                    .padding(.bottom, 12)
                }

                Text(item.displayRole)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(item.displayCompany)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.ink600)
                    .padding(.top, 4)

                FlowFacts(item: item)
                    .padding(.top, 16)

                StatusPicker(current: status) { next in
                    Task {
                        await store.setStatus(next, for: item)
                        if next == .interview { showInterviewPrompt = true }
                    }
                }
                .padding(.top, 20)

                if let about = item.about, !about.isEmpty {
                    SheetSection(title: String(localized: "About the role")) {
                        Text(about)
                            .font(Font2.body)
                            .foregroundStyle(Palette.ink600)
                            .lineSpacing(4)
                    }
                }

                if let reasons = item.reasons, !reasons.isEmpty {
                    SheetSection(title: String(localized: "Why this fits")) {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(reasons, id: \.self) { reason in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 14))
                                        .foregroundStyle(Palette.teal)
                                    Text(reason)
                                        .font(Font2.body)
                                        .foregroundStyle(Palette.ink600)
                                }
                            }
                        }
                    }
                }

                if let stack = item.techStack, !stack.isEmpty {
                    SheetSection(title: String(localized: "Tech stack")) {
                        FlowChips(items: stack)
                    }
                }

                if let eligibility = item.eligibility, !eligibility.isEmpty {
                    SheetSection(title: String(localized: "Eligibility")) {
                        BulletList(items: eligibility)
                    }
                }

                if let process = item.process, !process.isEmpty {
                    SheetSection(title: String(localized: "Selection process")) {
                        BulletList(items: process, numbered: true)
                    }
                }

                SheetSection(title: String(localized: "Details")) {
                    VStack(spacing: 0) {
                        DetailLine(label: String(localized: "Deadline"), value: item.shortDeadline)
                        if let compensation = item.compensation, !compensation.isEmpty {
                            DetailLine(label: String(localized: "Compensation"), value: compensation)
                        }
                        if let verified = item.verifiedDate {
                            DetailLine(label: String(localized: "Verified"), value: verified)
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showInterviewPrompt) {
            InterviewDateSheet(recordId: item.id, company: item.displayCompany)
        }
    }

    @ViewBuilder private var applyButton: some View {
        if let link = item.url, let url = URL(string: link) {
            Button {
                openURL(url)
            } label: {
                HStack(spacing: 8) {
                    Text("Apply now")
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 14, weight: .semibold))
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Palette.ink, in: .rect(cornerRadius: Radius.row, style: .continuous))
                .floatShadow()
            }
            .buttonStyle(.plain)
        }
    }
}

/// The Applications-tab counterpart: a tracked record, which may be a Gmail-synthesised
/// row with no catalog entry behind it — so every catalog-only block is guarded.
struct RecordSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.openURL) private var openURL

    var record: TrackerRecord
    @State private var showInterviewPrompt = false

    /// The catalog entry behind this record, when there is one.
    private var catalogItem: Internship? {
        store.internships.first { $0.id == record.internshipId }
    }

    var body: some View {
        SheetShell(
            mark: AnyView(CompanyMark(company: record.displayCompany, candidates: store.logoCandidates(for: record), size: 48)),
            action: { applyButton }
        ) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    StatusChip(status: record.appStatus)
                    if record.fromGmail {
                        HStack(spacing: 5) {
                            Image(systemName: "envelope.fill").font(.system(size: 9))
                            Text("From Gmail")
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Palette.ink500)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Palette.hairline, in: .rect(cornerRadius: 6, style: .continuous))
                    }
                }
                .padding(.bottom, 12)

                Text(record.displayRole)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(record.displayCompany)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Palette.ink600)
                    .padding(.top, 4)

                HStack(spacing: 16) {
                    Label(record.displayLocation, systemImage: "mappin.and.ellipse")
                    Label(record.appliedAgo, systemImage: "clock")
                }
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Palette.ink500)
                .padding(.top, 16)

                StatusPicker(current: record.appStatus, allowsClear: false) { next in
                    Task {
                        guard let next else { return }
                        await store.setStatus(next, forRecord: record.id)
                        if next == .interview { showInterviewPrompt = true }
                    }
                }
                .padding(.top, 20)

                let milestones = record.milestones ?? []
                if !milestones.isEmpty {
                    SheetSection(title: String(localized: "Timeline")) {
                        VStack(spacing: 10) {
                            ForEach(milestones) { milestone in
                                HStack(spacing: 12) {
                                    IconTile(symbol: "calendar", tint: milestone.tint, size: 34, glyph: 14)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(milestone.title?.isEmpty == false ? milestone.title! : milestone.kindLabel)
                                            .font(Font2.cardTitle)
                                            .foregroundStyle(Palette.ink)
                                        Text([milestone.date, milestone.time].compactMap { $0 }.joined(separator: " · "))
                                            .font(Font2.caption)
                                            .foregroundStyle(Palette.ink400)
                                    }
                                    Spacer()
                                    Button {
                                        Task { await store.removeMilestone(milestone.id, from: record.id) }
                                    } label: {
                                        Image(systemName: "trash")
                                            .font(.system(size: 12))
                                            .foregroundStyle(Palette.ink300)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Delete \(milestone.kindLabel)")
                                }
                            }
                        }
                    }
                }

                if let item = catalogItem {
                    if let about = item.about, !about.isEmpty {
                        SheetSection(title: String(localized: "About the role")) {
                            Text(about)
                                .font(Font2.body)
                                .foregroundStyle(Palette.ink600)
                                .lineSpacing(4)
                        }
                    }
                    if let stack = item.techStack, !stack.isEmpty {
                        SheetSection(title: String(localized: "Tech stack")) { FlowChips(items: stack) }
                    }
                }

                SheetSection(title: String(localized: "Details")) {
                    VStack(spacing: 0) {
                        DetailLine(label: String(localized: "Deadline"), value: record.deadline ?? String(localized: "Not stated"))
                        DetailLine(label: String(localized: "Source"), value: record.fromGmail ? String(localized: "Gmail inbox") : String(localized: "Added in app"))
                    }
                }
            }
        }
        .sheet(isPresented: $showInterviewPrompt) {
            InterviewDateSheet(recordId: record.id, company: record.displayCompany)
        }
    }

    @ViewBuilder private var applyButton: some View {
        if let link = record.applyUrl ?? catalogItem?.url, let url = URL(string: link) {
            Button {
                openURL(url)
            } label: {
                HStack(spacing: 8) {
                    Text("Open posting")
                    Image(systemName: "arrow.up.right").font(.system(size: 14, weight: .semibold))
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Palette.ink, in: .rect(cornerRadius: Radius.row, style: .continuous))
                .floatShadow()
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Sheet chrome

/// Shared sheet frame: a header that gains a hairline as content scrolls under it,
/// and a bottom action that floats over a fade. Mirrors InternshipModal.
struct SheetShell<Content: View, Action: View>: View {
    @Environment(\.dismiss) private var dismiss
    var mark: AnyView
    @ViewBuilder var action: () -> Action
    @ViewBuilder var content: () -> Content

    @State private var scrolled = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                mark
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Palette.ink500)
                        .frame(width: 32, height: 32)
                        .background(Palette.hairline, in: .circle)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(alignment: .bottom) {
                Rectangle()
                    .fill(Palette.hairline)
                    .frame(height: 1)
                    .opacity(scrolled ? 1 : 0)
            }

            ScrollView {
                content()
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 120)
                    .onScrollGeometryChange(for: Bool.self) { geometry in
                        geometry.contentOffset.y > 8
                    } action: { _, isScrolled in
                        withAnimation(.easeOut(duration: 0.15)) { scrolled = isScrolled }
                    }
            }
            .scrollIndicators(.hidden)
        }
        .background(Palette.card)
        .overlay(alignment: .bottom) {
            action()
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
                .padding(.top, 40)
                .background {
                    // The fade has to reach the sheet's true bottom edge: the
                    // ScrollView scrolls through the home-indicator inset, so a
                    // safe-area-respecting gradient leaves content visible under
                    // the button.
                    LinearGradient(
                        colors: [Palette.card.opacity(0), Palette.card, Palette.card],
                        startPoint: .top, endPoint: .bottom
                    )
                    .ignoresSafeArea(edges: .bottom)
                    .allowsHitTesting(false)
                }
        }
        .presentationDetents([.fraction(0.88), .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
    }
}

struct SheetSection<Content: View>: View {
    var title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(Font2.sectionTitle)
                .foregroundStyle(Palette.ink)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 24)
    }
}

/// The facts row under the title — location, duration, language.
struct FlowFacts: View {
    var item: Internship

    var body: some View {
        let facts: [(String, String)] = [
            ("mappin.and.ellipse", item.displayLocation),
            ("clock", item.duration ?? "Duration not stated"),
            ("globe", item.language ?? item.languageType ?? "Language not stated"),
        ]

        VStack(alignment: .leading, spacing: 8) {
            ForEach(facts, id: \.1) { symbol, text in
                HStack(spacing: 8) {
                    Image(systemName: symbol)
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.ink400)
                        .frame(width: 16)
                    Text(text)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Palette.ink500)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct FlowChips: View {
    var items: [String]

    var body: some View {
        FlowLayout(spacing: 7) {
            ForEach(items, id: \.self) { text in
                Text(text)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.ink600)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 7)
                    .background(Palette.tile, in: .capsule)
                    .overlay { Capsule().strokeBorder(Palette.hairline, lineWidth: 1) }
            }
        }
    }
}

struct BulletList: View {
    var items: [String]
    var numbered = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, text in
                HStack(alignment: .top, spacing: 10) {
                    if numbered {
                        Text("\(index + 1)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Palette.ink500)
                            .frame(width: 18, height: 18)
                            .background(Palette.hairline, in: .circle)
                    } else {
                        Circle()
                            .fill(Palette.ink400)
                            .frame(width: 5, height: 5)
                            .padding(.top, 7)
                    }
                    Text(text)
                        .font(Font2.body)
                        .foregroundStyle(Palette.ink600)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct DetailLine: View {
    var label: String
    var value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(Font2.caption)
                .foregroundStyle(Palette.ink400)
            Spacer(minLength: 16)
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Palette.ink600)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Palette.hairline).frame(height: 1)
        }
    }
}

/// Status control — the drawer's `<select>`, as an actual selector. The previous
/// horizontal chip row hid "Rejected" off the right edge; a menu shows all five
/// stages at once and states the current one in its own colour.
struct StatusPicker: View {
    var current: ApplicationStatus?
    /// Whether "Not tracked" is offered. Tracked records can move stages but not
    /// silently vanish from the tracker, so sheets over records pass false.
    var allowsClear = true
    var onChange: (ApplicationStatus?) -> Void

    private var selection: Binding<ApplicationStatus?> {
        Binding(get: { current }, set: { next in
            guard next != current else { return }
            onChange(next)
        })
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Status")
                    .font(Font2.cardTitle)
                    .foregroundStyle(Palette.ink)
                Text("Where this application stands")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.ink400)
            }

            Spacer(minLength: 8)

            Menu {
                Picker("Status", selection: selection) {
                    if allowsClear {
                        Label("Not tracked", systemImage: "minus.circle")
                            .tag(ApplicationStatus?.none)
                    }
                    ForEach(ApplicationStatus.allCases) { status in
                        Label(status.label, systemImage: status.icon)
                            .tag(ApplicationStatus?.some(status))
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    if let current {
                        Circle()
                            .fill(current.tint.fg)
                            .frame(width: 6, height: 6)
                        Text(current.label)
                    } else {
                        Text("Set status")
                    }
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(current == nil ? Palette.ink400 : current!.tint.fg.opacity(0.7))
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(current?.tint.fg ?? Palette.ink600)
                .padding(.horizontal, 13)
                .padding(.vertical, 9)
                .background(current?.tint.bg ?? Palette.hairline, in: .capsule)
            }
            .accessibilityLabel("Status: \(current?.label ?? "not tracked")")
        }
        .padding(12)
        .background(Palette.tile, in: .rect(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Palette.hairline, lineWidth: 1)
        }
    }
}

/// Minimal flow layout for chips — no dependency, wraps on width.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0; y += rowHeight + spacing; rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX; y += rowHeight + spacing; rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Detail sheet — full listing") {
    InternshipSheet(item: .sampleHennge)
        .environment(CatalogStore.previewEmpty)
}

#Preview("Detail sheet — sparse listing") {
    // Live-researched rows carry far fewer fields; every optional block must
    // vanish cleanly rather than leave a titled empty section.
    InternshipSheet(item: .sampleAtilika)
        .environment(CatalogStore.previewEmpty)
}

#Preview("Record sheet — Gmail-sourced") {
    RecordSheet(record: .sampleInterview)
        .environment(CatalogStore.preview)
}
#endif
