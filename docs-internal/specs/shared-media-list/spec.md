# Spec: Shared Media List

Status: ready-for-agent
Spec session: shared-media-list — spec

## Problem Statement

A world author places a picture on an entity, and that picture belongs to that one entity. Two entities that show the same picture each carry a full copy of its bytes, so the world grows with every reuse. A sound works the same way.

Because media has no identity of its own, a script cannot point at a picture. An author who wants an entity to look wounded, change clothes or transform has only Visibility rules, which need a trait or stat to hang on. There is no "show this picture now" for a script to call.

Media also has no name. The Media tab lists pictures by where they sit, so an author can't tell two similar portraits apart without opening each one.

## Solution

Each world holds one **Media List**: the named images and sounds the world uses. Entities, locations, items, the map, body backdrops, the world cover and world music link to entries in it.

- A **Media Entry** has a name, defaulted to the imported file's name without its extension.
- Several places can link one entry. The bytes are stored once.
- An empty image slot offers **Import** (add a file to the list and link it here), **Choose** (a searchable thumbnail grid of the list) and a link box for an image URL. A sound slot offers the same.
- A filled slot shows the entry's name, which the author can rename. It also offers **Unlink** (frees this slot, keeps the entry) and **Delete from World**.
- The Media tab gets **Import Media** for images, sounds and Avatars. Its **Group by Type** view lists each entry once with where it is used.
- Scripts set what an entity, location, item or the world shows or plays by naming an entry, the way `persona.body = "Wolf"` sets a Body.
- Library entities, character cards and published listings keep media embedded, as now. A world converts at the boundary, the way it already does for Avatars.

## Rulings

Settled with the user on 2026-11-16, in grill order.

| # | Ruling |
|---|---|
| Q1 | The Media List covers entity galleries, entity sounds, location galleries, location ambient sounds, item images, map images, body backdrop images, the world cover and world music. Dictionary covers stay embedded |
| Q2 | A script's override beats the Visibility rules until a script clears it |
| Q3 | An entity override is per Generic Entity Instance |
| Q4 | Scripts refer to entries by name. Renaming an entry rewrites the scripts that name it, as a stat rename does |
| Q5 | Names are unique per world. A collision gets a numeric suffix: `knight`, `knight (2)` |
| Q6 | Deleting an entry that is in use asks first and lists every place that uses it. The delete then unlinks it everywhere |
| Q7 | An entry nothing links stays in the world and its exports. The Media tab marks it Unused |
| Q8 | A VRM brought in through Import Media goes into the world's Avatar store |
| Q9 | Names drop the file extension |
| Q10 | Media with no file name (pasted, dropped from a page, generated, migrated) is named after its subject plus a number: `Wren 2` |
| Q11 | Visibility rules stay on each link, so one entry can carry different rules on different entities |
| Q12 | Scripts can switch entity images, location images, item images, entity sounds and location ambience to any entry |
| Q13 | Scripts can switch world music too |
| Q14 | A world loaded with embedded media migrates on load. Byte-identical files merge into one entry |
| Q15 | The Media tab keeps its **Group by Type** toggle. Off (the default) stays one row per use, grouped by what holds it. On lists each entry once, sectioned by kind, with what uses it |
| Q16 | Image slots use the picker popover from the prototype (variant B): Import and Choose side by side, the link box below |
| Q17 | Sound slots take the same pick-or-import treatment, plus a basic sound URL: a link box, a linked marker and a broken-link state. Linked sounds get no offline cache and no export embedding |
| Q18 | Library entities follow the Avatar pattern: embedded media is the portable form (library, cards, publish, downloads), ids are the world form, and a content hash converts between them |
| Q19 | When an entry is deleted, a save's override that named it falls back to the rules |
| Q20 | Item images, map images and the body backdrop image are galleries in code and take the gallery link `{ mediaId, requires? }`. The single fields are entity sound, location ambient sound, world cover and world music (ticket 01) |
| Q21 | A single field's id form is `{ mediaId }`, never a bare string, so it can't be mistaken for a URL (ticket 01) |
| Q22 | Ticket 01 widens only the gallery entry type and defines the single-field link type. Tickets 05 and 06 widen each single field when they route its readers (ticket 01) |
| Q23 | Ticket 01 adds the optional `name` on embedded gallery images and fills it in resolution; ticket 02 wires the flows (ticket 01) |
| Q24 | An entry carries an optional MIME `type`, kept from the placed file, so resolution returns a full sound asset (ticket 01) |
| Q25 | A linked (http/https) entry has no hash. Placement reuses the entry with the exact same URL, and the compare token for a URL is the URL. Fallback numbering starts at 1: `Wren 1`, then the next free number (ticket 01) |
| Q26 | A library flow places media only into a world that already has a Media List. Ticket 03's migration gives every loaded world one (ticket 02) |
| Q27 | Enter World cast additions stay embedded in the save. Gameplay never writes the world, and readers resolve embedded images (ticket 02) |
| Q28 | Card JSON gains an optional `primaryImageName` beside `primaryImageRequires`; extra images carry `name` (ticket 02) |
| Q29 | Entities publish from the library, so resolution at Save to Library covers publish. The world-bundle source compare moves to hash tokens with the library compare (ticket 02) |
| Q30 | The media compare reads hash token and Visibility rule, in order. Names don't compare, so renaming an entry in a world doesn't write back to its library item (ticket 02) |
| Q31 | A carried name (from a library entity or card) is taken as-is, made unique, with no extension drop. Q9 applies to file names only (ticket 02) |
| Q32 | The server's Supporter linked-image check learns the Media List in its own ticket (10, FormamorphServer). It deploys before a client release that holds ticket 03 (user, 2026-11-16) |
| Q33 | Released clients can't read list-form worlds. On the release that holds ticket 03, the server's client minimum rises to that version, so old apps get Update Required instead of a world without pictures (user, 2026-11-16) |
| Q34 | Migration takes a carried embedded `name` as the entry name (Q31); the subject fallback applies only when there is none. Every loaded world gets a Media List, even an empty one (ticket 03) |
| Q35 | The picker slot covers every place entity and location galleries render, the Media tab's panels included. Items and the map get it in ticket 05 (ticket 04) |
| Q36 | A pasted URL is named by its last path segment, extension dropped; no segment falls back to the subject name (ticket 04) |
| Q37 | Choose dims entries the subject already links but keeps them clickable; a second link is allowed (ticket 04) |
| Q38 | A rename commits on blur or Enter; a blank name reverts (ticket 04) |
| Q39 | Delete from World is one undo step and always asks, even when one slot is the only use (ticket 04) |
| Q40 | Ticket 04 owns the picker, the Delete from World confirm, and the rename and remove actions; ticket 07 reuses the confirm, and ticket 09 hooks script rewriting into rename. Authoring Tour example pictures import as entries named by the subject fallback (ticket 04) |
| Q41 | The library entity editor keeps the plain uploader with no Choose: library entities stay embedded (Q18), so there is no list to pick from (ticket 04) |

