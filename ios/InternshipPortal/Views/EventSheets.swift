// Two small sheets: adding a calendar event, and the interview-date prompt that
// fires when a role moves to Interview.
// Web counterparts: ApplicationCalendar.jsx's event form, InterviewDateModal.jsx.
import SwiftUI

/// The event kinds the web form offers, in the same order.
enum EventKind: String, CaseIterable, Identifiable {
    case interview
    case codingTest = "coding-test"
    case applicationSubmitted = "application-submitted"
    case followUp = "follow-up"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .interview: "Interview"
        case .codingTest: "Coding test"
        case .applicationSubmitted: "Application submitted"
        case .followUp: "Follow-up"
        case .other: "Other"
        }
    }

    var symbol: String {
        switch self {
        case .interview: "calendar.badge.clock"
        case .codingTest: "chevron.left.forwardslash.chevron.right"
        case .applicationSubmitted: "paperplane"
        case .followUp: "arrow.uturn.right"
        case .other: "circle"
        }
    }
}

struct AddEventSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var recordId = ""
    @State private var kind: EventKind = .interview
    @State private var date = Date()
    @State private var includeTime = true
    @State private var time = Date()
    @State private var title = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Company") {
                    Picker("Application", selection: $recordId) {
                        Text("Choose…").tag("")
                        ForEach(store.records) { record in
                            Text(record.displayCompany).tag(record.id)
                        }
                    }
                }

                Section("Event") {
                    Picker("Type", selection: $kind) {
                        ForEach(EventKind.allCases) { option in
                            Label(option.label, systemImage: option.symbol).tag(option)
                        }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Toggle("Set a time", isOn: $includeTime.animation(.easeOut(duration: 0.15)))
                    if includeTime {
                        DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                    }
                }

                Section {
                    TextField("Note (optional)", text: $title)
                } header: {
                    Text("Note")
                } footer: {
                    Text("Times are Asia/Tokyo, matching the deadlines the portal tracks.")
                }
            }
            .navigationTitle("Add event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .fontWeight(.semibold)
                        .disabled(recordId.isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(Radius.sheet)
        .onAppear { recordId = store.records.first?.id ?? "" }
    }

    private func save() {
        let milestone = Milestone(
            id: "ios-\(UUID().uuidString)",
            kind: kind.rawValue,
            date: CatalogStore.dayKey(date),
            time: includeTime ? Self.timeString(time) : nil,
            title: title.isEmpty ? kind.label : title
        )
        let target = recordId
        Task {
            await store.addMilestone(milestone, to: target)
            store.toast = "Event added"
        }
        dismiss()
    }

    static func timeString(_ date: Date) -> String {
        let parts = CatalogStore.tokyoCalendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }
}

/// Fires right after a role moves to Interview: the one moment the user actually
/// knows the date, so ask then rather than making them find the calendar later.
struct InterviewDateSheet: View {
    @Environment(CatalogStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var recordId: String
    var company: String

    @State private var date = Date()
    @State private var includeTime = true
    @State private var time = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Toggle("Set a time", isOn: $includeTime.animation(.easeOut(duration: 0.15)))
                    if includeTime {
                        DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Text("Interview with \(company)")
                } footer: {
                    Text("This lands on your calendar. You can skip and add it later.")
                }
            }
            .navigationTitle("Add interview date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }.fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationCornerRadius(Radius.sheet)
    }

    private func save() {
        let milestone = Milestone(
            id: "ios-\(UUID().uuidString)",
            kind: "interview",
            date: CatalogStore.dayKey(date),
            time: includeTime ? AddEventSheet.timeString(time) : nil,
            title: "Interview — \(company)"
        )
        Task {
            await store.addMilestone(milestone, to: recordId)
            store.toast = "Interview added to your calendar"
        }
        dismiss()
    }
}

// MARK: - Previews

#if DEBUG
#Preview("Add event") {
    AddEventSheet().environment(CatalogStore.preview)
}

#Preview("Interview date") {
    InterviewDateSheet(recordId: "jp-hennge-01", company: "HENNGE")
        .environment(CatalogStore.preview)
}
#endif
