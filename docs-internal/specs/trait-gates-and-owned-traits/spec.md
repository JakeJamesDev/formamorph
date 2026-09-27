# Trait Gates and Owned Traits

Status: ready-for-agent
Spec session: Trait gates, owned traits, persona start

## Problem Statement

Every trait in a world is open to every player. An author cannot say "Plate Armor needs the Paladin class". The author can only write it in a description and hope the player reads it.

Traits also belong only to the world, and they describe only the player. This causes three problems:

- An entity cannot carry traits of its own. A companion wolf that is tame, or a knight with a scar, has to be described in free text.
- When the player plays as a world entity, that entity's traits do not come with it.
- A world trait cannot depend on who the player is. "Royal Guard Plate, only when you play as Sir Aldric" has no way to exist.

Finally, a world persona starts at the first of its locations that is also flagged as a starting location. The author cannot name the place where that persona begins.

## Solution

- **Trait gates.** A trait can list requirements. It is available when any one of them holds. A requirement can be a trait, "any trait in a group", or "playing as" a world entity. A locked trait shows in place, disabled, with "Requires Paladin or Knight". When a requirement stops holding, the traits it unlocked turn off, and a banner says what turned off and why.
- **Owned traits.** Any entity can own traits. For an NPC, they describe the NPC to the AI. When the player plays as the entity, they are the player's traits. The player picks owned traits for every entity at enter-world, and can switch toggleable ones during play.
- **One Traits tree.** The World Editor Traits tab, the enter-world trait step, and the in-game Traits tab all show one tree. World traits sit in it with entity nodes, which read as groups. The author places entity nodes anywhere, including inside their own groups.
- **Persona start.** A world persona can name its own starting location. It is preselected when the player picks that persona, and the player can still change it.

Owned traits carry no stat effects yet. Entities will get stats of their own later. When they do, an owned trait's stat effects will target its owner's stats.

## User Stories

### Gates: authoring

1. As an author, I want to give a trait a list of requirements, so that it opens only for players who qualify.
2. As an author, I want a trait to open when any one of its requirements holds, so that "Paladin or Knight" unlocks Plate Armor.
3. As an author, I want a requirement to name a single trait, so that a class can unlock its gear.
4. As an author, I want a requirement to name a group, meaning any trait in it, so that a new class added to the group unlocks the gear without more edits.
5. As an author, I want a requirement to name "playing as" a world entity, so that a trait exists only for one persona.
6. As an author, I want a requirement to name any trait in the tree, including an entity's owned trait, so that "Beast Tamer" can need the wolf's "Tamed".
7. As an author, I want an entity's owned trait to require a world trait, so that the wolf's "Loyal to Paladins" needs the player's Paladin class.
8. As an author, I want to add requirements from a searchable picker that lists traits, groups, and personas, so that I find the target in a big world.
9. As an author, I want each picker row to show where the target lives, such as "Ash › Bond", so that two traits with one name stay distinct.
10. As an author, I want an owned trait named with its owner, such as "Ash's Tamed", so that I know whose trait it is.
11. As an author, I want requirements shown as removable chips joined by "or", so that I read the rule at a glance.
12. As an author, I want a click on a requirement chip to open that trait, so that I can follow a chain.
13. As an author, I want gated rows in the tree to show a lock and a count, with the full rule in a tooltip, so that I see which traits are gated without opening each one.
14. As an author, I want a requirement that points at nothing to show in red, so that I notice broken gates.

### Gates: rules that hold

15. As an author, I want the Test Bench to report a requirement cycle as an error, so that no trait can lock itself forever.
16. As an author, I want the Test Bench to report a requirement that points at a deleted trait, group, or entity, so that I can fix or remove it.
17. As an author, I want a deleted target to leave its dependents locked, not open, so that gated content never becomes free by accident.
18. As an author, I want the Test Bench to flag a default trait whose requirement is not met by the other defaults, so that I learn why it does not start selected.
19. As a player, I want a default trait whose requirement is not met to start unselected, so that the defaults never break a gate.

