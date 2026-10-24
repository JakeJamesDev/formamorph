# 02: Animated Glyphs

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new runtime dependency, a vendored wrapper patched for React 18, and timing behavior (dwell, crossfade, loop) that needs careful fake-timer tests.

## What to build

The status strip's glyph slot shows an animated glyph for each request. Add `motion` (latest 14.x; check with `npm view`). Copy animate-ui's **v2** icon wrapper from its registry and patch its three `React.use` calls to `useContext` (Q1, Q1b). Copy what the wrapper imports, or use the project's Radix Slot where the shapes match. Add no other animate-ui component.

Copy the eight animate-ui glyphs from the spec's glyph map: compass (`default-loop`), chart-column-increasing (`default-loop`), book-open, scroll, map-pin, hourglass, sparkles, hammer. This ticket owns the **glyph map**: a complete record over `AIRequestType`, plus the Tool-round entry (hammer). The types that will get our own glyphs in ticket 03 (Narration, Cast, Motivation, Character, Choices) map to sparkles for now.

Each glyph loops with a 400 ms pause (Q6), in the muted label color (Q5). A new glyph replaces the old one only after the old one has shown for 300 ms, with a short crossfade; the label changes at once (Q8). With the OS reduced-motion setting on, a static glyph shows (Q7). The glyph is hidden from assistive technology.

Add an animate-ui entry with its license (MIT plus the Commons Clause condition) to THIRD-PARTY-NOTICES. Record the production bundle size before and after in the landing message. Add the glyph set to the strip's showcase entry. Add one How-to-Play phrase saying the status line shows a small animated icon for the request.

Spec: Q1, Q1b, Q5–Q8, glyph map; stories 1, 3, 6–11, 13–18, 22, 29, 30.

## Acceptance criteria

- [ ] The glyph map is a complete record over `AIRequestType`; removing one entry fails typecheck (checked once by hand)
- [ ] Status-row test: each request type shows its mapped glyph next to its label
- [ ] Status-row test with fake timers: the label changes at once; the glyph swap waits until the old glyph has shown 300 ms
- [ ] Status-row test: with reduced motion on, the glyph renders and runs no animation
- [ ] The vendored wrapper runs on React 18 with no `React.use` call left
- [ ] THIRD-PARTY-NOTICES has the animate-ui entry; bundle size before and after is in the landing message
- [ ] Frames: `.scratch/frames/glyph-plan-light.png`, `glyph-stats-dark.png`, `glyph-tool-mobile-light.png`
- [ ] How-to-Play mentions the icon; changelog fragment written

For you: watch a full turn and judge the loop pause and the swap between glyphs.
