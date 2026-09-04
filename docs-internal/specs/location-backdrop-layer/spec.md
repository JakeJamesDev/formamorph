# Location Backdrop Layer

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

A tester's world uses a large, complex SVG as a location background image. During play, typing in the Notes panel lags badly (80–220ms per keystroke) and streaming narration visibly stutters as text paints. Diagnosis showed the cause: the background image is painted as a CSS `background-image` on the game view's root element, shared with the entire UI. Any repaint of a translucent surface above it (the Notes textarea, the narration panel during streaming) forces the browser to re-render the SVG document — measured at ~75ms per redraw for the tester's art on fast hardware, worse on larger/slower displays. Raster images (PNG/JPG) blit from cache and don't exhibit this, which is why the problem only surfaced with SVG art.

## Solution

Move the location background off the root element onto a dedicated backdrop layer that the browser composites independently. The backdrop holds only the image; the fade-toward-theme overlay becomes its own separate layer above it. UI repaints then damage only the UI layers — the image is cached as a composited texture and never re-rasterized by typing, streaming, or panel animations. Visual behavior is unchanged: same cover/center sizing, same overlay fade, same Hide UI reveal, same default background fallback, same page-aware location image.

## User Stories

1. As a world author using SVG background art, I want typing in the Notes panel to stay responsive, so that I don't produce typos while the renderer catches up.
2. As a player, I want streaming narration to paint smoothly regardless of the location's background image format, so that the scene reads fluidly.
3. As a player, I want the location background to look exactly as it did before (cover-scaled, centered, faded toward the theme background by my overlay setting), so that the fix is invisible to me.
4. As a player, I want the Hide UI (eye) toggle to keep revealing the raw, unfaded background image, so that I can admire the art.
5. As a player, I want the overlay fade to respect my Background Overlay setting, including turning it off entirely at zero, so that my configured look is preserved.
6. As a player with the Location Images setting off, I want no background image work at all, so that the plain theme background stays as cheap as it is today.
7. As a player in a location with no background image, I want the bundled default background, so that the view is never bare.
8. As a player paging back through history, I want the backdrop to show the viewed turn's location image, so that past scenes look as they did.
9. As a player on mobile, I want the same backdrop behavior behind the panel layout, so that mobile play matches landscape play.
10. As a player switching themes, I want the overlay to keep using the theme's background color, so that light and dark both fade correctly.
11. As a world author using PNG/JPG backgrounds, I want rendering unchanged, so that existing worlds are unaffected.
12. As a player changing location mid-story, I want the backdrop to swap to the new location's image immediately, so that scene changes stay legible.

## Implementation Decisions

- A new small presentational component (working name `LocationBackdrop`) owns the backdrop. Props express the full contract: the image URL to show (or none), the overlay alpha, and whether the overlay is suppressed (Hide UI). It renders nothing image-related when the Location Images setting has it disabled — the game view simply doesn't pass an image / doesn't mount it.
- The backdrop renders two stacked full-viewport layers inside the game view's root: an image layer and an overlay layer. They are separate elements — the overlay is never part of the image element's background shorthand, so overlay changes (setting slider, Hide UI toggle) cannot invalidate the image raster.
- The image layer carries an explicit compositor-promotion hint (a no-op transform or `will-change`), which is the load-bearing part of the fix: promoted, the rasterized image lives as its own GPU texture and UI repaints stop re-rendering it.
- The image layer reproduces today's `cover`/`center` sizing. The overlay layer is a solid theme-background color at the configured alpha (`hsl(var(--background) / alpha)`).
- The game view's root element loses its inline `backgroundImage` style and its cover/center background classes; it keeps the opaque theme background color as the base beneath the backdrop. Existing UI children must stack above the backdrop (the backdrop sits at the bottom of the root's stacking order).
- The image shown follows the viewed page's location (the same source the current inline style reads), preserving page-aware history behavior, and falls back to the bundled default background asset when the location has none.
- No settings changes, no new state, no world or save shape changes. This is a pure rendering restructure.
- Import-time handling of SVGs (rasterizing on import) is a separate, deliberate non-goal here; this fix makes rendering robust regardless of art format.

## Testing Decisions

- Good tests assert the component's external contract — the DOM it renders and the styles that carry behavior — not incidental markup. The compositor-promotion hint and the image/overlay element separation are contract, not implementation detail: they are the properties that keep the fix alive, so tests pin them.
- Unit-test the new backdrop component directly in jsdom: image URL renders on the image layer; default asset when no location image is passed; overlay reflects alpha and disappears at zero or when suppressed (Hide UI); overlay and image are separate elements; promotion hint present on the image layer.
- Prior art: the small focused component tests in the UI test suite (e.g. the textarea component test) and the GamePanels harness pattern of testing panels without mounting the GameViewer monolith.
- No committed performance test. The performance claim is proven once, manually, with the same real-Chrome probe used in diagnosis (full-viewport repaint timing with the tester's SVG world, before vs after); paint-timing assertions in CI are flaky by nature.
- Live verification in the preview via the dev-router flow (visual parity: background shows, overlay fades, Hide UI reveals raw image), evidenced with static frames.

## Out of Scope

- Rasterizing SVG backgrounds at world-import time (separate proposal; touches stored world data and export shape).
- Making the Notes textarea or other panels opaque (independent micro-optimization).
- Any change to world/save export shape, settings, or the Location Images / Background Overlay semantics.
- The world thumbnail path (main menu cards) — it renders the same data URL but wasn't part of the reported lag.
- A committed CI performance guard.

## Further Notes

- Diagnosis evidence: with the tester's 7.2MB / 20k-path SVG, full-viewport repaints cost 58–96ms and a single raster draw ~75ms on fast hardware; the identical image as PNG repaints at the frame floor. The Notes-vs-Action asymmetry came from the Notes textarea's translucent background forcing redraws of the image beneath it, while the opaque action box never touches it.
- After implementation, re-run the before/after probe with the tester's world (kept in the session scratchpad) and attach numbers to this spec's Comments.
- The tester should be told their SVG art is legitimate use — no authoring guidance change needed once this ships.