### Gates: playing

20. As a player, I want a locked trait to stay in its place, disabled, so that I see what exists and what to aim for.
21. As a player, I want each locked trait to say "Requires Paladin or Knight", so that I know how to unlock it.
22. As a player, I want a locked trait that points at something missing to still say what it needs, so that it does not look like a bug.
23. As a player, I want a trait to unlock the moment I pick its requirement, so that the screen answers my choice.
24. As a player, I want traits to turn off when I remove what unlocked them, so that the rules always hold.
25. As a player, I want the cascade to follow chains, so that dropping Tamed also drops Pack Leader and Beast Tamer.
26. As a player, I want a banner that names what turned off and why, so that a change I did not make directly never surprises me.
27. As a player, I want to dismiss that banner, so that it does not stay in my way.
28. As a player, I want switching classes in an exclusive group to cascade the same way, so that picking Rogue drops Plate Armor.
29. As a player, I want traits turned off by a cascade to reverse their stat changes honestly, so that the cascade cannot farm stats.
30. As a player in play, I want the same gates and cascade in the Traits tab, so that the rules do not change after the game starts.
31. As a player in play, I want the story log to note a cascade, so that my history records what happened.

### Owned traits: authoring

32. As an author, I want any entity to own traits, so that characters carry their own qualities.
33. As an author, I want an entity's owned traits in its own groups, with exclusive groups, so that I can offer "pick one temperament" for a companion.
34. As an author, I want to edit owned traits in the Traits tab under the entity's node, so that all traits live in one place.
35. As an author, I want a Traits section in the entity editor too, so that I can work on a character without leaving it.
36. As an author, I want an entity node to appear in the Traits tab once the entity owns a trait, so that the tree does not fill with empty nodes.
37. As an author, I want to add an entity's first trait from the entity editor, so that the node has a way to start.
38. As an author, I want to drag an entity node into my own groups, such as "Companions", so that I organize the tree my way.
39. As an author, I want to drag a trait between the world and an entity, so that I can change who owns it without retyping it.
40. As an author, I want a moved trait to keep its id, so that requirements pointing at it keep working.
41. As an author, I want a drag that would put stat effects on an entity to be refused with a note, so that no data is lost and no world-stat link hides on an entity.
42. As an author, I want owned traits to hide the stat sections, so that I do not author effects that do nothing.
43. As an author, I want entity nodes to show a user icon and an Entity or Playable label, so that I tell them apart from groups.
44. As an author, I want an owned trait to say which entity owns it, so that I know its context while I edit it.

### Owned traits: playing

45. As a player, I want entity nodes in the enter-world tree, so that I can shape the characters I will meet.
46. As a player, I want every entity with owned traits to be pickable, so that the world's cast is mine to adjust.
47. As a player, I want an entity's page to show its portrait in a 2:3 frame beside its name and description, so that I know who I am shaping.
48. As a player, I want the entity I play to stay where the author placed it in the tree, marked "You", so that the tree does not reshuffle when I change persona.
49. As a player, I want my library persona's node, and my added library characters' nodes, at the end of the tree, so that the world's own layout stays as authored.
50. As a player, I want to switch an NPC's toggleable traits during play, so that the wolf can become tame mid-story.
51. As a player, I want an NPC's traits to reach the AI in its full description, so that the story treats it as I shaped it.
52. As a player, I want an NPC's summary to carry only its trait names, so that background mentions stay short.
53. As a player, I want the owned traits of the entity I play to join my own traits for the AI, so that the story treats me as that character.
54. As a player, I want my picks for an entity kept when I switch persona and back, so that I do not rebuild them.
55. As a player, I want "playing as" traits to re-check when I change persona, so that Royal Guard Plate leaves with Sir Aldric.
56. As a player, I want owned trait choices to survive save and load, so that my cast stays as I shaped it.

### Owned traits: library and import

