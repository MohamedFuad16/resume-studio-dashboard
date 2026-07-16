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
    /// Fill of the small value chips ("50 min") — a touch deeper than the canvas.
    static let chipFill = Color(red: 0.937, green: 0.945, blue: 0.953) // #EFF1F3

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
    // The reference's exact families: periwinkle-indigo and violet carry most
    // rows, peach is the warm voice, sky the cool one. GREEN IS NOT A TILE —
    // in the reference it appears only as the accent (focus icon, Start,
    // presence dot), so tileGreen exists but stays out of the rotation.
    struct Tile { let fill: Color; let glyph: Color }
    static let tileIndigo = Tile(fill: Color(red: 0.906, green: 0.922, blue: 0.988),   // #E7EBFC
                                 glyph: Color(red: 0.345, green: 0.396, blue: 0.910))  // #5865E8
    static let tileViolet = Tile(fill: Color(red: 0.929, green: 0.906, blue: 0.984),   // #EDE7FB
                                 glyph: Color(red: 0.545, green: 0.361, blue: 0.965))  // #8B5CF6
    static let tilePeach = Tile(fill: Color(red: 0.992, green: 0.922, blue: 0.855),    // #FDEBDA
                                glyph: Color(red: 0.910, green: 0.522, blue: 0.239))   // #E8853D
    static let tileSky = Tile(fill: Color(red: 0.882, green: 0.929, blue: 0.984),      // #E1EDFB
                              glyph: Color(red: 0.290, green: 0.525, blue: 0.933))     // #4A86EE
    static let tileGreen = Tile(fill: Color(red: 0.871, green: 0.937, blue: 0.898),
                                glyph: Color(red: 0.298, green: 0.686, blue: 0.510))
    static let tileLavender = tileViolet
    static let tiles: [Tile] = [tileIndigo, tileViolet, tilePeach, tileSky]

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
