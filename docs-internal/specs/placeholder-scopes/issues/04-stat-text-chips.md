# 04 — Stat description and descriptor chip inputs

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Stat text)

## Task

- `managers/StatManager.tsx:177-180`: stat `description` becomes a `PlaceholderNameField`.
- `managers/StatDescriptorsSection.tsx:207-212` and `:234-239`: each descriptor `description`
  (existing rows and the new row) becomes a `PlaceholderNameField`. Rows keep their height.
- `lib/resolveWorldNames.ts` `resolveStatNames`: resolve `description` and every descriptor
  `description`, reference-stable when nothing holds a chip.
- `lib/placementLetters.ts` `worldPlacementTexts`: stats walk `name`, `description`, then descriptor
  descriptions in threshold order.
- `lib/worldSearch.ts:204-208`: both fields `chipCapable: true`.
- Priming: the session's priming list includes both fields so a Unique chip there gets a key.
- The Test Bench and `authoredPreviewValues` read the resolved stat, so no change unless they read raw.

## Acceptance

- `resolveStatNames` test: a chip in a descriptor resolves; an unchipped stat keeps its reference.
- `GamePanels.test.tsx`: a descriptor with a chip shows resolved text in `StatRow`; the AI
  `buildStatContext` output carries the resolved meaning and status.
- Letters test: a Unique chip in a descriptor gets a letter after the stat name's.
- Live: type `{` in a descriptor field, insert a chip, see it in the preview stat row.
- Four gates green.

## Answer

Done 2026-09-02. `resolveStatNames` resolves `description` and every descriptor `description` for both the
authored and the save-side shape, keeping every reference nothing touched; `buildStatContext` over the resolved
list carries the meaning and status (proven in `resolveWorldNames.test.ts`, one layer under the panel test the
ticket named, since `GameViewer` builds its stat context from `useResolvedWorld`'s `playerStats`). The letters
walk runs `name`, `description`, then bands by threshold; the session priming list and the Bench's
`chipOwners` carry the same texts; both search targets are `chipCapable`. The editor uses `PlaceholderNameField`
for the description and every descriptor row, the new row included; the section reads placeholders, letters and
owners from `useGameData` like the trait editor. Beyond the ticket: the coverage bar, its tips and the threshold
aria-labels read a chip by name through `labelPlaceholders`, and the Bench's `chip-never-scanned` rule is deleted
because its claim is now false (a chip in stat text is a placement; a dangling one still trips
`chip-unknown-placeholder`). Live: `{` in a Veilwood descriptor opened the typeahead, the inserted `surveyor`
chip read as `near {surveyor}` on the bar, and the in-game stat row read `near Edmund Brandt` once Health fell
into that band. One thing to know: a long descriptor wraps in the chip field (`min-h-10`) where the old input
clipped it, so a row grows with its text rather than keeping one line.