57. As a player, I want a library entity's owned traits to come with it into any world, so that my persona is the same everywhere.
58. As an author, I want an exported entity's requirements on world traits to be kept by name, so that they can rebind in another world.
59. As a player, I want such a requirement to bind to a same-named trait in the new world, so that the gate still works there.
60. As a player, I want a requirement with no match to leave its trait locked, showing what it needs, so that gated content never leaks free.
61. As a player loading a world made before this change, I want every trait to behave as before, so that nothing old breaks.

### Persona starting location

62. As an author, I want to set a starting location on a world persona, so that playing as that entity starts where it belongs.
63. As an author, I want to pick any location, even one not flagged as a starting location, so that a persona can start somewhere private.
64. As an author, I want an Automatic choice that keeps today's behavior, so that I only set it when I care.
65. As a player, I want the persona's starting location preselected when I pick it, so that the start matches who I am.
66. As a player, I want to change that preselected location, so that the choice stays mine.
67. As a player, I want the persona picker to say where each persona starts, so that I know before I choose.
68. As a player, I want the Starting Location step to list the persona's location even when it is not flagged, so that the preselection is visible and changeable.

## Implementation Decisions

### Data

- **Requirements.** A trait gains an optional list of requirements. Absent or empty means always available. Shape, from the prototype:

  ```ts
  type Requirement =
    | { kind: 'trait'; id: string }
    | { kind: 'group'; id: string }
    | { kind: 'playingAs'; id: string };
  ```

  Off-world (entity file, library, character card), a requirement that points into the same entity keeps its id and travels with the entity. A requirement that points out of the entity, at a world trait or group, also stores the target's name. Import rebinds it by name only when exactly one trait or group in the new world carries that name. Import binds by id first when the origin id still exists in the receiving world, then by unique name. No match, or more than one, leaves it unresolved and clears the id, so it can never resolve by accident. A "playing as" on the entity itself points inside and follows the copy, as duplication does. At enter-world an unresolved requirement reads "Requires <stored name>", locked, with no further hint.
- **Owned traits.** An entity gains optional owned traits and owned trait groups. They reuse the trait and group shapes. Owned traits carry no stat changes and no stat toggles. They keep requirements and placeholder pins.
- **Tree placement.** An entity gains an optional placement in the world trait tree: a parent world group and a sibling order. Absent means top level. A placement whose group no longer exists reads as top level. The parent is always a world group, never another entity's node or owned group.
- **Persona start.** An entity gains an optional starting location id. It applies only to a world entity with the Persona mark.
- **Save.** Owned trait state is stored per owner: for each entity id, the chosen owned trait ids and the ones switched off in play. The player's world traits keep their current save fields. Owned traits need no applied-value records, because they carry no stat effects. Every owner, the player included, also stores the ids a cascade turned off, so that a return can tell them from a hand switch-off. Load prunes both the owned-trait map and the cascade-off list to the entity ids the playthrough still holds: world entities, added characters, and the library persona.
- **Playing-as off-world.** An exported requirement of kind `playingAs` stores the entity's name and rebinds by the same unique-name rule against the new world's personas.
- **Export shape.** Every item above is an additive change to the exported world, entity, and save shapes. Each ticket that adds one states it in its response.

### The gate module (new, pure)

