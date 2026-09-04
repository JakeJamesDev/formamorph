# 03 — Typeahead and drill picker owner headings

Status: done
Type: task
Blocked by: 02
Spec: ../spec.md (Pickers; Icons)

## Task

- `src/components/prompt/ChipTypeahead.tsx` and `src/components/prompt/DrillPicker.tsx`: owner
  heading rows render `OwnerHeading` (`src/components/prompt/OwnerHeading.tsx`, built in 02) — quiet
  text with the owner icon, wearing no chip of its own; a placeholder inside the owner's name shows
  as a neutral pill, which `OwnerHeading` already handles. Folder headings stay text. Rows under an
  owner show the bare label.
- The typeahead filter uses the normalizer from ticket 01.

## Acceptance

- `ChipTypeahead.test.tsx` and `DrillPicker.test.tsx`: owner heading renders quiet text with the
  icon by accessible name and wears no chip surface; an owner named with a placeholder shows a
  neutral pill, not the placeholder's accent; folder heading renders text; typing `keeper.mood`
  finds the row.
- Live check in a PromptField inside the editor dialog.
- Changelog 👤 In-Progress entry.
- Four gates green. `graphify update .` run.
