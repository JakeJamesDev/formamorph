# 02: Save to Library and Add from Library with links

Status: ready-for-human
Status note: Built across 5e299026, cefd6bd2 and b1bb970a. Two product calls are open for the author,
below under Comments. Check for Updates is deliberately absent from the linked-copy menu; ticket 08 owns it.
PARKED behind `LINKING_ENABLED` in `src/lib/linkingFlag.ts`, which ships false. The library half ships on
its own: Save to Library, Add from Library and Import file all work, nothing writes a `link` record, and no
copy follows a source. Ticket 03 removes the flag when the effort resumes.
Base: e16d4a91
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: editor UI over an existing add-from-library flow with a small local synchronization rule; the data shape is already settled by ticket 01.

## Parent

[spec.md](../spec.md) — Local authoring, Editor split buttons and file import, Add-from-library picker, Settled follow-up decisions (Local library).

## What to build

An author working in the World Editor moves content to and from the library without export files, and the link survives.

The selected item's header gains a split button. For an independent copy the face reads **Save to Library**: it creates a library item owned by the author and links the copy to it as pending until the world is saved. For a linked copy the face reads **Open in Library**, opening the library editor. The menu holds **Export**, and for linked copies **Check for Updates** and **Unlink**; for independent copies it holds **Link to Library Item…**, which opens the library picker and links without overwriting: matching content becomes Linked, differing content becomes a Local replacement.

The editor footer's library import becomes an **Add** split button. The face opens the library picker with **Link to Library** on by default; the picker is searchable, shows author and source under each name so duplicate names stay distinguishable, and explains the link outcome by ownership. The menu holds **Import file…**, which reviews the content name and offers the same link choice.

Owned sources synchronize locally: saving a library item the author owns pushes the change to that author's linked copies when their worlds open, unless a copy is a local replacement. Editing a copy that follows another author's source turns it into a local replacement and keeps source tracking. Unlink keeps content and clears the record.

The selection-key behavior in the prototype's picker is a presentation detail, not a contract.

## Acceptance criteria

- [x] Save to Library on an independent dictionary creates a library item, shows Link pending save, and after Save World shows Linked with the source name.
- [x] Add from Library with Link to Library on inserts a Linked copy; with it off inserts an independent copy; choosing an existing library item never creates a second library item.
- [x] Link to Library Item… on an independent copy with identical content yields Linked; with different content yields Local replacement and leaves the world's content unchanged.
- [x] Editing a copy that follows another author's source shows Local replacement after the edit; Unlink shows no indicator and keeps the content.
- [x] Saving an owned library item updates its linked copy in another world when that world opens; a local replacement in a third world is untouched.
- [x] Two library items with the same name appear as two rows with different author and source lines.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.

## Comments

### Handover (2026-09-09)

Built, four gates green, verified in the preview at 1600x900 and 375px.

**Commits.** `5e299026` is the unit. `cefd6bd2` follows the renamed picker confirm in two older modal
suites. `b1bb970a` builds the footer's Add button from the shared `SplitButton`. Three commits rather than
one because `src/views/WorldEditor.tsx` held three tickets' hunks at once and the amend window closed each
time a neighbour committed.

**Placement changed during the build.** The selected-content split button replaces the footer's Export
button rather than sitting above the item's fields. The author directed this: the space above the entity
panel belongs to the entity-panel-tabs tab strip. Export moved into the button's menu, still Advanced only.

**Not built here.** Check for Updates is absent from the linked-copy menu. Ticket 08 owns that behavior and
a menu item that does nothing is worse than an absent one.

**Export shape.** No new exported world field — `ContentLink` shipped with ticket 01. Worlds saved from this
build now carry link records where nothing wrote them before. `CommunityLink.sourceAuthorName` is new and is
local IndexedDB only.

### Open for the author

1. **Editing an owned linked copy marks it a local replacement.** The ticket scopes marking to a copy that
   follows *another author's* source, leaving an owned copy undefined. The build marks it, because not
   marking it lets the next world open overwrite the author's edit. The cost is that the copy stops
   following its own library item until the author saves it there again.

2. **The synchronization pass dirties the world on open.** Opening a world whose linked copy is behind
   updates it and leaves the world unsaved, so the exit prompt appears after only looking at a world. This
   follows the spec's world-save boundary, but the prompt is unsolicited.

### Follow-ups for later tickets

- The pass runs in the World Editor only. Syncing at play-open would violate the authored-world-immutable
  constraint, so it belongs nowhere else.
- A source's new placeholders do not reach a linked copy; that is ticket 03's reference-resolution step.
