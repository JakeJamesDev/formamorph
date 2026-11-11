# 03: Add And Remove

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Presence tab adds and removes entities from the list itself, for both kinds. The Generic multi-select goes.

- **Add Entity.** One select under the list. It lists every Unique and Generic entity with no row at this location, in tree order. It does not show when there is none to add.
  - A Generic entity gets a Start here, as the multi-select did.
  - A Unique entity gets one more Start here with weight 1 and no rows. Its other Starts stay.
  - The added entity is selected, and its editor shows the new Start.
  - One undo step reverses an add.
- **Remove.** A Generic entity that begins here has a remove icon button at its row's end. It removes the entity's Starts here. When the entity begins at no other location the button is disabled and its tooltip gives the reason. A Unique entity has no remove button.
- **The multi-select goes**, with its refusal hint. The disabled remove button replaces that hint.
- **An empty location** says that no entity can be here and still offers Add Entity.
- **Known Here (Q19).** The Remove button on a Known Here row becomes an icon button with no word. It uses the same icon as the remove button above. Its tooltip and accessible name say what it removes and name the entity. Nothing else on that list changes.

**From ticket 02:** the list and the editor region landed, and selecting a row sets the shared pick. Selecting the added entity goes through that pick. The Generic multi-select and its refusal hint are still above the list for this ticket to remove.

Write the labels and tooltips under the Writing Guide from a facts list.

Spec rulings: Q5, Q8, Q13, Q14, Q19.

## Acceptance criteria

- [x] The select lists an entity with no row here and omits one that has a row. The Custom Persona is never listed. (presenceAddRemove and locationPresence tests)
- [x] Adding a Generic entity gives it a Start here and a row with "begins here". (presenceAddRemove)
- [x] Adding a Unique entity with two Starts gives it a third at this location, and the first two are unchanged. (presenceAddRemove; withStartHere unit test)
- [x] The added entity is the selected row, and the editor shows the new Start. (presenceAddRemove: aria-current row, Start 2 pressed, "Starts at Tavern."; fails with the show call removed)
- [x] One undo after an add removes the Start and the row. (presenceAddRemove; locationPresence)
- [x] The remove button on a Generic row removes its Starts here, and the row goes. (presenceAddRemove)
- [x] For a Generic entity whose only Start is here, the remove button is disabled and its tooltip states the reason. The test fails when the button is enabled. (presenceAddRemove; failed with the guard removed)
- [x] A Unique row has no remove button. (presenceAddRemove)
- [x] No multi-select of entities is on the tab. (presenceAddRemove)
- [x] A Known Here row's remove control has no visible word, an accessible name that names the entity, and still removes the pick. (LocationKnownHere test)
- [ ] The copy sweep gives no notice on the new strings.
- [x] Frames: `.scratch/frames/presence-add-remove-dark.png` and `-light.png`, at 1440 wide, with the Add Entity select open. (Playwright at 1440x900)
- [x] The Locations wiki page describes Add Entity, the remove button and its disabled case; the Entities wiki page's text on setting a place from either side matches. Help vectors are rebuilt for the changed sections. A changelog fragment describes the change. (wiki pages, `build:help-vectors`, `presence-rows-03.md`)

## Landed

**Not verified**
- The copy sweep gives no notice on the new strings: `copy-sweep` was not run. The strings were written from a facts list.

**For you**
- Read the disabled remove tooltip, "{name} begins at no other location, so it stays here", on a Generic row that begins nowhere else.
- Rows without a remove button keep an empty column when another row has one, so the route icons line up. Look at Presence on The White Room.
- `docs/Changelog.md` still holds an older Routines line that names the "Entities picker". A ticket branch cannot edit it.
