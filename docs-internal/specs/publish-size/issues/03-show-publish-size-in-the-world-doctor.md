# 03: Show Publish Size In The World Doctor

Status: ready-for-human
Status note: Red band verified by unit tests and computed token colors only; a live 90 MB world crashed the preview pane.
Base: bfc64827
Blocked by: 02 - Refuse An Over-Limit Publish Before Upload
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

A worker round trip, a debounced hook, a props-bundle field, and a new bar in a shared list component that three chromes render, plus a live check in each chrome. Opus for the cross-cutting UI and hook work.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

The World Doctor list shows a **Publish Size** bar above its findings: a fill that grows with the world, a readout "<size> of <limit>", and a tip icon that says what is measured, that linked images add nothing, and that the export file is larger because it is formatted for reading. The fill is green, amber, or red by the band function and clamps at full. The Bench Popover, the full panel (embedded and docked), and the mobile sheet all show it because they all render that list.

The size is measured in the existing JSON file worker with no indentation, on the Bench's debounce, so typing never stalls. The bar shows the last known figure while a new one is pending and nothing before the first result.

## Acceptance criteria

- [x] The JSON worker can return the compact byte count of a value without building a string on the main thread
- [x] A hook yields the world's publish size, recomputed on the rules' debounce interval, first result async
- [x] The Issues props bundle carries the size; the orchestrating hook populates it
- [x] The World Doctor list renders the bar with label, readout, tip, and a data attribute for the band when the size is present, and no bar when absent
- [x] Verified live in the popover, the embedded panel, the docked panel, and the mobile sheet by DOM reads
- [ ] Both themes checked for the three band colors
- [x] No export-shape change
- [x] Four gates green

## Blocked by

- 02, Refuse An Over-Limit Publish Before Upload

## Comments

- 2026-09-10: Live DOM checks in the dev app on a real 2.7 MB world: popover, embedded, docked, mobile sheet. Amber reached live through the real worker with a 60 MB unsaved probe. Green, amber, and red fills read from their semantic tokens in light and dark.
- Resolved 2026-09-10 in review: the formatter shows a whole number bare ("100 MB"), and the spec now says a linked image "adds only its URL".
- The measure is the world as edited, so it counts unsaved edits and lacks the stored record's `version` field (about 20 bytes).
