# 08: Optimize Images Applies Map Backgrounds

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one apply function and one case beside an existing suite.

## What to build

**Optimize Images** scans, re-encodes and counts the Map Background images, then the apply step copies back only the thumbnail from the overview. Apply the Map Background too, inside the same **Optimize Images** history Step.

Spec: Implementation Decisions "Optimize Images". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [ ] A World Editor optimize test with an oversized Map Background image fails today (the old image stays), then passes with the re-encoded image
- [ ] One undo reverts the map change with the rest of the run (test)
- [ ] The World-Editor-Media sentence on what Optimize Images changes names the Map Background; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
