# 02: Add From Library In The + Menu

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: two adapters gain host-supplied menu rows, one footer control is removed, plus a tour step, tests and help pages; well-bounded.

## What to build

On Entities and Dictionary, the list's + is always a menu, in Simple mode too:
- Entities: Add Group (Advanced only), Add Entity, a divider, **Add From Library…**, **Import Entity…**.
- Dictionary: Add Dictionary, a divider, **Add From Library…**, **Import Dictionary…**.

**Add From Library…** opens the existing library picker. **Import …** opens the existing file import. The adapters take these extra rows from the World Editor host, because the picker and the import are host state.

The **Add Entity** and **Add Dictionary** split buttons are removed from both footers. **Save to Library** stays.

The Authoring Tour's `add-entity` step body tells the author to select **Add Entity** in the + menu; the `list-add` anchor stays on the +. The Entities, Dictionary and Linked Content help pages and the built-in help topics name the + menu rows instead of the removed buttons.

Changelog fragment: Add From Library and Import moved into the + menu on Entities and Dictionary.

From the prototype branch `prototype/editor-header-search` (commit `91591d7f`).

## Acceptance criteria

- [ ] Both + menus show their rows in Simple and Advanced; Add Group shows only in Advanced.
- [ ] Each library and import row opens its picker or file import; the typed filter text is cleared as with any + add.
- [ ] No Add split button remains in either footer; Save to Library is unchanged.
- [ ] The tour's add-entity step reads the new instruction and its test passes against the menu.
- [ ] The library-link tests reach Add From Library through the + menu.
- [ ] The help pages and help topics match.
- [ ] Four gates green.