- One module owns all gate logic. No UI and no context read it any other way.
- Input: the combined traits (world and every owner), the groups, the active set for each owner, and the persona ref.
- Output: for each trait, whether it is unlocked, and for a locked one the reason text parts ("Paladin", "Ash's Tamed", "any Class", "playing as Sir Aldric", or the stored name of an unresolved target).
- `settle`: takes proposed active sets and returns the settled sets plus the list of traits that turned off, in cascade order. It builds the settled set from the ground up: a proposed trait with no requirements is kept; a proposed trait whose gate holds against the kept set joins it; repeat until nothing joins. Every proposed trait left outside turned off. Two traits that require only each other therefore never hold each other up, and a gated default whose chain has no open root starts unselected.
- The turned-off list orders dependents before their prerequisites, so that a caller reversing stats does so in one deterministic order.
- A trait requirement holds when that trait is active on its owner. A group requirement holds when any trait below the group in the tree is active, including traits of entity nodes placed inside it. "Playing as" holds when the persona is that world entity.
- An unresolved requirement never holds.
- Exclusive groups keep their rule. Picking a sibling retires the others first, then `settle` runs.
- An exclusive sibling never holds a trait up. A requirement on a sibling in the trait's own exclusive group can never hold once the trait is picked, so it counts as unsatisfiable: the trait reads locked, and a trait with no other way open is never unlockable. (Found in ticket 01 review.)
- **Return.** `settle` also switches an acquired trait back on when its gate holds again, but only a trait a cascade turned off. A trait the player switched off by hand stays off. A return never retires an exclusive sibling: when the player has picked one since, the trait stays off and leaves the cascade-off list.
- **Never-unlockable sets** are what the Test Bench reports, not plain loops. A trait is unlockable when some requirement of it can hold through a chain that reaches a trait with no requirements, a persona, or a group with such a trait. "A requires B or C, B requires A" passes, because C opens A. A set with no such path is the error, and the finding lists its members.

### Callers of the gate module

- **Enter-world:** each selection change and each persona change goes through `settle`. Default traits collapse through it at open, so a gated default whose requirement is off starts unselected.
- Enter-world keeps a cascade-off list for the visit, world and owned traits alike, so a gated pick returns when its gate holds again, under the same return rule as play. Switching persona and back keeps every pick, gated ones included.
- **In play:** trait switches in the trait runtime, persona changes, and stat-code trait switches go through `settle`. World traits it turns off reverse their stats through the existing honest reversal. The story log notes a cascade with the existing switch-log wording.
- **Stat code meets gates.** Code ignores Player Can Toggle but not gates. A code switch-on of a locked trait acquires it and `settle` turns it off in the same pass, with a switch-off log line. A switch-on the gate refuses retires no exclusive sibling. The trait joins the cascade-off list, so it returns once its gate holds. The sandbox's `traits` entries do not change.
- **Banner and log in play.** The banner shows for a cascade the player's own switch or persona change caused. A cascade stat code caused writes only story log lines. A return writes the existing "Trait switched on" line and no banner.
- **Cascade-off list in the save.** One additive field on the game state, keyed by owner id with the player's world traits under `world`. It rides in turn snapshots, so rewind and undo restore it.
- The cascade banner reads the turned-off list from `settle`.

### One tree

- The existing trait tree module gains entity nodes. It places world entity nodes by their placement, and places library entity nodes (persona or added character) after everything at top level, in the order added.
- An entity node appears only when its entity owns a trait or a group, so an owned group is never stranded outside the tree.
- The editor tree and the enter-world workspace both build from it. The in-game Traits tab uses the same tree.
- Drags go through the shared drag layer (ADR-0007). A trait drag across owners changes the owner and keeps the id. A group drags across owners with its whole subtree, every id kept. Either is refused when a trait in it has stat changes or stat toggles. The refusal shows one dismissible line above the Traits tree, the cascade banner's shape, naming the trait: "Plate Armor stays a world trait, because an entity's traits can't change stats. Remove its stat changes and stat toggles first." The item snaps back. An entity node drags like a group, and the drop projection never offers an indent into an entity node or an owned group, so that case needs no note.

### Editor (prototype variant A)

