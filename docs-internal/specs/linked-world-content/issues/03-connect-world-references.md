# 03: Connect World References

Status: ready-for-agent
Status note: This ticket resumes the effort. Do the flag removal below first — the rest of the spec assumes
links are live.
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: one dialog with clear rules from the spec and prototype, plus a matching function that needs tests for the ambiguity cases.

## Parent

[spec.md](../spec.md) — World Placeholder reference resolution, Settled follow-up decisions (Updates and repairs), ADR 0003 entity-owned location membership.

## First: remove the linking flag

Ticket 02 shipped its library half on its own. Its linking half is parked behind `LINKING_ENABLED` in
`src/lib/linkingFlag.ts`. Delete that module and every guard that reads it, then delete this section.

| File | Guard |
| --- | --- |
| `src/components/ContentLinkStatus.tsx` | `ContentLinkIcon` and `ContentLinkHeader` force the state to null |
| `src/lib/useLibraryLinking.tsx` | `syncFromLibrary` returns early; `saveToLibrary` skips `applyLink`; `controlFor` returns the independent face; `confirmImport` ignores the link choice |
| `src/components/modals/AddFromLibraryModal.tsx` | the link choice is hidden and `linking` is forced false |
| `src/components/modals/ImportContentModal.tsx` | the link choice is hidden and `onConfirm` is forced false |
| `src/contexts/GameDataContext.tsx`, `src/contexts/DictionaryStoreContext.tsx` | a local `markEdited` wrapper that does nothing |

Two test files pair with it. `src/views/WorldEditor.libraryLinks.test.tsx` and
`src/views/WorldEditor.contentLink.test.tsx` each mock the flag on — drop the mock. Delete
`src/views/WorldEditor.libraryOnly.test.tsx`, which exists only to prove the parked state.

Removing the flag turns `link` back into a written field, so hard constraint 2 applies: tell the author.

## What to build

When linked content arrives in a world and expects Placeholders or locations the world does not have, the author connects each one before the content is inserted. When every reference already resolves, no extra step appears.

After confirming the library picker, a **Connect World References** dialog lists one row per unresolved reference in two groups, Placeholders and Locations. Each row names what the content expects and offers a selector of this world's candidates plus **Create New…**. A single clear match is preselected with a preview of its values. Two or more equal matches preselect nothing and say so. A location row offers the world's locations and Create New; the Entity keeps ownership of its location references. **Connect & Add** stays disabled until every row has a connection. **Back** returns to the picker with choices kept.

Connections persist per world and survive updates from the source. The same dialog opens as **Save Connections** to repair a copy whose references broke, reachable from the selected item and from the editor issue list. Names alone never establish a connection.

## Acceptance criteria

- [ ] `src/lib/linkingFlag.ts` is gone and no file references `LINKING_ENABLED`.
- [ ] Adding content whose references all resolve inserts it with no dialog.
- [ ] Adding content with one unresolved Placeholder opens the dialog with that row preselected to its single match and a value preview.
- [ ] A reference with two equal matches opens with no preselection and the note; Connect & Add is disabled until chosen.
- [ ] A location reference offers world locations and Create New; choosing Create New adds the location and the Entity references it.
- [ ] Back keeps every selection; Connect & Add inserts the content with connections stored on the world copy.
- [ ] A source update that renames a Placeholder keeps the stored connection; deleting the world Placeholder surfaces the copy in the issue list with Save Connections.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 02 — Save to Library and Add from Library with links.
