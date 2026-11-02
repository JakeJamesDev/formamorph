# Spec: Body Layouts and Slot Rules

Status: done
Status note: Closed 2026-11-01, tickets 01–08, last landing eabbc94c2. Review: four gaps fixed in ticket 08, spec text corrected. Gates green on 2026-11-01.
Spec session: body-layouts-and-slot-rules — spec

## Problem Statement

A Body is a text list of slots. An author can't show where a slot sits on the body, and a player reads what they wear as rows, not as a figure.

Slots also can't say what hands need. A dagger in the main hand differs from a dagger in the off hand, and a greatsword takes both hands. Today an author must choose: a Hand slot with capacity 2 and Slot Size 2, which loses main and off hand, or two named slots, which leaves the greatsword nowhere to go.

## Solution

**Body Layout.** Each Body gets a Backdrop and one movable, sizable Slot Box per capacity unit. The author lays them out in the Equipment Settings editor. The Inventory panel draws the same figure, with what the player wears in each box.

**Slot Rule.** An item names its slots and a mode. **Either of** takes one of them: a dagger takes Main Hand or Off Hand. **All of** takes every one: a greatsword takes Main Hand and Off Hand. Slot Size retires. Capacity stays for interchangeable units, such as Ring ×2.

## Rulings

Settled in the grill on 2026-11-01. A settled ruling reopens on new evidence, never on a new opinion.

### Body Layout