- Tree rows: an entity node shows a user icon in the folder icon's slot, with "Entity" or "Playable" as meta. A gated trait row shows a lock and the requirement count, and the full rule as a tooltip. An unresolved requirement tints it red.
- Trait panel, Details tab: a **Requires** field. Its hint reads "Available when any one of these holds". Chips join with "or", and each has a remove button. **Add Requirement** opens a searchable picker in three sections: Traits, Any Trait in a Group, Playing As. Each row shows where its target lives.
- An owned trait shows its owner at the top of Details and has no Stats tab.
- The entity editor gains a Traits panel tab, after Descriptions, that lists the entity's owned traits and groups, opens each in the Traits tab, and adds new ones (groups in Advanced only). The first add creates the entity node. Selecting an entity node in the Traits tab shows this same section in the right panel. The Traits-tab toolbar's Add buttons keep adding to the world root. The World Editor gets the tab first; the library entity editor gets it with the library ticket, where requirements can point only inside the entity and the picker has no Playing As section; an existing self "playing as" still shows as a chip.
- The owner line reads "Owned by **Ash**", the name a link to the entity, with the hint "Describes them to the AI, and joins your traits when you play as them".
- Duplicating an entity re-ids its owned traits and groups and remaps the requirements that point inside it. Requirements that point out of it keep their ids. A "playing as" requirement on the entity itself remaps to the copy, since it names the owner. A world persona gains a Starting Location select, with Automatic first and then every location.

### Enter-world and in play (prototype variant A)

- Nav rows for entity nodes show the user icon. An entity's page opens with its portrait in the Persona picker's 2:3 frame, beside the name and player description. The played entity is marked "You". An entity's page and its owned-group pages show group descriptions from the entity node down only, never those of the world groups around it. Owned defaults preselect per entity, so a player can leave the cast as authored and move on.
- Locked traits stay in place, disabled, with a lock icon and a "Requires … or …" line. An unlocked gated trait shows "Unlocked by …".
- "Unlocked by …" lists only the requirements that hold now, such as "Unlocked by Knight". The locked line already states the full rule.
- A cascade shows one dismissible banner: "Turned off Plate Armor, because of Rogue." The cause is what the player picked. After a persona change it is the new persona's name, or "the persona change" when the player picked None.
- An unresolved requirement with no stored name, a target deleted inside the world, reads "a missing trait", "any trait in a missing group", or "playing as a missing persona".
- The persona picker shows "Starts at …" under a persona with a starting location. Picking it preselects that location through the existing persona location pick, which now prefers the explicit field. The Starting Location step lists that location even when it is not flagged, but only while that persona is picked. A switch to a persona that does not name it drops the selection back to the automatic pick: the new persona's explicit field, else its first flagged location, else Random, with the hand-pick flag cleared. A hand pick of a flagged location survives a persona switch, as today. "Starts at …" shows only for an explicit field, never for the automatic rule. A field naming a deleted location acts as Automatic.

### AI context

- An NPC's active owned traits join its entity context. The full context gets each trait's AI description under the trait's name. The summary gets one "Traits: …" line of names.
- The played entity's active owned traits join the player's trait context, beside the world traits.
- An owned trait's text is the entity's own text: `{{char}}` reads as the owner's name, and the trait's own pins apply, in the AI context and on the in-play trait card alike.
- Both are prompt-text changes and follow the prompt-writing guide, including probes.

### Placeholder pins

- Every active owned trait lays its pins, on any owner. The pin collector lays owned traits first, in tree order per owner, then the player's world traits and the played entity's owned traits. The later pin wins, so the player's picks beat the cast's.
- Within the player's set, world traits and the played entity's owned traits lay together in one-tree order.
- The Test Bench lens and the pin-conflict rule read every owner's active traits. The lens has no persona, so its owned traits are each entity's owned defaults settled with persona None; a pin label reads "Trait: Ash's Tamed". A placeholder's Pins list and conflict note list owned-trait pins too, edits write back to the owning entity, and traits of one exclusive owned group count as never together.
- In play, the Traits tab shows every world entity that owns traits, met or not, plus the library persona, as entity sections with the user icon and "You" on the played one. Non-toggleable owned traits are read-only rows. In the log and the banner an NPC's owned trait reads "Ash's Tamed"; the played entity's read bare, like world traits.

### Delivery order

Gates on world traits come first and ship on their own. Owned traits, the one tree, entity pages, and the persona start follow.

