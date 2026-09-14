# 12: Enter World picker dedup and library deletion

Status: ready-for-human
Base: 4ca9e7ce
Status note: Built across a19bf73b and 0ce659d6. Ticket 03 took the `LINKING_ENABLED` flag out before this
resumed, so the stale PAUSED note is gone. One product call is open for the author, below under Comments.
Blocked by: 01, 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: two contained rules over existing pickers and storage services, each with a clear test.

## Parent

[spec.md](../spec.md) — Settled follow-up decisions (Local library), open questions 8 and 12.

## What to build

Linked content never activates twice, and removing a library item never breaks a world.

In the Enter World step, a library dictionary or Entity that a world already holds as a linked copy is hidden from the library rows, and the world's row carries a **Linked** mark. Independent copies keep today's behavior of two rows labeled World and Library. Picker rows show author and source under the name so duplicate names stay distinct.

Deleting a library item leaves every world copy that followed it as an independent copy with content kept. The world copies lose their link record the next time the world opens, so no world scan runs at deletion time. Duplicate names remain allowed.

## Acceptance criteria

- [ ] A world with a linked copy of a library dictionary shows one row for it, marked Linked, and no library row; an independent copy shows the two rows as today.
- [ ] Two library items with the same name show distinct author and source lines in the Enter World rows.
- [ ] Deleting a linked library item, then opening the world, shows the copy as independent with its content intact and no error.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.
- 02 — Save to Library and Add from Library with links.

## Comments

### Build notes

**What shipped.**

- `buildInitialSelection` ([dictionarySelection.ts](../../../../src/lib/dictionarySelection.ts)) leaves out a
  library row whose id a world book follows, and marks that world row `linked`. A local replacement hides its
  library row the same way: it is still one copy of that item.
- The mark reads off the **library list**, not off the link record. A copy naming an item that is gone reads
  as a plain **World** row at once, so the picker is right before the world is ever re-saved.
- Rows carry `authorLine · sourceLine` under the name, through a new `libraryLines` helper in
  [librarySources.ts](../../../../src/lib/librarySources.ts) that reuses the two line functions the
  Add-from-Library picker already used.
- [MainMenu.tsx](../../../../src/views/MainMenu.tsx) builds `additionEntities`: library characters minus the
  ones a world entity follows, each with its lines. `hasLibraryAdditions`, `restoreWorldAdditionDefaults` and
  the entry resolve all read that list, so a remembered default naming a hidden item is dropped rather than
  activated.
- `syncWorldContent` ([linkedContent.ts](../../../../src/lib/linkedContent.ts)) lets go of the library half of
  a link whose id the lookup did not answer, and reports it as `unlinked` so the caller writes without
  toasting.

**Decisions made here.**

- **A deleted library item does not end a published link.** Where a copy's link named both a `libraryId` and
  a `sourceId`, deleting the local item clears `libraryId`, `sourceRevision` and `reviewedRevision` and leaves
  the copy following the listing. Only a copy that named nothing but the library item becomes independent.
  The author picked this over clearing the whole record: a live listing is a source of its own, and ticket
  10's Replace From Library is the repair when the listing goes too.
- **Letting go is silent.** No toast. The player deleted the item, and the copy's own row shows the change.
- **A failed lookup never unlinks.** Only an answer says an item is gone, so `syncFromLibrary` catches the
  library read. Without it, one unreadable library would unlink every copy in the world.

**Open product call — the Linked mark for characters.**

The ticket says "a library dictionary **or Entity** ... is hidden from the library rows, **and the world's row
carries a Linked mark**." The dictionary half is complete. For characters only the first half is: the Enter
World step draws dictionaries from both the world and the library, so a world dictionary has a row to mark,
but the world's own characters are always in play and were never rows there. Marking them needs a new row
kind in the Entities section — a world-character row that is not a choice. That is a product call, so it was
named rather than invented.

**Known follow-ups (not blocking).**

- `dropLibraryLink` is now the third place that reads `libraryId`/`sourceRevision`/`reviewedRevision` off a
  record together, beside `publishedLink` in `publishLinks.ts` and one in ticket 11's `worldBundle.ts`. All
  three were mid-edit in parallel sessions, so none was touched. Worth one extraction once the effort lands.
- `DictionarySelectionItem` now carries `linked?` (world rows only) and `authorLine?`/`sourceLine?` (library
  rows only). The TSDoc states a `source`-discriminated union the type does not express.

**Gates.** `typecheck` 0 errors · `lint` 0 errors · `build` succeeds in 14.62s · the seven affected test files
pass, 155 tests. The full suite's three failures at the time of writing belong to parallel sessions, not to
this unit: `StatManager` and `CodeArea` pass in isolation, and `useDeviceDownload` fails on ticket 11's
in-flight third argument to `exportEntityCard`.

**Verified in the preview.** With two same-named library books seeded and one world book linked, the picker
drew one **Linked** row for the linked book, no library row for it, and `You · Your library` against
`Wren · Community Creations` for the pair. Rows stayed 56px at 800px and at 375px, so the second line costs
no height.