| # | Ruling |
|---|---|
| Q1 | A Slot Box stores its position and size as fractions (0–1) of the Backdrop. The Backdrop's size is an aspect ratio |
| Q2 | Each capacity unit gets its own Slot Box |
| Q3 | The layout shows in the Equipment Settings editor and in the in-game Inventory panel |
| Q4 | Bodies are unreleased, so every Body has a layout. There is no list fallback |
| Q5 | A new Slot Box appears as a small square at the Backdrop's center. Raising capacity adds one; lowering it drops the last |
| Q6 | A new Body starts on the Humanoid outline. The other Backdrops are Quadruped, Plain and Custom Image |
| Q7 | The authored box is the bounds. An equipped image fits inside at its own aspect ratio, and the drawn frame hugs the image. An empty slot shows the full box |
| Q8 | An All of item shows its image in each box it fills (amended by Q35) |
| Q9 | In play, an empty box is a blank outline |
| Q10 | An equipped item with no image shows its name in the box, cut short when it doesn't fit |
| Q11 | The doll sits above Carried, in the same layout on desktop and mobile. Its size follows Q49 |
| Q12 | Tapping a filled box offers the slot row's actions today: Use and Unequip. Nothing new |
| Q13 | Boxes move and resize freely. Overlap is allowed. **Snap to Others** is a toggle |
| Q14 | Arrow keys move a selected box. Shift + arrow keys resize it |
| Q15 | A Custom Image sets the Backdrop's aspect. For the other Backdrops the author sets it by dragging the bottom edge |
| Q16 | When the aspect changes, boxes keep their fractions and stretch with it |
| Q17 | Snap to Others aligns to other boxes' edges and centers, and to the Backdrop's vertical midline |
| Q18 | Snap to Others starts on. The choice is an app setting, never in the world. Alt-drag skips it for one drag |
| Q19 | The editor labels each box with its slot and unit: "Hand 1", "Hand 2", or "Head" at capacity 1. Play shows no label |
| Q20 | Copies in a capacity slot fill its boxes in unit order |
| Q21 | Box assignment is derived: copies fill by equip order, and the rest reflow after an unequip. Ring position doesn't matter. **Replaces the grill's stored-box answer** |
| Q22 | In play, hover or tap on an empty box shows the slot name |
| Q23 | The doll editor sits inside the Body's expanded row. Selecting a box selects its entry row, and the reverse |
| Q24 | The layout is display only. Scripts and prompts don't see it |
| Q25 | ~~A box index on each Item Copy~~ Dropped with the Slot Rule. The save shape does not change |
| Q29 | We ship two outlines: Humanoid and Quadruped, theme-colored SVGs |
| Q30 | A Custom Image uses the entity image path: upload, linking and Downscale |
| Q31 | The doll editor supports touch drag and resize |
| Q32 | Duplicating a Body copies its Backdrop and boxes |
| Q33 | The presets are Humanoid and Quadruped only |
| Q34 | The agent draws the outlines. The user approves them |
| Q46 | The editor layout is the prototype's variant B: doll on the left, slot rows on the right, wrapping when narrow |
| Q47 | A smaller box draws above a larger one, in the editor and in play. Equal areas follow entry order, then unit order. Selection doesn't reorder boxes, and only its handles draw above them |
| Q48 | In play, a filled box with an image takes taps only on its drawn frame. Its margin falls through to the box below |
| Q49 | The in-game doll caps its height so Carried stays reachable, about 320 px for a Humanoid. Its width follows the aspect, up to the panel's width. This narrows Q11's "scales to the panel's width" |
| Q68 | (ticket 04, new evidence) Capacity caps at 99 in the editor input and in `parseBodies`, since each unit draws a box. Amends Bodies Q45's "no max" |
| Q69 | (ticket 04) The user approved revised outlines: a Humanoid with its head joined to the body, a larger head and a shorter neck, and a fox-like Quadruped with two visible legs and no face. Ticket 07 places boxes on these |
| Q70 | (ticket 05) A Custom Image is a new `body` media parent kind: the entity image cap, no rule host, no stacking, and Go to lands on Equipment Settings. It has no Visibility rule UI and no new link kind |
| Q71 | (ticket 05) Picking Custom Image leaves the current Backdrop until a file lands. An image past the aspect clamp draws fit inside with bars, never stretched. Boxes stay fractions of the Backdrop |
| Q72 | (ticket 05) Leaving a Custom Image drops the image and keeps the boxes. The aspect then follows Q53: Humanoid and Quadruped set theirs, and Plain keeps the current one |
| Q73 | (ticket 06) Visible copies fill units from unit 1. A hidden equipped copy draws in no box, and the spare box reads as empty (inventory Q112) |
| Q74 | (ticket 06) A Body with no drawable slots, or None, shows no figure and no Equipped subheader. A visible copy that gets no box lists under Carried with Unequip (Bodies Q35) |
| Q75 | (ticket 06) The tap popover holds today's row: thumbnail, name, state, count, uses line, Use and Unequip. It stays open after Use. A filled box with an image shows the item's name in a hover tooltip. A failed image load falls back to the name |
| Q76 | (close review, ticket 08) The placement warning reads the placement's named slot. The select lists only allowed slots the owner's Body holds |
| Q77 | (close review, ticket 08) Picking the Backdrop the Body already has changes nothing, so a dragged aspect stays |
| Q78 | (close review, ticket 08) A placement with quantity 2+ and a named slot sends the first unit there. The rest take the first free slot, as the Inventory pass does |
| Q79 | (close review, ticket 08) A Body entry's Capacity field changes boxes only when the edit ends, on blur or Enter |
| Q50 | (ticket 04) Q46 settles variant B's structure. The approval step covers the two outlines. Frames of variant B in both themes go with that request, for the user to see, never to reopen Q46 |
| Q51 | (ticket 04) A Body row gets a Duplicate action, named "\<name\> (Copy)" as elsewhere. It copies entries, Backdrop, aspect and boxes (Q32) |
| Q52 | (ticket 04) A row click selects unit 1. Another click on the same row moves to the next unit and wraps. This also reaches a box hidden behind another |
| Q53 | (ticket 04) Picking Humanoid sets the aspect to 0.5 and Quadruped to 1.6. Plain keeps the current aspect. Boxes keep their fractions in all three (Q16) |

### Slot Rule

