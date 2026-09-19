# 07: Close-Out

Status: ready-for-human
Base: 08a71c91
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

- [x] Guide sections and showcase references exist for the three patterns; the showcase drift guard passes
- [x] Changelog entry in the right bucket, one entry, no churn lines
- [x] Copy sweep finds no drift in the new labels
- [x] Static-frame and DOM evidence for Pages and Chat at both widths and both themes
- [x] The parity test from 02 and 03 is green
- [x] Four gates green

## Comments

**2026-09-19, close-out.**

- The guide had no narration section, so this ticket created one: `## Pattern: Narration Turn`. One section and one showcase tab (`narration-turn`) cover the three patterns, because the three compose one turn.
- The reference leaves the Pages action line out. The line is inline markup in `GamePanels.tsx`, and a copy in the showcase can drift. The guide describes it and maps it to the host.
- Copy sweep: `npm run copy:sweep` on the new files gave five notices. Four are label case on the plate names ("Previous image", "Next image", "Delete this image", "Zoom image"). Three of those names predate this effort and `GalleryControls.tsx` uses the same case, so "Zoom image" matches its siblings. One is the raw `text-meta` span for "Turn N" in `BubbleActionRow.tsx`, from the Chat effort. Neither changed here.
- Live check on `thousandTurns`, DOM reads and static frames: Pages latest and past page at 1600x900, dark Graphite and light Forest; Pages and Chat at 375x812; Chat at 1600x900. No horizontal overflow. The latest-page row (six icons and More) fits the card at 375px. The plate sizes from the header (`2560 / 1440`) and its controls show on focus within.
- Seen, not changed: at 375px the corner More button sits over the top right of the Pages card, so a long action line can run under it. At 375px in Chat, "Turn 1000" wraps to two lines.
- Gates: typecheck 0, lint 0, test 11586 passed, build ok. The first full test run exited 1 with every test green: a late `setState` from the reasoning capability probe in `SettingsContext.tsx`, reported from `WorldEditor.fix.test.tsx`. The second run exited 0.