## Prototype

Question: what an image slot looks like when images live in a shared, named list. Built on the real entity editor gallery with three empty-slot variants.

- **Verdict: B, the picker popover.** Rejected: A, a plain dropdown (unusable past about 15 entries, and names alone don't tell pictures apart), and C, tabs inside the frame (every empty slot becomes a browser, heavy for the common "upload a new one" case).
- Branch `prototype/image-library`, verdict commit `93c19d82c`. Launch entry `prototype-image-library` on port 5341, route `/?variant=B#dev?modal=entityEditor&tab=entity&subtab=profile&fixture=gallery`.

## User Stories

1. As a world author, I want an imported image to join the world's Media List under its file name, so that I can find it again by name.
2. As a world author, I want to link one image to several entities, so that the world stores its bytes once.
3. As a world author, I want an empty image slot to offer Import, Choose and an image URL, so that I can add a new image or reuse one in a single step.
4. As a world author, I want Choose to open a searchable thumbnail grid, so that I can pick the right picture among many similar ones.
5. As a world author, I want the grid to mark images this subject already uses, so that I don't link one twice by mistake.
6. As a world author, I want to import several files at once into a gallery, so that each one joins the list and fills the next slot.
7. As a world author, I want a pasted image URL to join the list as a named linked entry, so that scripts can name it like any other.
8. As a world author, I want a filled slot to show the entry's name, so that I know which entry this is.
9. As a world author, I want to rename an entry from the slot, so that I don't have to leave the editor to fix a name.
10. As a world author, I want Unlink to free a slot without deleting the entry, so that other places that use it keep it.
11. As a world author, I want Delete from World to tell me every place that uses the entry before it goes, so that I don't break an entity I forgot about.
12. As a world author, I want a name collision to get a numeric suffix, so that two files called `portrait.png` can coexist.
13. As a world author, I want names without file extensions, so that scripts read cleanly.
14. As a world author, I want a generated or pasted image named after its subject, so that it reads as whose it is.
15. As a world author, I want an entity's sound slot to offer Import, Choose and a sound URL, so that sounds work the way images do.
16. As a world author, I want a location's ambient sound to link to the list, so that two rooms can share one ambience.
17. As a world author, I want world music to link to the list, so that scripts can switch it.
18. As a world author, I want item images, map images, body backdrops and the world cover to link to the list, so that every picture in the world lives in one place.
19. As a world author, I want a linked sound that fails to load to show as broken, so that I catch a dead link before players do.
20. As a world author, I want a linked sound to carry a linked marker, so that I know it needs a connection.
21. As a world author, I want an Import Media button on the Media tab, so that I can bring in images, sounds and Avatars before deciding where they go.
22. As a world author, I want a VRM brought in through Import Media to land in the world's Avatars, so that it is ready for an entity to pick.
23. As a world author, I want Group by Type to list each entry once with what uses it, so that I can see what is shared.
24. As a world author, I want the default Media tab view to stay grouped by what holds each item, so that the view I know does not change under me.
25. As a world author, I want unused entries kept and marked Unused, so that an image only a script shows is not lost, and I can still clean up.
26. As a world author, I want each link to carry its own Visibility rule, so that one picture can mean "wounded" on one entity and always show on another.
27. As a world author, I want a script to set an entity's image by naming an entry, so that I can show any picture at any moment.
28. As a world author, I want a script to clear that override, so that the entity goes back to its Visibility rules.
29. As a world author, I want a script's image to win over the Visibility rules while it is set, so that the script has the last word.
30. As a world author, I want an override on a Generic entity to apply to one instance, so that each guard can look different.
31. As a world author, I want scripts to switch location images, item images, entity sounds, location ambience and world music, so that every linked media field responds to the story.
32. As a world author, I want renaming an entry to rewrite the scripts that name it, so that a rename doesn't break my scripts.
33. As a world author, I want a script that names a missing entry to fail with that name in the error, so that I can find the typo.
34. As a world author, I want my existing worlds to convert on load, so that I don't have to relink anything.
35. As a world author, I want identical pictures in an old world merged into one entry, so that the conversion shrinks the world.
36. As a world author, I want adding a library entity to a world to put its media into the world's list, reusing an entry that holds the same file, so that the world does not gain duplicates.
37. As a world author, I want saving a world entity to the library to carry its media and their names, so that the library copy is complete without the world.
38. As a world author, I want a linked library copy and its source to stay "unchanged" when only the storage form differs, so that I don't get false update prompts or write-backs.
39. As a world author, I want a library update to bring new media into the world's list, so that an updated portrait shows up in every world that follows it.
40. As a world author, I want an exported character card to carry its images, so that it opens anywhere, as cards do now.
41. As a world author, I want a published world to store each shared file once, so that the listing is smaller.
42. As a player, I want a script-driven portrait change to show on the entity everywhere that portrait appears, so that the story and the picture agree.
43. As a player, I want a script's override to survive a save and reload, so that a transformed character stays transformed.
44. As a player, I want a rewind to undo a script's override from that turn, so that undo means undo.
45. As a player, I want an override whose entry was deleted to fall back to the normal picture, so that an updated world still opens my save.

## Implementation Decisions

**World shape**

- The World gains a Media List: entries keyed by id, each `{ id, name, kind: 'image' | 'sound', data }`. `data` is a data URL or an http(s) URL, as image fields hold today. An entry may carry a content hash for embedded data, computed with the same hasher the Avatar store uses.
- Every covered field links by id. A gallery entry (entity, location, item, map, backdrop) becomes `{ mediaId, requires? }`. Single fields (entity sound, location ambience, cover, music) hold `{ mediaId }` (Q20, Q21).
- Names are unique per world, compared trimmed and case-insensitive. The suffix rule is shared by import, rename, migration and library placement.
- One resolver turns a link into displayable media. Every reader goes through it: editor slots, play panels, the map, backdrops, audio, the Media tab and exports. An id with no entry resolves to nothing, and readers treat it like an empty slot.

**Portable form and the boundary (Avatar pattern)**

- Library entities, character cards, published entity listings and downloads keep the embedded form. An embedded gallery image gains an optional `name`, so a round trip keeps names. Embedded sound keeps its `MediaAsset` `name`.
- Entering a world (Add from Library, library sync and reviewed updates, Replace Source, card import into a world) runs one placement step. Enter World cast additions stay embedded (Q27). It hashes each embedded file, reuses the entry with the same hash or adds one (suffixing the name), and rewrites the field to the id. It sits beside the existing Avatar placement in the add commit and in every `applyLibraryUpdate` caller.
- Leaving a world (Save to Library, owned write-back, card export, entity publish) resolves ids back to embedded files with their names.
- Comparing a world copy with its source uses hash tokens for media, as Avatar picks already do. Byte strings are never compared across the two forms.

**Scripts**

- The entity entry gains `image` and `sound`. Reading returns the shown entry's name, or `null`. Assigning a name sets the override; assigning `null` clears it. A missing name throws with that name.
- Location entries gain `image` and `ambience`. Item entries gain `image`. The world gains `music`. They read and assign the same way.
- Overrides live in the save envelope, keyed by owner (entity id, or Generic Entity Instance id; location id; item id; world). They rewind with their turn.
- An override holds the entry id. A rename never breaks a save. A deleted entry's override reads as unset (Q19).
- Entry renames rewrite script text with the existing rename machinery and its drift check.

**Authoring UI**

- The image slot follows prototype variant B. Empty: Import and Choose side by side, the URL box below. Choose is a popover grid with search over names, three columns, names wrapped to two lines, the subject's own entries dimmed. Filled: the existing frame plus a name field, Unlink and Delete from World.
- A sound slot uses the same frame pattern, with an audio row in place of the picture.
- Generate with AI adds its picture to the list under the subject's fallback name and links it into the open slot, keeping today's "replace which image?" step.
- The Media tab gains Import Media, which takes images, sounds and VRM files. VRMs go to the Avatar store. Group by Type lists each entry once with a "Used by" list. The default grouping keeps one row per use. Delete from the tab uses the same confirm as the slot. An Unused filter or marker shows unlinked entries.
- The Media tab's glossary entry changes: it now shows a store (the Media List), plus the Avatar store and fields that stay embedded.
- Every new label in this spec is a working name. Copy goes through the Writing Guide and the copy sweep before it ships.

**Migration**

- An idempotent `migrateWorld` step moves embedded media from every covered field into the list. It merges byte-identical files by hash and names entries by the Q10 fallback. A world already in list form passes through unchanged.
- Saves with no override field load as having none.

**Export shape (constraint #2)**

- World JSON changes: a new Media List, and link fields in place of embedded media.
- Save JSON changes: a new overrides field.
- Card JSON changes: embedded gallery images gain an optional `name`, and the card gains an optional `primaryImageName` (Q28).

## Testing Decisions

A good test drives a public function or a rendered component and checks what an author or player would see. It never reaches into a component's state or a helper's internals.

Seams, confirmed with the user on 2026-11-16:

1. **World data**, as plain functions:
   - migration (merge by hash, fallback names, idempotence)
   - the placement step into a world (reuse vs add, suffixing)
   - the resolution step out of a world (names kept)
   - the source comparison (same file in both forms reads unchanged; a changed file reads changed)
   Prior art: the `migrateWorld` tests, the linked-content and component-update tests, and the Avatar pick matching tests.
2. **Turn commit**, for script overrides: assignment, clearing, override over a Visibility rule, per-instance Generic overrides, rewind, a missing name, and a deleted entry falling back. Prior art: the stat-code turn tests for item and switch scripts, and the image visibility panel tests for what play shows.
3. **Components**: the slot (Import adds and links, Choose links, Unlink keeps the entry, Delete lists uses), and the Media tab (Import Media, Group by Type once per entry, Unused). Prior art: the gallery and image-field tests and the world media editor tests.

Every guard gets a test that fails when its bug returns (`test-bar` skill). The library comparison test must fail if media is compared by bytes.

## Out of Scope

- A media store for the library. Library entities keep embedded media (Q18).
- Dictionary covers (Q1).
- Offline caching and export embedding for linked sounds (Q17).
- Sharing media between worlds.
- Media folders, tags or bulk rename.
- Changing the card's primary image encoding or Morph art fallback.

## Further Notes

- **Open intent question for tickets:** does an item override apply per Item or per Item Instance? Q12 settled that scripts can switch item images, not where the override lives. Ask the spec session before building it.
- **Release steps for the release that holds ticket 03:** deploy ticket 10 first, then raise the server's client minimum to that release's version (Q32, Q33).
- The Media List grows the published world's JSON by a name per entry and shrinks it by every merged duplicate.
- Related: the Avatar store and its pick matching (the pattern this follows), Linked Images (URL values), Image Visibility Rules (rules on each link).
