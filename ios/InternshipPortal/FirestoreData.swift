// Firestore-backed tracker, mirroring editor/src/data/firestoreData.js so the phone
// and the web read and write the same documents.
//
// Data model (per user), fixed by the web app and the deployed owner-only rules:
//   users/{uid}/profiles/{profileId}     { name, resume, createdAt, updatedAt }
//   users/{uid}/trackers/{profileId}     { data: <tracker map>, updatedAt }
//   users/{uid}/applications/{profileId} { items: [...], updatedAt }
//
// The internship catalog stays on the Express/Azure server — it is global, not
// per-user, and is not mirrored into Firestore.
import FirebaseFirestore
import Foundation

struct FirestoreData {
    private static var db: Firestore { Firestore.firestore() }

    /// The web seeds owner accounts with profile id `mohamed_fuad` and everyone
    /// else with `primary` (firestoreData.js). Read the real list rather than
    /// assuming either, so this can't silently look at the wrong document.
    static func listProfileIDs(uid: String) async throws -> [String] {
        let snapshot = try await db.collection("users").document(uid)
            .collection("profiles").getDocuments()
        return snapshot.documents.map(\.documentID).sorted()
    }

    /// Picks the profile whose tracker we should show. Prefers the owner seed, then
    /// the web's default, then whatever exists.
    static func defaultProfileID(uid: String) async throws -> String? {
        let ids = try await listProfileIDs(uid: uid)
        if ids.contains("mohamed_fuad") { return "mohamed_fuad" }
        if ids.contains("primary") { return "primary" }
        return ids.first
    }

    // MARK: - Tracker

    /// `users/{uid}/trackers/{profileId}` stores the whole tracker map under `data`.
    static func fetchTracker(uid: String, profile: String) async throws -> [String: TrackerRecord] {
        let snapshot = try await db.collection("users").document(uid)
            .collection("trackers").document(profile).getDocument()
        guard let raw = snapshot.data()?["data"] as? [String: Any] else { return [:] }

        // Decode record-by-record: one malformed row (a hand-edited document, an
        // older schema) must not blank the whole tracker.
        var out: [String: TrackerRecord] = [:]
        for (key, value) in raw {
            guard let dict = value as? [String: Any] else { continue }
            do {
                let data = try JSONSerialization.data(withJSONObject: sanitize(dict))
                out[key] = try JSONDecoder().decode(TrackerRecord.self, from: data)
            } catch {
                continue
            }
        }
        return out
    }

    static func saveTracker(_ tracker: [String: TrackerRecord], uid: String, profile: String) async throws {
        var payload: [String: Any] = [:]
        for (key, record) in tracker {
            let data = try JSONEncoder().encode(record)
            payload[key] = try JSONSerialization.jsonObject(with: data)
        }
        try await db.collection("users").document(uid)
            .collection("trackers").document(profile)
            .setData(["data": payload, "updatedAt": FieldValue.serverTimestamp()])
    }

    // MARK: - Profile identity

    /// The résumé's personal block, for the Profile sheet's name/location line.
    static func fetchPersonal(uid: String, profile: String) async throws -> [String: String] {
        let snapshot = try await db.collection("users").document(uid)
            .collection("profiles").document(profile).getDocument()
        guard let resume = snapshot.data()?["resume"] as? [String: Any],
              let personal = resume["personal"] as? [String: Any] else { return [:] }
        return personal.compactMapValues { $0 as? String }
    }

    // MARK: - Per-user settings (users/{uid}/settings/app)
    // Same document the web's SettingsPanel reads/writes: the OpenRouter key and
    // the two model slugs. Owner-only rules apply; nothing here is server-visible
    // except when the client sends the key with a research request.

    struct AppSettings {
        var hasKey: Bool
        var searchModel: String
        var auditModel: String
    }

    static func fetchSettings(uid: String) async throws -> AppSettings {
        let snapshot = try await db.collection("users").document(uid)
            .collection("settings").document("app").getDocument()
        let data = snapshot.data() ?? [:]
        return AppSettings(
            hasKey: !(String(describing: data["openrouterKey"] ?? "").isEmpty
                      || data["openrouterKey"] == nil),
            searchModel: data["searchModel"] as? String ?? "",
            auditModel: data["auditModel"] as? String ?? ""
        )
    }

    /// Merge-writes only the provided fields, exactly like the web's saveSettings.
    static func saveSettings(uid: String, key: String?, searchModel: String?, auditModel: String?) async throws {
        var patch: [String: Any] = ["updatedAt": FieldValue.serverTimestamp()]
        if let key, !key.isEmpty { patch["openrouterKey"] = key }
        if let searchModel { patch["searchModel"] = searchModel }
        if let auditModel { patch["auditModel"] = auditModel }
        try await db.collection("users").document(uid)
            .collection("settings").document("app")
            .setData(patch, merge: true)
    }

    /// Firestore hands back Timestamp/NSNull/NSNumber, none of which
    /// JSONSerialization will accept. Flatten to JSON-safe values.
    private static func sanitize(_ value: Any) -> Any {
        switch value {
        case let timestamp as Timestamp:
            return ISO8601DateFormatter.flexible.string(from: timestamp.dateValue())
        case is NSNull:
            return NSNull()
        case let dict as [String: Any]:
            return dict.mapValues(sanitize)
        case let array as [Any]:
            return array.map(sanitize)
        default:
            return value
        }
    }
}
