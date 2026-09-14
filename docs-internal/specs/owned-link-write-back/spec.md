# Owned linked copies share edits with their library item

Status: ready-for-human
Base: 767af271

## Problem Statement

An author saves an entity to their library and links it into two worlds. They open one world and add a space to the entity's description. The copy turns into a **Local replacement** at once. From then on it stops following the library item, the other world never sees the edit, and the only way back is to save the copy to the library again or take the author's version in a review.

The picker promised the opposite. Its own wording for an item you own reads "Edits to the library item apply to every linked copy." The spec says saving an author's linked content synchronizes their library and linked worlds in both directions. What shipped synchronizes one direction only, library to world, on open. With no path from world to library, the build marked every edit as a local replacement so an open-time sync could not overwrite it. That kept the edit and broke the link.

Local replacement is the right state for a copy of **another author's** item. You cannot write into their source, so your edit diverges and keeps tracking their updates. It is the wrong state for your own item.

## Solution

Editing a copy that follows a library item you own keeps it **Linked**. When the world saves, each such copy whose content differs from its library item writes its content to the item, and the item takes a new revision. Every other world holding a linked copy of that item picks the edit up the next time it opens, through the synchronization that already exists.

A copy that follows another author's item behaves as it does today: the first edit makes it a local replacement, and update review offers **Keep Mine** and **Use Author's**.

If the library item changed after this world opened, the world's save still writes its content. Last save wins, the rule the library editor already has.

## User Stories

1. As an author, I want an edit to my own linked entity to keep it Linked, so that the link I made is not undone by typing in it.
2. As an author, I want the world's Save to write my edit to the library item, so that the item is the one place the content lives.
3. As an author, I want my other worlds to receive that edit when I open them, so that a series of worlds shares one entity without repeated edits.
4. As an author, I want the same for dictionaries, so that a shared lorebook is edited once.
5. As an author, I want a world I have not saved to write nothing to the library, so that an edit I discard never reaches other worlds.
6. As an author, I want Discard Changes to leave the library item as it was, so that rolling back the world rolls back everything the session did.
7. As an author, I want a copy of another author's item to become a local replacement on its first edit, so that my change is kept and their updates still reach me for review.
8. As an author, I want an owned copy I already turned into a local replacement to stay one, so that a choice I made in a review is not reversed by this change.
9. As an author, I want Use Author's on an owned local replacement to resume sharing, so that the copy follows the item again after I take its content.
10. As an author, I want the row marker and the footer tip to keep reading Linked while I edit an owned copy, so that the state on screen matches what Save will do.
11. As an author, I want a save that writes back to say so, so that I know the library item changed.
12. As an author, I want a copy that matches its item to write nothing on save, so that an untouched world does not bump the item's revision.
13. As an author, I want a copy edited in this world and the library item edited elsewhere since I opened this world to resolve by last save, so that the rule is the same one the library editor already uses.
14. As an author, I want the world's copy to hold the revision it wrote, so that opening this world again does not report an update it already has.
15. As an author, I want the item's own edit stamp to change on write-back, so that Check for Updates and the listing's publish state both see the item as edited.
16. As an author, I want an owned item that has a listing to read as edited since publish after a write-back, so that Publish offers the new version.
17. As an author, I want the library's entity editor, opened from Open in Library, to show the content this world last saved, so that the two views never disagree after a save.
18. As an author, I want a copy whose library item I cannot read at edit time to be treated as not owned, so that an unreadable library never lets an edit be overwritten on the next open.
19. As an author, I want a world I am not signed in for to treat items with a listing as not mine, so that a copy of a published item I do not own is never written back.
20. As an author, I want the world-only fields of a copy, its locations and its world placeholders, left out of what is written to the library, so that the item stays a standalone library item.
21. As an author, I want the copy's connections kept on write-back, so that the world's references still resolve after the item changes.
22. As an author, I want a write-back that fails to leave the world saved and name the item, so that one bad write does not lose the world.
23. As an author, I want the help topic and the wiki to say that an owned copy shares edits and another author's copy becomes a local replacement, so that the states are explained by ownership.
24. As a maintainer, I want the write-back plan as a pure function beside the sync helper, so that the rule is tested without the editor.
25. As a maintainer, I want an editor bench test for the round trip, so that a regression in either direction is caught.

## Implementation Decisions

- **Ownership decides marking.** The linked-content module's edit marker takes whether the item is owned. An owned copy is returned untouched. A copy of another author's item, or one whose ownership is unknown, is marked a local replacement as today. Unknown means the library lookup has not answered or failed, which keeps the old, safe behavior when the library cannot be read.
- **The world contexts learn ownership from the linking hook.** The hook already loads every linked source on open and knows which are owned. After that lookup it hands the owned library ids to the world and dictionary contexts, which consult them in their update paths. Outside the editor nothing hands ids over, so every edit marks, as today.
- **Write-back plan.** A pure function beside the open-time sync helper takes the world's entities and dictionaries and the loaded sources and returns the copies to write: linked to an owned item, not a local replacement, and content that differs from the item. Content comparison is the existing match check the picker uses. The world-only fields are stripped the way Save to Library strips them; the copy's connections stay on the copy.
- **Write-back runs on world save, before the world is written.** The editor's save asks the hook to write back, the hook writes each item through the existing outside-revision write with one fresh revision stamp per save, stamps that revision as each written copy's source revision, and then the world saves carrying it. Discard Changes writes nothing. A write that fails is reported by item name and does not stop the world save.
- **Last save wins.** No revision check before the write. The library editor has the same rule.
- **Use Author's on an owned local replacement** clears the local-replacement flag, as it does today, and from then on the copy shares edits again.
- **One toast per save** when at least one item was written, naming the count, in the voice of the existing sync toast.
- **Copy.** The help topic's Linked Copies tab, the Linked Content wiki page, and the changelog describe the states by ownership: your own item shares edits with every linked copy; another author's copy becomes a local replacement on edit. The picker's own-item line is already correct and stays.
- **Changelog.** One 👤 In-Progress entry.
- **Export shape.** No new fields. The link record's source revision is written more often, which is a value change, not a shape change.

## Testing Decisions

- A good test reads what a user sees and what the library holds: the tip's state, the fake library's stored record and revision, and the second world's content after open. It does not assert on internal ids handed between hooks and contexts.
- **Pure plan.** Tests in the linked-content suite: owned and differing is written; owned and matching is not; a local replacement is not; another author's item is not; world-only fields are stripped and connections kept.
- **Editor bench.** In the library-links suite: edit an owned copy, the tip still reads Linked; Save writes the item and bumps its revision; a second world opens and receives the edit; Discard writes nothing; an edit to another author's copy still reads Local replacement; a failed store leaves the world saved and reports the item.
- **Prior art.** The existing "takes an owned library save into the world's linked copy" case, the local-replacement cases, and the sync helper tests.

## Out of Scope

- A conflict review when the item changed since the world opened.
- Live write-back on every edit.
- Write-back to a published listing. Publish stays a separate action.
- Any change to another author's content behavior, Keep Mine, or the update reviews.
- Write-back from gameplay. Gameplay never writes the authored world.

## Further Notes

Ticket 02 of the linked-world-content effort recorded the choice this spec reverses, in its "Open for the author" section: marking owned edits was chosen because an unmarked edit would be overwritten by the next open. The write-back path removes that reason.
