# 06: Avatars Move In

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Moves an existing section's controls into the tab and adds Replace with a hash recompute. The store helpers already exist; the care is in keeping every entity's pick and the legacy fallback intact.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The world's Avatar store moves from the Overview into the Media tab (Q5, Q25), in both modes (Q26).

- **The Avatars section summary** holds **Upload Avatar…** and **Copy From Library**, with the same behavior they have in the Overview today.
- **An Avatar's panel** shows the preview, size, an editable name (rename on blur, as today), **Used By** (built in ticket 01; reuse it), and the action row from ticket 04: **Replace**, **Download**, and **Delete** in place of Remove.
- **Replace** swaps the file, recomputes its hash, and keeps the Avatar's id, so every entity keeps its pick.
- **Delete** keeps today's confirm, which names the entities that use the Avatar; they fall back to None, and a spent legacy fallback clears, as today.
- Each action is one history step with today's labels.

Keep the Avatar item id form `world:world:avatar:<id>`: ticket 05's image panel links to it (Q43).

The Overview loses its Avatar section. The entity Avatar dropdown stays on the entity panel.

Update the Overview and Avatars wiki pages. Changelog fragment: fold into the entity-avatars entry if it is still unreleased, otherwise into ticket 01's line.

## Acceptance criteria

- [x] The Overview has no Avatar section in either mode: `WorldEditor.worldAvatars.test.tsx` "has no Avatar section in %s mode"
- [x] Upload and Copy From Library add an Avatar card from the Avatars section, in Simple and Advanced: the two `it.each(MODES)` add tests; an empty section also adds the first Avatar (Q53)
- [x] Rename from the panel shows in the entity Avatar dropdown: "follows a rename from the Media tab in its option label"
- [x] Replace keeps the Avatar's id; every entity that picked it still does: "swaps the file and its hash under the same id, name and picks"
- [x] Delete names the users, sets them to None, and clears a legacy fallback that pointed at it: the Delete tests; the fallback test failed when the clear was removed
- [x] Used By lists each entity that picks the Avatar and opens its card: "lists the entities that pick it" and "opens a user's entity from Used By"
- [x] Each action undoes in one step: rename, Replace and Delete read the history cursor (+1, then back on Ctrl+Z)

## Landed

**Not verified**
- The mounted guard in `replace` after the hash read: the test "writes nothing when the panel closes before the file is read" passes without it, because `MediaActionRow` already drops the pick on unmount. The guard covers only the hash window.
- The changelog: the ticket says to fold into the entity-avatars entry, but a ticket branch can't edit `docs/Changelog.md`. The fragment lands as a new Media Tab entry, and the older entry's "The World Overview holds several Avatars…" line is stale. Fold it at close-spec.
- The panel's look in a browser. The Browser pane was not used; behavior is covered in jsdom only.

**For you**
- Open the Media tab, select the **World › Avatars** header, and check that **Upload Avatar…** and **Copy From Library** read well.
- Select an Avatar card and check the name field, the viewer, and the Replace, Download and Delete row.
- In a world with no Avatar, check that the empty **World › Avatars** section shows and adds the first one.
