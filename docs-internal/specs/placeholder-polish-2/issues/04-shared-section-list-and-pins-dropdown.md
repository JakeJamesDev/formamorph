# 04 — Shared sectioned list; Pins dropdown moves onto it

Status: done
Type: task
Blocked by: 02
Spec: ../spec.md (Pickers)

## Task

- New `src/components/editor/PlaceholderSectionList.tsx`: a Popover-based picker that renders
  vocabulary rows. Props: `rows`, `selectedId`, `onSelect`, an optional `footer` slot (for the
  find bar's Create row), and a trigger renderer. Folder headings as text, owner headings as
  `OwnerHeading` (`src/components/prompt/OwnerHeading.tsx`, built in 02 — quiet text with the owner
  icon and no chip surface), bare names under owners, full paths elsewhere. `PopoverContent
  portal={false}`. Native `max-h` overflow, no ScrollArea.
- Trigger content helper: full path with the owner icon for an owned placeholder, plain name
  otherwise.
- `src/components/editor/PlaceholderPinRows.tsx`: replace the Radix Select with
  `PlaceholderSectionList`. Rows come from the vocabulary's `palette()` for the current scope.
  Placeholder text "Select placeholder" unchanged.

## Acceptance

- `PlaceholderSectionList.test.tsx`: folder heading is text; owner heading is quiet text with the
  icon by accessible name and no chip surface, and a chip-named owner shows a neutral pill rather
  than the placeholder's accent; selecting a row fires `onSelect(id)`; content mounts inside the
  surrounding element, not `document.body`.
- Pins mounts in `TraitManager` and `LocationManager` tests still pass; one thin assertion that
  the trigger reads `Keeper › Mood` with the icon after a pick.
- Live check in a trait's Pins section inside the editor dialog: wheel scroll works.
- Changelog 👤 In-Progress entry.
- Four gates green. `graphify update .` run.
