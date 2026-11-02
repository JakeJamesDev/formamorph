# 08: Optimize Images Applies Map Backgrounds

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one apply function and one case beside an existing suite.

## What to build

**Optimize Images** scans, re-encodes and counts the Map Background images, then the apply step copies back only the thumbnail from the overview. Apply the Map Background too, inside the same **Optimize Images** history Step.

Spec: Implementation Decisions "Optimize Images". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] A World Editor optimize test with an oversized Map Background image fails today (the old image stays), then passes with the re-encoded image (`WorldEditor.optimize.test.tsx` "undoes in one press": red before the fix, green after)
- [x] One undo reverts the map change with the rest of the run (same test, undo and redo asserts)
- [x] The World-Editor-Media sentence on what Optimize Images changes names the Map Background; the docs tests are green (`src/lib/docs`, 8 files green)
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-08.md`)

## Landed

**Not verified:** none.

**For you:** none.
