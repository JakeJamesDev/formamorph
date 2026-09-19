# 07: Close-Out

Status: ready-for-agent
Blocked by: 03, 04, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: documentation, showcase wiring, and a verification pass; no new logic.

## What to build

- The Design System guide's narration section gains the Turn Card, the choice rows, and the Scene Plate, each
  with a production-backed showcase reference.
- One changelog entry in the In-Progress section, player bucket.
- A copy sweep of the new accessible names and tooltips.
- A final check of Pages and Chat at desktop and phone width, both themes, and one non-default palette.
- Record the prototype branch and verdict in the spec's Comments if anything changed during the build.

## Acceptance criteria

- [ ] Guide sections and showcase references exist for the three patterns; the showcase drift guard passes
- [ ] Changelog entry in the right bucket, one entry, no churn lines
- [ ] Copy sweep finds no drift in the new labels
- [ ] Static-frame and DOM evidence for Pages and Chat at both widths and both themes
- [ ] The parity test from 02 and 03 is green
- [ ] Four gates green
