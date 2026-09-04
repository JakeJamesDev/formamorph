# 05 — Find bar placeholder picker on the shared list

Status: done
Type: task
Blocked by: 04
Spec: ../spec.md (Pickers; Further Notes)

## Task

- `src/components/editor/EditorFindBar.tsx`: replace the inline Popover + button list with
  `PlaceholderSectionList`. Rows from the vocabulary for the editor scope, not the raw
  `placeholders` prop. Trigger shows the full path with the owner icon. The Create row moves into
  the list's `footer` slot and keeps its behavior.
- `portal={false}` arrives with the shared list; confirm no second portal wraps it.
- Update `docs-internal/editor-search-spec.md` file map if it names the picker.

## Acceptance

- New `EditorFindBar.test.tsx`: placeholder mode opens the picker; rows are sectioned; picking sets
  the trigger to `Keeper › Mood`; the Create row still mints a placeholder from the query.
- Live check in the editor dialog: the picker wheel-scrolls with more rows than fit.
- Changelog 👤 In-Progress entry.
- Four gates green. `graphify update .` run.
