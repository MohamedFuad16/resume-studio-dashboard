// Design tokens — ported 1:1 from the reference React app (src/App.tsx).
//
// Every value here has a counterpart in that file; when the web theme moves, this
// is the only file that should need editing. Tailwind's slate/teal/etc. ramps are
// spelled out as literal hex so nothing depends on a Tailwind build.
//
// TYPEFACE NOTE: the reference loads Inter. iOS ships SF Pro, which shares Inter's
// grotesque skeleton and metrics closely enough that bundling a webfont buys
// nothing but licence surface and a slower launch. Sizes/weights/tracking below
// mirror the reference exactly.
import SwiftUI

enum Palette {
    // Ground & surface
    static let canvas = Color(hex: 0xF4F7F6)   // phone background
    static let card = Color.white
    static let hairline = Color(hex: 0xF1F5F9) // slate-100
    static let tile = Color(hex: 0xF8FAFC)     // slate-50

    // Ink (Tailwind slate ramp)
    static let ink = Color(hex: 0x0F172A)      // slate-900
    static let ink600 = Color(hex: 0x475569)   // slate-600
    static let ink500 = Color(hex: 0x64748B)   // slate-500
    static let ink400 = Color(hex: 0x94A3B8)   // slate-400
    static let ink300 = Color(hex: 0xCBD5E1)   // slate-300

    // Accent — teal carries "match", the one number the app is really about.
    static let teal = Color(hex: 0x0D9488)     // teal-600
    static let teal50 = Color(hex: 0xF0FDFA)
    static let teal400 = Color(hex: 0x2DD4BF)

    // Feature tints (icon tiles + status chips)
    static let purple = Color(hex: 0x9333EA)
    static let purple50 = Color(hex: 0xFAF5FF)
    static let orange = Color(hex: 0xF97316)
    static let orange50 = Color(hex: 0xFFF7ED)
    static let orange400 = Color(hex: 0xFB923C) // streak flame
    static let orange600 = Color(hex: 0xEA580C)
    static let blue = Color(hex: 0x3B82F6)
    static let blue50 = Color(hex: 0xEFF6FF)
    static let blue600 = Color(hex: 0x2563EB)
    static let indigo = Color(hex: 0x6366F1)
    static let red = Color(hex: 0xEF4444)       // red-500 — the calendar's today

    // The pipeline ramp: slate → amber → sky → violet → rose, walked in stage
    // order so the status donut reads as one family instead of a traffic light.
    static let amber = Color(hex: 0xD97706)
    static let amber50 = Color(hex: 0xFFFBEB)
    static let sky = Color(hex: 0x0284C7)
    static let sky50 = Color(hex: 0xF0F9FF)
    static let violet = Color(hex: 0x7C3AED)
    static let violet50 = Color(hex: 0xF5F3FF)
    static let rose = Color(hex: 0xE11D48)
    static let rose50 = Color(hex: 0xFFF1F2)
}

/// Corner radii, straight from the reference's rounded-[Npx] classes.
enum Radius {
    static let card: CGFloat = 24
    static let row: CGFloat = 20
    static let hero: CGFloat = 28
    static let sheet: CGFloat = 32
    static let nav: CGFloat = 32
    static let tile: CGFloat = 12
    static let logo: CGFloat = 14
    static let avatar: CGFloat = 20
}

/// The reference uses exactly two shadows. Reproducing both keeps cards feeling
/// like paper and the nav feeling like it floats above it.
extension View {
    /// shadow-[0_2px_10px_rgb(0,0,0,0.02)]
    func cardShadow() -> some View {
        shadow(color: .black.opacity(0.02), radius: 5, x: 0, y: 2)
    }

    /// shadow-[0_8px_30px_rgb(0,0,0,0.12)]
    func floatShadow() -> some View {
        shadow(color: .black.opacity(0.12), radius: 15, x: 0, y: 8)
    }
}

/// Type scale — the px sizes the reference sets, as SF Pro.
enum Font2 {
    static func title(_ size: CGFloat = 24) -> Font { .system(size: size, weight: .semibold) }
    static let sectionTitle = Font.system(size: 16, weight: .semibold)
    static let cardTitle = Font.system(size: 14, weight: .medium)
    static let rowTitle = Font.system(size: 14, weight: .semibold)
    static let body = Font.system(size: 14)
    static let caption = Font.system(size: 12)
    static let micro = Font.system(size: 11, weight: .medium)
    static let nano = Font.system(size: 10, weight: .medium)
    static let statValue = Font.system(size: 18, weight: .bold)
    static let heroValue = Font.system(size: 24, weight: .bold)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

/// Maps a model-layer tint (Models.swift stays SwiftUI-free) to real colors.
extension Color6 {
    var fg: Color {
        switch self {
        case .teal: Palette.teal
        case .purple: Palette.purple
        case .orange: Palette.orange600
        case .blue: Palette.blue600
        case .indigo: Palette.indigo
        case .gray: Palette.ink500
        case .amber: Palette.amber
        case .sky: Palette.sky
        case .violet: Palette.violet
        case .rose: Palette.rose
        }
    }

    var bg: Color {
        switch self {
        case .teal: Palette.teal50
        case .purple: Palette.purple50
        case .orange: Palette.orange50
        case .blue: Palette.blue50
        case .indigo: Color(hex: 0xEEF2FF)
        case .gray: Palette.hairline
        case .amber: Palette.amber50
        case .sky: Palette.sky50
        case .violet: Palette.violet50
        case .rose: Palette.rose50
        }
    }
}