| # | Ruling |
|---|---|
| Q26 | Replaced by Q37 |
| Q27 | Bodies Q12 stands: when capacity shrinks, the item equipped most recently comes off |
| Q28 | No move action. Moving a dagger to the other hand means equipping it into that slot |
| Q35 | Slot Size retires. A capacity unit holds one Item Copy |
| Q36 | An item's slot control is a mode select (**Either of** / **All of**) and a slot multi-select. One slot reads the same in both modes |
| Q37 | An Either of equip takes the first free slot in the item's order. The player or the Inventory pass may name a slot. The panel offers one Equip choice per allowed slot |
| Q38 | When every allowed slot is full, an Either of equip swaps out in the named slot, or in the first listed slot if none is named |
| Q39 | An All of equip is refused when the owner's Body lacks any of its slots. Otherwise it takes one unit in each, and swaps out as needed. Extends Bodies Q8 |
| Q40 | When a Body change removes any slot of an All of item, the whole item comes off (Bodies Q12 settle) |
| Q41 | The item line reads `Dagger (Main Hand or Off Hand)` and `Greatsword (Main Hand + Off Hand)`. The equip operation gains an optional slot. Both need probe numbers before landing |
| Q42 | Scripts read which slot a copy sits in, and may name a slot when they equip |
| Q43 | An Equipped placement of an Either of item with 2+ slots gets a slot select. It defaults to the first free slot |
| Q44 | Emberwatch moves to Main Hand + Off Hand, and its Slot Size 2 item becomes All of |
| Q45 | The Bodies Q55 "can't fit" mark follows the validator: Either of fits when any slot exists; All of fits only when all exist |
| Q54 | (ticket 01) The validator keeps refusing an equip on an equipped copy. Moving hands is unequip, then equip, and both item scripts fire (Q28) |
| Q55 | (ticket 01) A copy whose stored slot leaves its item's rule, or whose rule goes away, comes off through the Body settle. A load settle follows Bodies Q42: effects reverse, nothing fires, no log line. A changed All of order only changes which slot reads first |
| Q56 | (ticket 01) The item's slot control is reorderable rows plus an Add Slot select, the Body entries' pattern. No rows = not equippable. The mode select shows only at 2+ slots, and a new rule stores `either` |
| Q57 | (ticket 01) Ticket 01 moves the placement warning onto the rule. Ticket 03 adds only the select and the Placement field |
| Q58 | (ticket 01) Emberwatch: Hands becomes Main Hand (same id) plus a new Off Hand, capacity 1 each on Humanoid. All of Main + Off: Spiral-Cut Staff. Either of Main, Off: swords, daggers, walking staves. Either of Off, Main: Hooded Lantern, shields, Grimoire, Spyglass |
| Q59 | (ticket 01) An unnamed Either of equip with every slot full swaps in the first listed slot the Body holds. A named slot on an All of item is accepted if listed. The panel offers a choice only for 2+ allowed slots the Body holds, and an All of item shows Equip only when the Body has every slot. A list row shows an All of item in each slot row, and the entity list joins the slot names. Bodies Q44 retires with Slot Size |
| Q64 | (ticket 02) Q45 assumed a can't-fit mark in the code, but Bodies ticket 07 removed it on probe evidence. Ticket 02 builds it with Q45's fit rule and new wording, as its own probe arm. It ships only if the transformed rate rises and slotless-held and normal hold. Otherwise it comes out and the mismatch stays a known gap with the numbers recorded (Bodies Q55's gate) |
| Q65 | (ticket 02, widened on probe evidence) A `slot` value made only of two or more of the item's own slot names, joined by anything, counts as no name, so the equip follows Q37 and Q38. A single allowed name is a named slot. A single disallowed name, or any unknown name, is skipped with a diagnostic. Names match ignoring case. Evidence: the model wrote "Main Hand or Off Hand" on a `Main Hand + Off Hand` item, and the equip landed 1/12 at best under an exact-copy rule |
| Q67 | (ticket 02, Q64's result) The mark failed its gate on every shape tried and came out: transformed was 2/12 at best in the final batch, slotless-held 0/12. The mismatch stays a known gap, and the validator skips those equips |
| Q66 | (ticket 02) Probe arms on the cloud endpoint: no-slot control, today's line, Q41's wording, and the Q64 mark. Cases add Either of and All of equips with a named hand, an All of item on a Body that lacks one slot, and the existing cases as guards |
| Q60 | (ticket 03) `copy.equip(slotName)` takes the slot's name. A name the rule doesn't list reaches the validator, which refuses it with a diagnostic at commit, never a throw at the call. `equip()` with no name stays |
| Q61 | (ticket 03) `copy.slot` reads the first occupied slot, with no new field. An All of copy appears in `items` of every slot it occupies in the `body` read |
| Q62 | (ticket 03) `Placement.slotId` is optional, and absent means first free. Seeding drops a slot the rule no longer lists. Changing the item or unticking Equipped clears it |
| Q63 | (ticket 03) When two placements name one slot and it is full, the later swaps out the earlier (Q38), with no warning |

## User Stories

### Authoring a layout

1. As a world author, I want each slot shown as a box on a figure, so that I can see where equipment sits on the body.
2. As a world author, I want to drag a box, so that it sits on the body part it equips to.
3. As a world author, I want to resize a box from its corners, so that a hand box is tall and thin and a head box is square.
4. As a world author, I want one box per capacity unit, so that Hand ×2 can sit on two hands.
5. As a world author, I want raising capacity to add a box at the center, so that I can find it and drag it into place.
6. As a world author, I want lowering capacity to drop the last box, so that the layout always matches the entry.
7. As a world author, I want a new Body to start on a humanoid outline, so that I have something to place boxes on.
8. As a world author, I want a Quadruped outline, so that a hound or a horse doesn't need custom art.
9. As a world author, I want a Plain backdrop, so that I can lay out a creature no outline fits.
10. As a world author, I want to upload my own backdrop image, so that the figure matches my world's art.
11. As a world author, I want a custom image to set the backdrop's shape, so that boxes never drift off the art.
12. As a world author, I want to change the backdrop's aspect by dragging its edge, so that a wide creature gets a wide figure.
13. As a world author, I want boxes to keep their place on the body when the aspect changes, so that I don't redo the layout.
14. As a world author, I want boxes to snap to each other, so that two hands line up without effort.
15. As a world author, I want boxes to snap to the midline, so that a head and a chest sit centered.
16. As a world author, I want to turn snapping off, so that I can place a box freely.
17. As a world author, I want my snap choice remembered, so that I don't set it for each Body.
18. As a world author, I want to hold Alt to skip snapping for one drag, so that I don't touch the toggle.
19. As a world author, I want arrow keys to nudge and resize a selected box, so that I can make fine moves and work without a mouse.
20. As a world author, I want to lay out a Body by touch, so that I can author on a tablet or a mobile device.
21. As a world author, I want each box labeled with its slot and unit, so that I can tell Hand 1 from Hand 2.
22. As a world author, I want a selected box and its entry row selected together, so that I can find one from the other.
23. As a world author, I want a small box to draw above a large one, so that a ring box on a hand box stays reachable.
24. As a world author, I want selecting a large box to leave the small box inside it clickable, so that selection never traps me.
25. As a world author, I want a box hidden exactly behind another to stay reachable through its entry row, so that I can always recover it.
26. As a world author, I want duplicating a Body to copy its layout, so that a variant starts from the original.
27. As a world author, I want the layout in the world export, so that it travels with the world.

### Slot Rules

28. As a world author, I want an item to fit either of several slots, so that a dagger goes in the main hand or the off hand.
29. As a world author, I want an item to take all of several slots, so that a greatsword takes both hands.
30. As a world author, I want a one-slot item to read the same in both modes, so that a helmet stays simple.
31. As a world author, I want the slot order on an item to set where it goes first, so that a torch prefers the off hand.
32. As a world author, I want an Equipped placement to name a slot, so that a character starts with a torch in the off hand.
33. As a world author, I want that select only on items with a choice, so that a helmet's row stays plain.
34. As a world author, I want a placement warning when an owner's Body can't hold the item, so that I catch it before play.
35. As a player, I want to choose which hand an item goes in, so that a dagger in my off hand stays there.
36. As a player, I want that choice kept after a reload, so that my setup doesn't change.
37. As a player, I want a greatsword to take both hands, so that I can't also hold a torch.
38. As a player, I want equipping a greatsword to unequip what's in the way, so that I don't do it by hand.
39. As a player, I want a refused equip when my Body lacks a slot, so that a wolf doesn't hold a greatsword.
40. As a player, I want a two-handed item to come off when my Body loses a hand, so that the story stays consistent.
41. As a script author, I want to read which slot a copy sits in, so that a script can tell main hand from off hand.
42. As a script author, I want to name a slot when I equip, so that a script can put a torch in the off hand.
43. As a player, I want the AI to know an item's allowed slots, so that it equips sensible things into sensible places.

### Playing

44. As a player, I want to see what I wear on a figure, so that I read my equipment at a glance.
45. As a player, I want an item's image to keep its shape, so that art never looks stretched or cropped.
46. As a player, I want an item with no image to show its name, so that I can still tell what it is.
47. As a player, I want a two-handed item drawn in each box it fills, so that both hands read as used.
48. As a player, I want empty slots as blank outlines, so that the figure stays clean.
49. As a player, I want the slot name on hover or tap, so that I can learn what an empty box is.
50. As a player, I want to tap a filled box for its actions, so that I can use or unequip it.
51. As a player, I want a tap on an item's margin to reach the item below, so that overlapping boxes work as they look.
52. As a player, I want Carried to stay within easy reach below the figure, so that the figure doesn't push my items away.
53. As a player, I want the figure to change when my Body changes, so that a transformation shows.
54. As a mobile player, I want the same figure, so that the panel doesn't work differently on a small screen.

## Implementation Decisions

### Modules

- **Body Layout module (new, pure).** Owns box sync to entries (Q2, Q5), stacking order (Q47), snap lines and the snap calculation (Q17), and clamps. No React. This is the one new test seam.
- **Doll editor.** A canvas and toolbar inside the Body's expanded row, in the layout of variant B (Q23, Q46). It writes through the existing Bodies setter, so History and Auto Save work as they do for other Body edits.
- **Play doll.** A display component the Inventory panel renders in place of the slot list. It takes the layout, the slot names and "what fills this unit", and the panel supplies the actions.
- **Slot Rule helpers (item module).** One helper answers which slots a copy occupies, and it replaces `slotSizeOf`. Every occupancy reader goes through it: the validator, the Body settle, the panel, the prompt context, the sandbox read and the Player View.
- **Inventory validator and settle.** The equip operation gains an optional slot. Either of and All of follow Q37–Q40. An All of item takes one unit in each slot; the existing "longest equipped first" swap-out frees room per slot.
- **Inventory pass and prompt.** The item line and the optional slot follow Q41. No can't-fit mark ships (Q67).

### Schema (from the prototype, trimmed)

```ts
/** Fractions of the Backdrop. */
interface SlotBox { x: number; y: number; w: number; h: number }

type Backdrop = { kind: 'humanoid' | 'quadruped' | 'plain' } | { kind: 'image'; image: GalleryImage };

interface BodyEntry { slotId: string; capacity?: number; boxes: SlotBox[] } // length = capacity
interface Body { id: string; name: string; entries: BodyEntry[]; backdrop: Backdrop; aspect: number }

// Replaces Item.slotId and Item.slotSize.
interface SlotRule { mode: 'either' | 'all'; slotIds: string[] }
```

- `Placement` gains an optional slot for Q43.
- The save does not change. `ItemCopy.equipped.slotId` stays: the chosen slot for Either of, the first listed slot for All of. Occupancy of an All of copy comes from the item's rule through the helper, so an author's later edit settles like any other world change.
- Items, Bodies and Slot Size are all absent from v3.5.2, so nothing migrates. `parseBodies`, the import boundary, fills an absent Backdrop, aspect or box with the new-Body defaults. Worlds in `worlds-wip/` load this way.

### Stacking (from the prototype)

```ts
// z-index by area: larger first, stable sort keeps entry then unit order on ties.
const sorted = [...flat].sort((a, b) => b.area - a.area);
```

Fraction areas never flip on an aspect change, because both boxes scale alike. Use `z-index`, not DOM order, so keyboard Tab order stays entry order.

### Amends to closed specs

These supersede the earlier rulings. Fold a note into each spec's ruling when its ticket lands.

- **inventory Q77:** Slot Size retires.
- **bodies-and-equipment Q8, Q18, Q53, Q55:** follow Q39, Q43, Q41 and Q45 here. Q3, Q12 and Q22 stand; this spec builds what Q22 left room for.
- **CONTEXT.md:** Slot and Body stop mentioning slot size. Add Slot Rule, Body Layout, Backdrop and Slot Box. Body's "avoid: paperdoll" stands: a paperdoll is not a Body. Use "doll" only in chat and code names.

### UI and copy

- This is a new visual pattern. Variant B and both outlines need the user's approval through the `design-system` flow before the build. Add a Design System reference and a `devRoutes` entry.
- The Design System's Inventory Tab reference needs a doll and an All of example.
- Label text comes from the Writing Guide at build time, not from this spec. Snap to Others, Either of and All of are working names.

### Bundled worlds

Emberwatch gets the Q44 slots and a layout on both Bodies. The bundled-worlds skill applies.

## Testing Decisions

A good test drives the public seam and asserts what a player or an author sees. It never mirrors the code. Guards must bite: reinstate the bug and watch the test fail. See the `test-bar` skill.

| Seam | Covers | Prior art |
|---|---|---|
| `applyInventoryOps` and the settle | Either of first free, naming a slot, swap-out; All of refusal, multi-slot swap-out, whole item off on a lost slot; reload stability | `inventory.test.ts`, `settle.bodies.test.ts` |
| `buildInventoryContext` | Item line in both modes | `inventoryContext.slots.test.ts` |
| Body Layout module (new) | Box sync, center square, stacking and ties, snap lines, clamps | `bodies.test.ts` |
| World Editor bench | Backdrop choice, capacity adds a box, row and box selection, keyboard moves, slot rule control, placement select | `WorldEditor.equipment.test.tsx` |
| InventoryTab | Doll fills by order, All of in each box, empty box, name fallback, Equip choices, tap actions | `GamePanels.inventory.test.tsx` |
| Sandbox | Script reads and names a slot | `statCodeExecutor.items.test.ts` |
| Playwright, one spec | Real pointer drag, handle resize, snap and hit-through on a margin. jsdom has no layout | `e2e/` |
| Probe | Q41's wording against a no-slot control, on the cloud endpoint | `inventory-slots-probe` |

## Out of Scope

- Layout in scripts or prompts (Q24).
- Moving an item between boxes in a capacity slot, and a move action (Q21, Q28).
- Dragging items onto the doll in play (Q12).
- An item with one-hand-or-two alternatives, such as a bastard sword. One rule per item for now.
- More outlines than two (Q33).
- The doll on an entity's card in the panel. Entity equipment keeps its list view.

## Further Notes

**Prototype.** The question was what the Body Layout should look like in the editor and in play. The verdict is variant B plus Q47–Q49. The source is branch `prototype/paperdoll` at `422d61ba9`, in `src/managers/paperdollPrototype/`. To run it, use the `proto-paperdoll` launch entry in the prototype worktree (port 5262) and open Items → Equipment Settings. The prototype does not build the Slot Rule. It wasn't checked with real touch or in the light theme, and its outlines are first drafts that Q69 replaced.

**Reminders.** World export shape changes (Body, BodyEntry, Item, Placement). The save shape does not.
