# 02: Animated Glyphs

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new runtime dependency, a vendored wrapper, and timing behavior (dwell, crossfade, loop) that needs careful fake-timer tests.

## What to build

The status strip's glyph slot shows an animated glyph for each request. Add `motion` (latest 14.x; check with `npm view`). Copy animate-ui's **v2** icon wrapper from its registry **unpatched**, with what it imports (its Slot and motion utils), on React 19 (Q1, Q1c). Add no other animate-ui component.

**Waits for the React 19 upgrade** (its own effort, from the spike branch `claude/spike-react-19-bedf56`). Do not vendor the wrapper until that upgrade is on main; then rebase.

Copy the eight animate-ui glyphs from the spec's glyph map: compass (`default-loop`), chart-column-increasing (`default-loop`), book-open, scroll, map-pin, hourglass, sparkles, hammer. This ticket owns the **glyph map**: a complete record over `AIRequestType`, plus the Tool-round entry (hammer). The types that will get our own glyphs in ticket 03 (Narration, Cast, Motivation, Character, Choices) map to sparkles for now.

Each glyph loops with a 400 ms pause (Q6), in the muted label color (Q5). A new glyph replaces the old one only after the old one has shown for 300 ms, with a short crossfade; the label changes at once (Q8). With the OS reduced-motion setting on, a static glyph shows (Q7). The glyph is hidden from assistive technology.

Add an animate-ui entry with its license (MIT plus the Commons Clause condition) to THIRD-PARTY-NOTICES. Record the production bundle size before and after in the landing message. Add the glyph set to the strip's showcase entry. Add one How-to-Play phrase saying the status line shows a small animated icon for the request.

Spec: Q1, Q1c, Q5–Q8, glyph map; stories 1, 3, 6–11, 13–18, 22, 29, 30.

## Acceptance criteria

- [x] The glyph map is a complete record over `AIRequestType`; removing one entry fails typecheck (checked once by hand): removing `help` gave TS2741 in `glyphMap.ts`
- [x] Status-row test: each request type shows its mapped glyph next to its label: `glyphMap.test.ts` checks every type against the spec's map, written out by hand; `RequestStatusRow.test.tsx` checks the glyph sits beside its label. GameViewer calls the tested `requestGlyph`
- [x] Status-row test with fake timers: the label changes at once; the glyph swap waits until the old glyph has shown 300 ms: "changes the label at once and the glyph only after…", plus the at-once and skipped-glyph cases. Removing the dwell turns two red
- [x] Status-row test: with reduced motion on, the glyph renders and runs no animation: `RequestStatusRow.motion.test.tsx`, real timers, with a control that sees the needle rotate. Forcing reduced motion off turns it red
- [x] The vendored wrapper matches animate-ui's v2 source with no React 18 patches: line diff against upstream main shows only the relative import paths and two lint comments that named a plugin we lack
- [x] THIRD-PARTY-NOTICES has the animate-ui entry; bundle size before and after is in the landing message
- [x] Frames: `.scratch/frames/glyph-plan-light.png`, `glyph-stats-dark.png`, `glyph-tool-mobile-light.png`: showcase entry, DOM read before each shot showed one glyph at full opacity
- [x] How-to-Play mentions the icon; changelog fragment written

For you: watch a full turn and judge the loop pause and the swap between glyphs.

## Landed

**Not verified**

- The 400 ms loop pause and the 150 ms crossfade have no test or frame sampling. The wrapper takes the pause as `loopDelay`. The Browser pane pauses frames, so it can't show either one.
- Frames come from the showcase, not a live turn. The game row uses the same component.

**For you**

- Watch a full turn and judge the loop pause and the swap between glyphs. The showcase's Turn row steps through six requests every 2 s, so you can also judge the swap there: `.scratch/request-status-glyphs-02/frames/glyph-plan-light.png`, `glyph-stats-dark.png`, `glyph-tool-mobile-light.png`.
- Approve the glyph set in the showcase (**Request Status Strip**), mobile included. It is a new visual pattern.
- After the landing, run `npm install` and then `npx patch-package` in the main checkout. Its `node_modules` doesn't have `motion` yet.
