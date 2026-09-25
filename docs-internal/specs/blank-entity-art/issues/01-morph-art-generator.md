# 01: Morph Art Generator

Status: ready-for-human
Status note: Ruled 2026-09-25: the strict lump bound stays, and a wide letter (M, W) may show 1 cluster on about 1 card in 10.
Base: 6dc3c219
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

**Parent:** [Blank Entity Art](../spec.md)

**What to build:** The pure generator behind Morph art, and the letter-mask reader it measures against. Given an id seed, a name and a mask, it returns everything the picture needs: colors, the tilted letter, its drops, and the clusters with their gradients. It touches no DOM, so the geometry can be tested with synthetic masks.

**Rationale for the model:** geometry, seeded randomness and guard tests that must bite. The mock took several rounds to get right, so this ticket needs the careful tier.

## Acceptance criteria

- [ ] `src/lib/placeholderArt.ts` exports the generator. Its output is data (shapes, colors, gradient ends), not an SVG string.
- [ ] `src/lib/letterMask.ts` draws a letter to an offscreen canvas in a given font, size, stroke and tilt, and returns a pixel reader. Masks are cached by letter, font and tilt.
- [ ] Every value in the spec's **Geometry** table matches [prototype/blank-art.js](../prototype/blank-art.js).
- [ ] Both seeds go through Murmur3's 32-bit finisher. The hue reads only the id seed. Everything else reads the name seed.
- [ ] The letter rule: the first letter or number after chips resolve, uppercased, else `?`.
- [ ] Tests with synthetic masks (no fonts):
  - the same seeds give the same output
  - changing only the id changes only the hue
  - 8,000 random UUIDs land in all 8 hues, none above 1.2× or below 0.8× of an even share
  - over 200 names, both tilt signs appear at least 40% of the time
  - with an O-shaped and a C-shaped mask, no drop covers more than 4 empty pixels inside the hull
  - every cluster part stays inside the frame and at least 16 px from ink
- [ ] Each guard above fails when its bug is reinstated. Record how in the commit body.
- [ ] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph.

## Scope notes

- **No world or save export-shape change.**
- No UI in this ticket. Ticket 02 renders the output.
- No changelog entry: nothing is visible yet.
