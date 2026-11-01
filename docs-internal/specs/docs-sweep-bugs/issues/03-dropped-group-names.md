# 03: Unique Names for Dropped Groups

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: pure library-organization operations with an existing test suite, plus one picker that switches to the shared check.

## What to build

On the main-menu Library board, dropping one tile onto another makes a Group named *New Group*, even when a Group already has that name. **Create New Group** refuses a duplicate, and Rename allows one. Build one name-taken check (trimmed, case-insensitive) beside the library organization operations, and use it for the Group picker, Group creation and Rename. A drop takes the first free name: New Group, New Group 2, New Group 3 (Q10). Make the operations' comment about how a folder starts true.

Spec: Q10, Implementation Decisions "Group names". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [x] A test that makes two Groups by drop fails today (two Groups named New Group), then passes with New Group and New Group 2 (`operations.test.ts` "names each dropped folder…": red before the fix, green after)
- [x] Rename to a taken name is refused, compared trimmed and case-insensitive (pure test) (`renameGroup` it.each and `isGroupNameTaken` tests)
- [x] The Group picker uses the shared check and still shows its duplicate-name error (existing test green) (`LibraryGroupFlow.test.tsx` green)
- [x] The Library page says what a drop names its Group; the docs tests are green (`docs/Library.md`; `src/lib/docs` tests green)
- [x] The library-drag-parity spec gets a one-line note under its R10 that a tile drop makes a Group
- [x] A changelog fragment under Minor / Fixed / 👤

## Landed

**Not verified**
- None. The Group header's refused-rename revert has a component test (`LibraryTileGrid.filter.test.tsx`), proved red by removing the check.

**For you**
- Rename a Group to another Group's name in the open Group view (Library, any tab). The field should snap back to the old name with no message. Say if you want an error line there too.
