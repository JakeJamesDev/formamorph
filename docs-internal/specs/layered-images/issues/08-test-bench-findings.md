# 08: Test Bench Findings

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench flags Layered Image traps. The spec covers this in Q15.

- A Variant whose size or aspect differs from the canvas, through ticket 02's `layeredSizeMismatches(entry, media, sizeOf)`.
- A bottom Layer that can resolve empty (every Variant has a rule).
- A Variant rule that names a missing trait or stat.
- A layered entry with no Layers.
- **Docs.** The Test Bench page lists the four findings.

## Acceptance criteria

- [x] One Test Bench rule test per finding, each proved to bite by reinstating the trap. `rules.layered.test.ts`; six mutations (inverted unresolved check, cover test dropped, rule check dropped, no-Layers branch, missing-image skip, size filter) each turned a test red.
- [x] Each finding names the rig and the Layer. Messages carry "<Rig> · <Layer>"; asserted in each test.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-08.md`.

## Landed

**Not verified**
- The four rows were not looked at in the live Test Bench panel. The size row's wiring in `useTestBench.ts` has no test; its check function does.
- The location and item branches of the missing-target check have tests that pass either way. Nothing proves the persona remap or the instance-owner read.
- A location-linked rig whose bottom Layer is covered by a persona-owned one-pick group can get a false "bottom Layer can show nothing" warning. The cover test reads global names only.

**For you**
- Open the Test Bench Issues tab on a world with a Layered Image whose Variant has the wrong size, and read the four rows' wording.
