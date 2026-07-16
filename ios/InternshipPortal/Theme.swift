// The iOS app's design language — the task-planner reference: white cards on a
// near-white canvas, near-black ink, pastel circular icon tiles, thin outlined
// chips, and ONE saturated green accent (the "Start" green) used sparingly for
// actions and positives. This deliberately diverges from the web's
// blue-on-neutral tokens; the login screen alone keeps its warm paper + black.
import SwiftUI

enum Theme {
    // ── Canvas & surfaces ────────────────────────────────────────────────
    /// App background — the near-white canvas behind everything.
    static let canvas = Color(red: 0.961, green: 0.965, blue: 0.969)   // #F5F6F7
    /// Cards are plain white; depth comes from air and soft shadows, not borders.
    static let card = Color.white
    /// Hairline used on outlined chips.
    static let chipLine = Color(red: 0.902, green: 0.910, blue: 0.918) // #E6E8EA

    // ── Ink ──────────────────────────────────────────────────────────────
    /// Primary text — near-black neutral ink.
    static let ink = Color(red: 0.086, green: 0.098, blue: 0.110)      // #16191C
    /// Secondary text.
    static let muted = Color(red: 0.529, green: 0.553, blue: 0.576)    // #878D93
    /// Tertiary text.
    static let faint = Color(red: 0.718, green: 0.737, blue: 0.757)    // #B7BCC1

    // ── Accents ──────────────────────────────────────────────────────────
    /// THE accent — the saturated green of the reference's Start button.
    /// Primary actions and the match score only.
    static let accent = Color(red: 0.184, green: 0.710, blue: 0.420)   // #2FB56B
    /// Warm orange — streaks, urgency, deadlines (the reference's second voice).
    static let ember = Color(red: 0.910, green: 0.522, blue: 0.239)    // #E8853D
    /// Kept for the match percent (reads as the accent green).
    static let match = accent
    /// Deadline badges lean on ember now, not red.
    static let deadline = ember
    /// Login keeps the web's warm paper — it is its own little world.
    static let paper = Color(red: 0xF1 / 255, green: 0xF0 / 255, blue: 0xEE / 255)

    // ── Pastel tiles (icon backgrounds) with their glyph colors ──────────
    struct Tile { let fill: Color; let glyph: Color }
    static let tileGreen = Tile(fill: Color(red: 0.871, green: 0.937, blue: 0.898),
                                glyph: Color(red: 0.298, green: 0.686, blue: 0.510))
    static let tileLavender = Tile(fill: Color(red: 0.914, green: 0.902, blue: 0.980),
                                   glyph: Color(red: 0.545, green: 0.498, blue: 0.839))
    static let tilePeach = Tile(fill: Color(red: 0.984, green: 0.914, blue: 0.843),
                                glyph: Color(red: 0.910, green: 0.522, blue: 0.239))
    static let tileSky = Tile(fill: Color(red: 0.886, green: 0.929, blue: 0.984),
                              glyph: Color(red: 0.357, green: 0.553, blue: 0.937))
    static let tiles: [Tile] = [tileGreen, tileLavender, tilePeach, tileSky]

    /// Stable pastel pick for a company name — the reference varies its row
    /// icons across the pastel set; hashing keeps a company's color steady.
    static func tile(for name: String) -> Tile {
        tiles[abs(name.hashValue) % tiles.count]
    }

    // ── Shape ────────────────────────────────────────────────────────────
    /// Cards — the reference's big soft corners.
    static let cardRadius: CGFloat = 22
    /// Small tiles and inner elements.
    static let tileRadius: CGFloat = 14
}

// One soft shadow, used everywhere a card floats.
extension View {
    func cardShadow() -> some View {
        shadow(color: Theme.ink.opacity(0.05), radius: 14, y: 6)
    }
}
