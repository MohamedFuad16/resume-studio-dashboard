// Tap a card, it grows from where it sits into a full-screen sheet; drag down to
// put it back. Ported from the motion of rs-4/labs `card-expand` (React Native
// Reanimated) — the SPEC was ported, not the library. No Skia, no Reanimated,
// nothing added to the project.
//
// WHY NOT `.navigationTransition(.zoom)`: iOS 27's zoom transition gives the
// grow-from-source part and nothing else. The drag physics here are the point —
// the sheet follows your finger at 60% of the translation while scaling down, so
// a dismissal that you change your mind about springs back from wherever it got
// to. A system transition can only be cancelled at its edges.
//
// WHY NOT `matchedGeometryEffect`: it interpolates between two views SwiftUI
// owns, which fights a gesture that has to drive the same geometry. One
// animatable progress value driving an explicit frame is easier to reason about
// and is what the reference does.
//
// The whole animation is ONE value, 0 → 1. Every derived quantity (frame, corner
// radius, the list's scale behind, the body fade) reads it, so open and close can
// never drift apart or land at different times.
import SwiftUI

// MARK: - Motion constants (from the reference; do not "round these off")

enum CardExpandMotion {
    /// Fast start, soft landing, zero bounce — cubic-bezier(0.32, 0.72, 0, 1),
    /// spelled out in each `.timingCurve` below. A spring would overshoot the
    /// device corner radius at the end of the open, which reads as a wobble
    /// against the screen's own corners.
    static let openDuration: TimeInterval = 0.44
    /// Slightly quicker than the open — a dismissal that takes as long as the
    /// presentation feels reluctant.
    static let closeDuration: TimeInterval = 0.38

    static var open: Animation { .timingCurve(0.32, 0.72, 0, 1, duration: openDuration) }
    static var close: Animation { .timingCurve(0.32, 0.72, 0, 1, duration: closeDuration) }
    /// The rubber-band return when a drag is released short of the threshold.
    static var settle: Animation { .timingCurve(0.32, 0.72, 0, 1, duration: 0.22) }

    /// Collapsed corner radius — matches Radius.row so the card's resting state
    /// is indistinguishable from every other card in the list.
    static let collapsedRadius: CGFloat = 28
    /// Expanded corner radius. Deliberately the DISPLAY corner radius, not 0:
    /// full-screen still reads as rounded like the phone itself, which is what
    /// stops it feeling like a modal pasted over the app.
    static let expandedRadius: CGFloat = 55

    /// Drag distance that maps to full shrink, and the floor it shrinks to.
    static let dragRange: CGFloat = 400
    static let dragMinScale: CGFloat = 0.86
    /// Past either of these, the release dismisses instead of springing back.
    static let dismissDistance: CGFloat = 140
    static let dismissVelocity: CGFloat = 900

    /// How far the list behind scales down and fades as the card takes over.
    static let listScaleDrop: CGFloat = 0.05
    static let listFadeDrop: CGFloat = 0.35
}

// MARK: - Source frame reporting

private struct CardFrameKey: PreferenceKey {
    static var defaultValue: [String: CGRect] { [:] }
    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue()) { _, new in new }
    }
}

extension View {
    /// Marks this view as the collapsed source for `id`. The overlay animates
    /// out of the frame reported here, so it must sit on the card itself and not
    /// on a padded wrapper — a mismatch shows as a jump on the first frame.
    func cardExpandSource(_ id: String) -> some View {
        background(
            GeometryReader { proxy in
                Color.clear.preference(
                    key: CardFrameKey.self,
                    value: [id: proxy.frame(in: .named(CardExpandSpace.name))]
                )
            }
        )
    }
}

enum CardExpandSpace {
    static let name = "cardExpandSpace"
}

// MARK: - The container

/// Wraps a scrolling list of cards and hosts the expanded overlay.
///
/// `collapsedID` is the id currently expanded; the matching card in the list is
/// hidden (not removed — removing it would collapse the scroll offset) while its
/// expanded twin is up.
struct CardExpandContainer<Content: View, Detail: View>: View {
    @Binding var expandedID: String?
    /// Collapsed corner radius for a given source frame. Cards use the default;
    /// the Companies orbs pass `{ $0.width / 2 }` so a circle grows out of a
    /// circle instead of snapping square on the first frame.
    var collapsedRadius: (CGRect) -> CGFloat = { _ in CardExpandMotion.collapsedRadius }
    /// The card face to draw inside the expanded sheet, so the header is the
    /// same view the user tapped rather than a lookalike.
    let face: (String) -> AnyView
    @ViewBuilder let content: () -> Content
    @ViewBuilder let detail: (String) -> Detail

    @State private var frames: [String: CGRect] = [:]
    /// 0 = card sitting in the list, 1 = full screen.
    @State private var progress: CGFloat = 0
    @State private var dragY: CGFloat = 0
    @State private var containerSize: CGSize = .zero

