# 03: Add And Remove

Status: ready-for-agent
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

Write the labels and tooltips under the Writing Guide from a facts list.

Spec rulings: Q5, Q8, Q13, Q14, Q19.

## Acceptance criteria

- [ ] The select lists an entity with no row here and omits one that has a row. The Custom Persona is never listed.
- [ ] Adding a Generic entity gives it a Start here and a row with "begins here".
- [ ] Adding a Unique entity with two Starts gives it a third at this location, and the first two are unchanged.
- [ ] The added entity is the selected row, and the editor shows the new Start.
- [ ] One undo after an add removes the Start and the row.
- [ ] The remove button on a Generic row removes its Starts here, and the row goes.
- [ ] For a Generic entity whose only Start is here, the remove button is disabled and its tooltip states the reason. The test fails when the button is enabled.
- [ ] A Unique row has no remove button.
- [ ] No multi-select of entities is on the tab.
- [ ] A Known Here row's remove control has no visible word, an accessible name that names the entity, and still removes the pick.
- [ ] The copy sweep gives no notice on the new strings.
- [ ] Frames: `.scratch/frames/presence-add-remove-dark.png` and `-light.png`, at 1440 wide, with the Add Entity select open.
- [ ] The Locations wiki page describes Add Entity, the remove button and its disabled case; the Entities wiki page's text on setting a place from either side matches. Help vectors are rebuilt for the changed sections. A changelog fragment describes the change.
