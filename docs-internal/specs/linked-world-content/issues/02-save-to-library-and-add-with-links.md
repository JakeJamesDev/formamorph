# 02: Save to Library and Add from Library with links

Status: ready-for-agent
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

- [ ] Save to Library on an independent dictionary creates a library item, shows Link pending save, and after Save World shows Linked with the source name.
- [ ] Add from Library with Link to Library on inserts a Linked copy; with it off inserts an independent copy; choosing an existing library item never creates a second library item.
- [ ] Link to Library Item… on an independent copy with identical content yields Linked; with different content yields Local replacement and leaves the world's content unchanged.
- [ ] Editing a copy that follows another author's source shows Local replacement after the edit; Unlink shows no indicator and keeps the content.
- [ ] Saving an owned library item updates its linked copy in another world when that world opens; a local replacement in a third world is untouched.
- [ ] Two library items with the same name appear as two rows with different author and source lines.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.