    private var isOpen: Bool { expandedID != nil }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                content()
                    // The list retreats behind the card rather than just being
                    // covered — depth without a dimming layer.
                    .scaleEffect(1 - progress * CardExpandMotion.listScaleDrop)
                    .opacity(1 - progress * CardExpandMotion.listFadeDrop)
                    .allowsHitTesting(!isOpen)

                if let id = expandedID, let origin = frames[id] {
                    overlay(id: id, origin: origin, size: proxy.size, insets: proxy.safeAreaInsets)
                }
            }
            .onAppear { containerSize = proxy.size }
            .onChange(of: proxy.size) { _, new in containerSize = new }
        }
        .coordinateSpace(name: CardExpandSpace.name)
        .onPreferenceChange(CardFrameKey.self) { frames = $0 }
    }

    private func overlay(id: String, origin: CGRect, size: CGSize, insets: EdgeInsets) -> some View {
        // Interpolate the frame directly. `progress` is the only input, so the
        // drag and the open/close animation compose instead of competing.
        //
        // The target is the FULL SCREEN, not the safe area. The container sits
        // inside a navigation stack, so `size` stops at the nav bar and the tab
        // bar — growing to it produced a floating cutout card with bars still
        // showing around it (owner's screenshot, 2026-07-21). The safe-area
        // insets are added back so the sheet lands edge-to-edge; the bars are
        // hidden by the host view while something is expanded.
        let p = progress
        let fullWidth = size.width + insets.leading + insets.trailing
        let fullHeight = size.height + insets.top + insets.bottom
        let targetX = (size.width + insets.trailing - insets.leading) / 2
        let targetY = (size.height + insets.bottom - insets.top) / 2
        let width = origin.width + (fullWidth - origin.width) * p
        let height = origin.height + (fullHeight - origin.height) * p
        let x = origin.midX + (targetX - origin.midX) * p
        let y = origin.midY + (targetY - origin.midY) * p
        let startRadius = collapsedRadius(origin)
        let radius = startRadius + (CardExpandMotion.expandedRadius - startRadius) * p
        let dragScale = 1 - min(max(dragY, 0) / CardExpandMotion.dragRange, 1)
            * (1 - CardExpandMotion.dragMinScale)

        // A CROSS-FADE, not a stacked header plus body. The reference keeps its
        // card face and appends content below it, but this app already has a
        // finished detail view (RecordSheet) with its own header — stacking the
        // card face on top of it would show the company twice. So the face
        // dissolves as the real sheet resolves, and the growing frame carries the
        // continuity the shared header would otherwise provide.
        let faceOut = Double(1 - min(max(p / 0.4, 0), 1))
        let bodyIn = Double(max(0, (p - 0.55) / 0.45))

        return ZStack(alignment: .top) {
            face(id)
                .frame(width: origin.width, height: origin.height)
                .opacity(faceOut)
                // Held at the top-left of the growing frame so it does not drift
                // while it fades — a face that moves AND fades reads as two
                // separate animations.
                .frame(width: width, height: height, alignment: .topLeading)
                .allowsHitTesting(false)

            detail(id)
                // The body arrives late and rises into place: showing it from the
                // first frame makes the growth read as a resize instead of an
                // expansion.
                .opacity(bodyIn)
                .offset(y: 24 * (1 - bodyIn))
                .frame(width: width, height: height, alignment: .top)
                .clipped()
                .allowsHitTesting(p > 0.9)
        }
        .frame(width: width, height: height)
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        .overlay(alignment: .topTrailing) {
            Button {
                close()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(.black.opacity(0.25), in: Circle())
            }
            .padding(.top, 54)
            .padding(.trailing, 20)
            // Last thing in, so it never appears over a card still in flight.
            .opacity(Double(max(0, (p - 0.7) / 0.3)))
        }
        .scaleEffect(dragScale)
        .position(x: x, y: y + dragY * 0.6)
        .gesture(
            DragGesture()
                .onChanged { value in
                    // Downward only. An upward drag on a sheet that is already
                    // full-screen has nowhere to go.
                    dragY = max(0, value.translation.height)
                }
                .onEnded { value in
                    if dragY > CardExpandMotion.dismissDistance
                        || value.velocity.height > CardExpandMotion.dismissVelocity {
                        close()
                    } else {
                        withAnimation(CardExpandMotion.settle) { dragY = 0 }
                    }
                }
        )
        .onAppear {
            Haptics.tap()
            withAnimation(CardExpandMotion.open) { progress = 1 }
        }
    }

    private func close() {
        Haptics.tap()
        // Drag and progress resolve on the SAME curve, so the card cannot appear
        // to snap upright before it starts shrinking back into the list.
        withAnimation(CardExpandMotion.close) {
            progress = 0
            dragY = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + CardExpandMotion.closeDuration) {
            expandedID = nil
        }
    }
}

// MARK: - Haptics

/// MainActor-isolated: UIFeedbackGenerator is UIKit and Swift 6 will not let it
/// be touched from a nonisolated context. Every caller here is already on the
/// main actor (SwiftUI gestures and animation callbacks), so this costs nothing.
@MainActor
enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