## Testing Decisions

- A good test drives a public seam with a small world and asserts what the player or author would see: which traits are unlocked, what turned off, what the AI reads, what a round-trip keeps. It does not assert internal order or private helpers.
- **Gate module (main seam).** Unit tests cover any-of, trait, group, and playing-as requirements, requirements across owners, chained cascades and their off-order, exclusive-group retirement followed by a cascade, persona switches, unresolved requirements, mutual-requirement defaults that collapse, a code switch-on of a locked trait, a return after the gate holds again, a hand switch-off that never returns, a return blocked by a picked sibling, never-unlockable sets against a loop that opens through a third trait, and default collapse. Each guard is proven to fail when its rule is removed (see the test-bar skill).
- **Trait tree.** Extend the existing trait tree tests: entity nodes placed in world groups, library nodes last, nodes hidden when their entity owns nothing, and cross-owner drops that keep ids or are refused for stat effects.
- **Import and export.** Extend the entity file and adoption tests: self-owned requirements keep ids, outward ones keep names, rebind on a unique name match, and stay locked with no match or two matches.
- **Save.** Extend the trait save round-trip test with per-owner owned state, the cascade-off list, picks kept across a persona switch, and state dropped for a removed entity.
- **Trait runtime.** Extend its tests so that a cascade in play reverses stats honestly and toggling stays neutral.
- **UI wiring only.** Component tests on the trait panel (prior art: `TraitManager.test.tsx`) for the Requires field, and on the setup trait list for disabled rows and the banner. Logic stays in the gate module's tests.
- **Test Bench.** New rules for never-unlockable sets, unresolved requirement, and gated default. The prior art is the existing pin rules. One finding per root cause: the never-unlockable rule treats a trait with an unresolved requirement as openable, so a dead target is reported once, and any loop behind it shows after the author fixes it. The gated-default warning fires only when the default starts unselected under every persona choice the world offers, and skips a default the two error rules already report. The Requires field is Simple-mode visible, so none of the three rules is `advanced`.
- **Persona start.** Extend the persona pick tests: the explicit field wins, Automatic falls back, an unflagged location is offered while its persona is picked, and a switch away drops it.
- **Pins.** Extend the pin collector and Test Bench lens tests: an NPC's owned trait pins, and a player trait wins the same placeholder.

## Out of Scope

- Stat effects on owned traits, and entity stat blocks. The per-owner save state and the "no stat effects" editor rule leave room for them.
- Gates that match personas by tag, so that library personas qualify.
- All-of requirements. Chained gates cover them.
- Traits hidden until unlocked.
- Changes to the Persona feature beyond the starting location field.
- NPC trait surfaces outside the Traits tree (the entity details panel in play, for example).

## Further Notes

- **Prototype:** branch `prototype/trait-gates`, commits `f7562b76` (three concepts) and `9207a89f` (portrait fix). Launch config `proto-trait-gates`, port 5214. Editor: `?variant=A#dev?view=mainMenu&modal=worldEditor&tab=traits`. Enter-world: `?variant=A#dev?view=mainMenu&modal=enterWorld`.
- **Verdict:** variant A won (inline requirements; locked rows in place; a cascade banner). Round avatars were rejected, because entity pictures are portrait-shaped. Tree rows use a glyph, and entity pages use the 2:3 frame.
- **Question the prototype settled:** what gates, entity nodes, and locked traits look like in the editor and at enter-world. Variant B (unlock branches, Gates tab) and C (gates overview, locked shelf) remain on the branch for reference.
- **Decided while writing:** a group requirement counts traits of entity nodes placed inside the group. This follows "anything in the tree". Raise it if it reads wrong.
- **Grilling record:** the design was grilled on 2026-09-26 (Q1–Q33), and again after review the same day (Q34–Q41: never-unlockable sets, return after cascade, playing-as by name, dropped state, pins on every owner, cascade-off list, sibling wins, player pins last). The decisions above carry the answers.
