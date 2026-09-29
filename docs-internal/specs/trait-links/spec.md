# Trait Links

Status: ready-for-agent
Spec session: trait-links — spec

## Problem Statement

A trait belongs to exactly one owner: the world or one entity. That works for a trait that is unique to its owner, such as "Albus's Oath". It fails for a trait that many bearers share.

In an RPG world, Paladin is a class. Albus the Paladin should have it. The player should be able to pick it too, and so should any other playable entity. Today the author has to make one copy of Paladin for every entity. Each copy then drifts on its own: an edit to one class description does not reach the others.

Three more problems follow from this:

- **Pins are global.** Every active trait on every owner lays its pins into one set, and the player's picks win. If Albus is a Paladin and the player is a Wizard, Albus's description reads the Wizard's garb.
- **Gates are not per bearer.** "Smite requires Paladin" has no way to mean "Paladin on the same entity that has Smite".
- **A world persona joins the cast when not picked.** A "Custom Character" persona that exists only as a player slot joins the cast while the player plays someone else.

## Solution

- **Links.** In Advanced mode, the author drags a trait or group under an entity to create a link. A link shows a link icon, like a shared placeholder row. It reads the original's text, gates and pins live. Edits to the original reach every link. A link stores only its own defaults and pin values.
- **Bearers.** An entity with a trait, directly or through a link, is that trait's bearer. The player is one bearer: the persona they picked, marked "You".
- **Templates.** A system group that holds originals only. Traits under it are never offered directly. They reach play only through links.
- **Custom Persona.** A system node whose links apply when the persona is None or a library persona.
- **Persona-only entities.** An entity mark: the entity exists only while it is the picked persona, and it never joins the cast.
- **Per-bearer gates and pins.** A requirement means the same bearer by default, and can name a bearer instead. A pin can target the bearer's own placeholder by name. A cast entity's own pins apply only in its own text.
- **Faster authoring.** The Traits tab's **+** menu adds a trait or group straight onto an entity. A link button on any linkable node links it to a bearer from a flyout.

## User Stories

### Links: authoring

1. As an author, I want to drag a trait under an entity to link it, so that I write Paladin once and give it to many entities.
2. As an author, I want to drag a group under an entity to link it, so that the entity can pick from the whole Classes group.
3. As an author, I want a linked group to show its live subtree, so that a class I add to Classes later appears under every entity that links it.
4. As an author, I want a linked group to keep the original group's exclusivity, so that an entity still picks one class.
5. As an author, I want a link row to show a link icon, so that I can tell a link from an owned trait at a glance.
6. As an author, I want to place a link anywhere in the entity's subtree, so that the entity's traits read in the order I choose.
7. As an author, I want edits to the original to reach every link, so that a class description stays consistent.
8. As an author, I want a link to store its own default-on state, so that Albus starts as a Paladin while Custom Character starts with no class.
9. As an author, I want selecting a link to show the original's editable Details under a "Linked from …" line, so that I know an edit changes every link.
10. As an author, I want a section for the link's own settings below the original's Details, so that per-link data is in one place.
11. *Dropped on review (Q50).* Links point at world originals only. To share Albus's Oath with Mira, the author moves it to Templates and links both.
12. As an author, I want the row action on a link to read **Detach**, not **Duplicate**, so that I can turn a link into the entity's own copy.
13. As an author, I want Detach to give the copy a new id and drop the link, so that the copy is independent of the original. When the original has stat changes or stat toggles, the copy is made without them, after a confirmation that says so (Q53).
14. As an author, I want deleting an original to delete its links after a confirmation that names the count, so that no link points at nothing.
15. As an author, I want deleting an entity to take its owned traits and its links with it, so that no trait state outlives its bearer.
16. As an author, I want removing a link to leave the original untouched, so that I can unlink without loss.

### Templates and Custom Persona

17. As an author, I want to add a Templates group from the **+** menu, so that I can keep originals that are not offered directly.
18. As an author, I want traits under Templates never to be offered directly, so that Classes shows only where I linked it.
19. As an author, I want to add a Custom Persona node from the **+** menu, so that I can give Race and Class to a player with no world persona.
20. As a player with no persona or a library persona, I want Custom Persona's links as my traits, so that I can still pick a race and class.
21. As a player, I want my Custom Persona picks kept when I switch between None and a library persona, so that I don't pick my class twice.
22. As an author, I want at most one Templates group and one Custom Persona node, so that the tree has one meaning for each.
23. As an author, I want to remove Templates and have its contents move to the root, so that nothing I wrote is lost, the same as removing a group.
24. As an author, I want removing Custom Persona to delete its links after a confirmation that names the count, so that its classes don't leak onto every persona.
25. As an author with Advanced off, I want non-empty system nodes and links to still show and stay editable, so that a world built in Advanced doesn't look broken.
26. As an author with Advanced off, I want creating system nodes and links to stay Advanced-only, so that a first-time author isn't faced with them.

### Persona-only entities

27. As an author, I want to mark a persona as persona-only, so that Custom Character exists only when the player picks it.
28. As a player who picks Albus, I want Custom Character absent from the world, so that I never meet an empty player slot in the cast.
29. As a player, I want a persona-only entity's Others openings never to draw, so that its openings never run for someone else. Picked, it is the played entity and persona story 54 keeps its Others openings out, while its Self openings draw; unpicked, it is absent (Q80, amended by Openings Refresh Q8).

### Bearers in play

30. As a player, I want my picked persona's links and owned traits to be my traits, marked "You", so that playing Albus means playing his tree.
31. As a player, I want to change a cast entity's link defaults at enter-world under the owned-trait rules, so that I can make Albus a Cleric if the author allows it.
32. As a player, I want a cast entity's linked traits described to the AI like owned traits, so that the narrator knows Albus is a Paladin.
33. As an author, I want `{{char}}` in a trait's text to read as the bearer, so that one Paladin text names Albus on Albus and the persona on me.
34. As an author, I want a linked trait's stat effects to do nothing on a cast entity for now, with a note in the editor, so that I can share Paladin (+Faith) and it works once entities have stats.
35. As a player, I want a linked trait's stat effects to apply when I bear it, so that my Paladin gets its Faith.

### Gates per bearer

36. As an author, I want "Smite requires Paladin" to mean Paladin on the same bearer, so that the player's Wizard never unlocks Smite through Albus.
37. As an author, I want a requirement that names a bearer, such as "requires Albus: Paladin", so that I can write cross-entity gates.
38. As an author, I want to name **You** in a requirement, so that "Squire requires You: Paladin" gates a cast entity on the player's class.
39. As an author, I want the named-bearer picker to list You plus every entity that bears the trait, so that I only pick bearers that can hold it.
40. As an author, I want the Test Bench to warn when a linked trait can never unlock for its bearer, so that I find "Albus links Smite but has no Faithful".

### Pins per bearer

41. As an author, I want a trait pin to target "the bearer's own Class Garb", so that one Paladin pin reaches every bearer's own placeholder.
42. As an author, I want a bearer-relative pin to fall back to the world placeholder of that name, so that a library persona with no Class Garb still gets a description.
43. As an author, I want each link to pick the pinned value from that bearer's own values, so that Albus's Paladin garb reads differently from Custom Character's.
44. As an author, I want the Test Bench to warn when a link has no value for a bearer-relative pin, with a jump to the link, so that I don't ship an unset description.
45. As a player, I want a cast entity's own pins to apply only in its own text, so that Albus's class never changes my description.
46. As a player, I want world-level text to resolve with the world pins plus mine, so that locations and narration follow my picks.

### Faster authoring

47. As an author, I want **Add Trait To Entity →** in the **+** menu, so that I add an owned trait without leaving the Traits tab.
48. As an author in Advanced, I want **Add Group To Entity →** beside it, so that I add owned groups the same way.
49. As an author, I want the first add to an entity to create its node, and the new row to be selected in place, so that I keep working in the tree.
50. As an author in Advanced, I want a link button on every linkable node, so that I link it to a bearer without dragging.
51. As an author, I want the link flyout to show bearers that already have the link as checked and disabled, so that I can see who has it and can't remove it by a misclick.
52. As an author, I want both flyouts to nest entities by entity group, with Custom Persona at the top when it exists, so that they mirror the entity folders.

### Library and import

53. As a player, I want a library entity's links to travel with it by name, so that my library Paladin stays a Paladin in another world that has Paladin.
54. As a player, I want a link to rebind by id first and then by unique name, and to drop when neither matches, so that a link never binds to the wrong trait.

### Added on review (2026-09-27)

55. As an author, I want a link refused when the bearer's tree already holds that original, directly or through a linked group, so that one bearer never shows one trait twice.
56. As a player who switches persona in play, I want the new persona's active linked stat traits applied and the old one's reversed, so that Faith follows whoever I play.
57. As an author, I want the Test Bench to check every bearer as if picked, persona-only entities and Custom Persona included, so that no tree goes unchecked for being unpicked.
58. As a player with no persona, I want `{{char}}` in a Custom Persona trait to read as my player name, so that one name stands for me in every trait text.

## Implementation Decisions

### Terms

- **Link:** a tree node under a bearer that points at an original trait or group. It is not a trait.
- **Bearer:** an entity (or Custom Persona) whose tree holds a trait, directly or through a link. The played persona is the bearer "You".
- **Cast entity:** a world entity that is not the played Persona (the glossary's cast). Never "NPC".
- **Original:** the world trait or group a link points at, at the root or under Templates. An owned trait is never an original (Q50).
- These terms should join `CONTEXT.md` when this effort lands (see the domain-modeling skill).

### Data

All items are additive export-shape changes to the world, entity, card and save files. Each ticket that adds one states it in its response. Owned traits are unreleased (not an ancestor of `v3.0.1`), so no migration is written for their current shape.

- **Link node.** An entity's owned tree gains link items beside owned traits and groups. A link has its own id, the original's id and kind (trait or group), a stored original name for off-world travel, a place in the tree (parent and order), and per-link data:
  - default-on state, keyed by original trait id so that a linked group can set defaults for its children;
  - pin values for bearer-relative pins, keyed by original trait id and target placeholder name.
- **One original per bearer.** A bearer's tree holds each original at most once, directly or through a linked group. Link creation and the flyout refuse a second link; import drops it (Q49). For the player bearer this counts the root traits and groups outside Templates, so Custom Persona cannot link a trait already offered at the root (Q58).
- **Absent default-on reads the original live.** A link with no stored default-on for a trait reads that trait's own `isDefault`. The This Link section writes a value only when the author touches it, so a later-added default child of a linked group starts on (Q57).
- **Templates holds world originals only.** An entity node cannot be placed under Templates; the placement projection refuses it, and a placement that names Templates reads as top level, the same as a missing group (Q59).
- **System nodes.** The world gains an optional Templates group and an optional Custom Persona node. At most one of each exists. Custom Persona holds links only. Both stay at the root: the drop projection refuses moving either into a group (Q68).
- **Persona-only mark.** An entity gains an optional persona-only flag. It is read only with the Persona mark.
- **Bearer-relative pin target.** A trait's placeholder pin can target a placeholder by name relative to the bearer instead of by id. It binds to the bearer's own placeholder with that name. If there is none, it binds to the world placeholder with that name. The link's per-link value supplies the pin in both cases; on fallback the author picks it from the world placeholder's values. The pin's own value is only the starting value a new link copies when it binds to the world placeholder (Q51).
- **Named-scope requirement.** A requirement gains an optional bearer scope: absent means the same bearer, otherwise You or an entity id (with a stored name for off-world travel).
- **Save.** Active state is keyed by bearer and holds original ids. The Custom Persona bearer uses the player's world key, so None and library personas share it. The cascade-off list follows the same keys. Load prunes bearers the playthrough no longer holds.

### Bearer resolution (new, pure module; the main seam)

- Input: the world (traits, groups, system nodes, entities with their owned trees and links) and the persona ref.
- Output: every bearer's effective tree (links expanded to their originals' live subtrees, Templates left out), the cast with persona-only entities left out unless picked, and the gate input the gate module already takes, with one owner per bearer.
- Rules it owns:
  - Root traits outside Templates stay the player's, whatever the persona.
  - Custom Persona's links apply to the player when the persona is None or a library persona.
  - A world persona's bearer tree is its own owned traits and links.
  - A link whose original is missing resolves to nothing. Delete cascades keep this from happening in normal authoring.
  - Originals are world nodes and world nodes hold no links, so expansion is one level deep and cannot cycle. A linked group's subtree never includes entity nodes placed inside it (Q50).
- The editor tree, the enter-world workspace, the in-game Traits tab, the pin collector, the AI context and the Test Bench lens all read bearer trees from this module. None of them expands links on its own.

### Gate module (existing)

- `settle` and `gateStates` run per bearer. A requirement without a scope holds when its target is active in the same bearer's set. A named requirement holds when the target is active in the named bearer's set. You means the played persona's set.
- The player bearer's set is the union of the world root owner (root traits outside Templates, plus Custom Persona's links under None or a library persona) and the played entity's owner (its owned traits and links). A scopeless requirement on either side, and a named You requirement, checks that union (Q74).
- No compat for scopeless requirements that pointed across owners. The shape is unreleased and no world uses it (Q54).
- Never-unlockable analysis runs per bearer, so a linked trait whose requirement no link or owned trait on that bearer can meet is reported.

### Pins (existing collector)

- The pin collector takes a bearer context. An entity's text, and its traits' text, resolve with that bearer's active pins laid over the world pins and, for a cast entity, over the player bearer's pins (Q79).
- World-level text (locations, the world prompt, narration context) resolves with the world pins plus the player bearer's.
- This replaces the trait-gates ruling that every owner's pins lay into one set with the player's last.
- Bearer-relative targets resolve per bearer, and their value comes from the link's per-link data. A link with no value lays no pin.
- "World pins" are the non-trait sources: location, stat bands, value pins, Code Pins. Kind precedence is unchanged; the bearer context only swaps which trait set lays. The played persona's own text uses the player bearer's set (Q75). A cast entity's text resolves as world pins, then the player bearer's trait pins, then that entity's own trait pins on top, so a world-wide fact the player pins reads the same everywhere and the entity still wins a contested placeholder in its own text (Q79).
- A bearer-relative pin on a trait the bearer holds directly, with no link, applies the pin's own value, bound by name to the bearer's own placeholder, else the world's (Q76).
- The player bearer's own placeholders: the world persona's, or the library persona's, or under None the world's. Custom Persona links under a library persona bind to that persona's placeholder first (Q77).
- In a placeholder's Pins list, a link pin is a trait row named "Albus's Paladin" with the link's value. Edits write the link's value; Remove clears it; the source select is fixed. The conflict note treats two trait pins as rivals when they can lay in one text: two on one bearer, or the player's against a cast entity's, which meet in that entity's text where the entity wins. Two cast entities never meet. A world trait and a Custom Persona link count as the player's (Q78, amended by Q79). The editor has no persona, so a Persona-marked entity's traits count as both its own and the player's (Q82).

### Editor

- Drags go through the shared drag layer (ADR-0007). A world row (root, world group, or Templates) dropped into an entity creates a link and the original stays put. A drag that starts from an owned row is still a move that keeps its id, with the stat-effects refusal (Q60). A link row dropped into another entity moves with its per-link data, refused when the target already holds the original; a link row is never droppable at the root or in a world group (Q61). A refused drop does nothing and shows the stat-effects refusal's inline notice with the reason (Q62). A world-to-world move can still nest one original under another the same bearer links; the resolver yields each original once per bearer, first in tree order, and the Test Bench reports the redundant link (Q64).
- The drop projection lets links sit anywhere in a bearer's subtree. It never offers a link inside Templates or at the root.
- The link row shows a link icon in the trait icon's slot. Its row action menu shows **Detach** where an owned row shows **Duplicate**. Detach of an original with stat changes or stat toggles confirms first and makes the copy without them (Q53).
- Selecting a link shows the original's Details, editable, under "Linked from **<location>**. Edits change every link." Below that is a **This Link** section with default-on and one row per bearer-relative pin: "<Placeholder> →" and a value select over the bearer's own values, or the world placeholder's values on fallback.
- A linked trait with stat effects under an entity shows a note in the link section: under a Persona-marked entity, "Stat changes apply only when you play as them"; under any other entity, "Stat changes don't apply to entities" (Q63).
- **+ menu:** Add Templates Group and Add Custom Persona (Advanced, hidden once present), Add Trait To Entity → (Basic), Add Group To Entity → (Advanced).
- **Link button:** on every linkable node's Details header, in Advanced only, and on a selected link row, where it acts on the original. Never on owned items, entity nodes, Templates or Custom Persona (Q71). Its flyout lists Custom Persona first when it exists, then world entities nested by entity group in entity-tab order. A bearer shows checked and disabled when the drag path would refuse it: a direct link, a linked group that brings it, or Custom Persona when the top level already offers it (Q72). A pick appends the link to the bearer's top level; the flyout stays open and the selection stays on the original (Q73).
- **Add flyouts:** list world entities only, never Custom Persona, which holds no owned items (Q69). In Basic the **+** becomes a two-row menu: Add Trait, Add Trait To Entity → (Q70). A pick appends the owned item to the entity's top level, closes the popover, expands the node and selects the new row (Q73).
- Removal confirmations name the count of links they remove. Removing Templates keeps Custom Persona's links to the moved originals; the Q64 rule covers the resulting duplicate (Q66).
- Selecting the Custom Persona node opens a small panel: a heading and one help line on when its links apply, in the Writing Guide's voice (Q67).
- Until tickets 05 and 08 move play onto the resolver, the player-facing tree and the world gate owner drop the Templates subtree through an interim filter, so no build between them offers a Templates trait (Q65).
- Both flyouts and the link row are new visual patterns. They need design-system approval before adoption.

### Enter-world and play

- Entity pages and the in-game Traits tab show the bearer tree in author order, with links and owned traits together. Under None or a library persona, Custom Persona's links merge into the player's root categories with no separate heading (Q83). A played persona's link to an original the root already offers shows once, at the root, with one stat record; the Test Bench reports it as redundant (Q84).
- The player picks a cast entity's link defaults under the existing owned-trait rules. Toggling in play follows the original's Player Can Toggle for every bearer (Q52).
- A persona switch in play applies the new persona's active linked stat traits and reverses the old one's, through the honest reversal path, like traits turning on and off (Q53).
- The persona cast filter leaves out an unpicked persona-only entity everywhere the cast is read: the roster, participation, diaries, discovery, scene tags, the planner, the entity panel, and the opening pool. A persona-only entity's Others openings therefore never draw; its Self openings draw when it is the pick (Q80, amended by Openings Refresh Q8). The Persona-only switch shows in the world entity editor only; a library entity is never in a cast (Q81).

### AI context

- A cast entity's active linked traits join its entity context the same way as owned traits: the full context gets full text, and the summary gets names.
- `{{char}}` in any trait's text reads as the bearer's name. On the Custom Persona bearer under None it reads as the player name, as `{{user}}` does (Q56). On the whole player bearer, root traits included, `{{char}}` reads exactly as `{{user}}`: the persona's name, or "the player" under None (Q89). Roll priming walks every bearer's traits with bearer-relative pins bound and skips unbound ones (Q90).
- These are prompt-text changes and need probe numbers (probe skill).

### Library and import

- Links off-world store the original's name. Import binds by id when the origin id exists in the receiving world, then by unique name, else drops the link. This is the same rule as outward requirements. A link whose original the bearer's tree already holds drops too (Q49).
- Named-scope requirements travel the same way, by bearer name.
- A linked group's per-link data is keyed by child id. Off-world the link also stores each keyed child's name. Import binds each key by id within the rebound subtree, then by unique name there, else drops it, so a library persona's picked class survives (Q85). Additive off-world field, stripped at bind.
- Inside a world, the library entity editor shows the entity's links live against that world with the This Link section, Remove and Detach. It makes no new links; those are made on the world copy in the World Editor. Standalone, links show read-only by stored name (Q86).
- A library persona's links to world originals bind at enter-world against the world being entered.

### Test Bench

- New rules: never-unlockable per bearer (extends the existing rule), a link with no value for a bearer-relative pin, a bearer-relative pin whose name matches no placeholder on the bearer or the world, and a redundant link whose original another link on the same bearer already reaches (Q64).
- The lens reads bearer trees through the bearer-resolution module. It checks every bearer as if picked: world personas, persona-only entities, and Custom Persona as the None player with the root traits (Q55). This is the rule pass, not a picker: the lens itself reads the None player bearer, and the gate analysis runs once per persona choice, so a persona's linked trait that unlocks only while played passes (Q87).
- The redundant-link rule reports: a link whose original another link on the same bearer brings through a linked group; two links on one bearer to one original; a Custom Persona link the root already offers or another Custom Persona link brings; a Persona-marked entity's link the root already offers. The jump lands on the redundant link, which in the group case is the one whose original sits inside the other link's group, whatever the tree order (Q88).

## Testing Decisions

- A good test drives a public seam with a small world. It asserts what the author or player would see: which traits a bearer has, what is unlocked, what text resolves to, and what a round-trip keeps. It does not assert internal order or private helpers.
- **Bearer resolution (main seam).** Table-driven cases: link to a trait, link to a group with a later-added child, a refused duplicate link, a linked group with an entity node placed inside it, Templates hidden at root, Custom Persona under None and under a library persona, a world persona's tree, a persona-only entity in and out of the cast, and a link to a missing original.
- **Gate module.** Extend its tests: a same-bearer requirement that fails through another bearer, a named-scope requirement on a cast entity and on You, a persona switch that changes You, and never-unlockable per bearer. Trait runtime: a persona switch that applies and reverses linked stats.
- **Pin collector.** Extend its tests: a bearer-relative pin on a bearer with its own placeholder, fallback to the world placeholder, a link with no value, a cast entity's pin absent from world-level text, a player pin present in world-level text and in a cast entity's text under that entity's own.
- **Round-trips.** Extend the portable-traits and save tests: links by name, rebinds by id then unique name, a dropped link, per-bearer state, Custom Persona state shared by None and a library persona, and pruning of a removed bearer.
- **Test Bench.** New rules with the existing pin rules as prior art.
- **UI wiring only.** Component tests for the link row, the This Link section, the **+** menu entries and the link flyout. Logic stays in the pure modules.
- Every guard is proven to fail with its rule removed (test-bar skill).

## Out of Scope

- Entity stat blocks. Linked stat effects on a cast entity stay inert until they exist.
- All-of requirements.
- Overriding any field of a link other than default-on and bearer-relative pin values. Detach covers deeper changes.
- Links to another entity's owned traits or groups (Q50).
- Offering links to library personas by tag.
- The RPG example world itself. It is the next effort and consumes this one.

## Further Notes

- **Origin:** grilled on 2026-09-27 while planning an RPG example world (races, classes, spells). The world exposed that owned traits force duplication.
- **Amends:** the trait-gates spec's ruling that every owner's active traits pin into one set (Q41), and persona story 38 (an unpicked world persona returns to the cast) for persona-only entities.
- **Rulings, by grill number:**

  | # | Ruling |
  |---|---|
  | Q2, Q21 | A requirement means the same bearer by default. It can name You or an entity that bears the trait. |
  | Q3, Q7 | Pins resolve per bearer. A cast entity's own pins apply only in its own text. Amended by Q79. |
  | Q4 | Owned traits stay a separate kind. |
  | Q6 | The player is one bearer, the picked persona. |
  | Q8 | Linked stat effects do nothing on a cast entity for now, with a note. |
  | Q9 | The player can change a cast entity's link defaults under the owned-trait rules. |
  | Q13 | Links travel off-world by name and rebind by id, then by unique name. |
  | Q18 | A cast entity's links reach the AI like owned traits. `{{char}}` reads as the bearer. |
  | Q20 | The Test Bench warns about never-unlockable traits per bearer. |
  | Q23 | Per-link data is default-on and bearer-relative pin values. Locked dropped in Q52. |
  | Q24 | A linked group brings its live subtree and keeps its exclusivity. |
  | Q25 | Persona-only entities exist only while picked. |
  | Q26 | Deleting an original deletes its links, after a confirmation. |
  | Q27 | **Detach** replaces **Duplicate** on a link. |
  | Q28 | Superseded by Q50. |
  | Q37 | Selecting a link shows the original's Details and the This Link section. |
  | Q38 | Bearer-relative pin targets. Each link picks the value from the bearer's own list. |
  | Q39, Q41 | Custom Persona covers None and library personas and uses the player's world key. |
  | Q40 | A link with no pin value lays no pin, and the Test Bench warns. |
  | Q42–Q45 | The system nodes are Templates and Custom Persona, added from **+**, removable, and they show in Basic when non-empty. Removing Templates moves its contents to the root. Removing Custom Persona deletes its links. |
  | Q46–Q48 | The link button is on every linkable node. Existing bearers show checked and disabled. Flyouts nest by entity group. |
  | Q49 | A bearer holds each original once. A second link is refused; import drops it. |
  | Q50 | Originals are world traits and groups only. No links to owned traits. Expansion is one level and cannot cycle; entity nodes placed in a linked group are skipped. |
  | Q51 | On fallback to the world placeholder, the link's own value applies, picked from the world list. The pin's own value is only a new link's starting value. |
  | Q52 | No per-link locked state. Toggling follows the original's Player Can Toggle. |
  | Q53 | A persona switch in play applies and reverses linked stats. Detach strips stat changes and toggles after a confirmation. |
  | Q54 | No compat for scopeless cross-owner requirements. Unreleased, unused. |
  | Q55 | The Test Bench lens checks every bearer as if picked. |
  | Q56 | `{{char}}` on Custom Persona under None reads as the player name. |
  | Q57 | A link with no stored default-on reads the original's `isDefault` live. Written only when touched. |
  | Q58 | The player bearer's "already holds" counts root traits and groups outside Templates. |
  | Q59 | No entity node under Templates. A placement naming it reads as top level. |
  | Q60 | A drag from an owned row is a move, as today. Only a world row dropped into an entity makes a link. |
  | Q61 | A link row moves between bearers with its per-link data. Never at the root or in a world group. |
  | Q62 | A refused drop shows the inline refusal notice naming the reason. |
  | Q63 | The stat note reads "play as them" under a Persona; "don't apply to entities" otherwise. |
  | Q64 | A duplicate made by a world-to-world move resolves once per bearer, first in tree order. The Test Bench reports the redundant link. |
  | Q65 | Ticket 03 adds an interim Templates filter on the player-facing tree and the world gate owner; 08 replaces it. |
  | Q66 | Removing Templates keeps Custom Persona's links to the moved originals. Q64 covers the duplicate. |
  | Q67 | Selecting Custom Persona opens a heading plus one help line. |
  | Q68 | Templates and Custom Persona stay at the root; a drop into a group is refused. |
  | Q69 | Add flyouts leave Custom Persona out; only the link flyout lists it. |
  | Q70 | In Basic the **+** is a two-row menu: Add Trait, Add Trait To Entity →. |
  | Q71 | The link button also shows on a selected link row and acts on the original. Never on owned items or system nodes. |
  | Q72 | Checked-and-disabled follows the drag path's refusal rule. |
  | Q73 | Link pick: append, flyout stays open, selection stays. Add pick: append, close, expand, select the new row. |
  | Q74 | The player bearer's gate set is the union of the world root owner and the played entity's owner. |
  | Q75 | World pins are the non-trait sources; the bearer context swaps only the trait set. Amended by Q79. |
  | Q76 | A direct bearer with no link applies the pin's own value, bound by name. |
  | Q77 | The player's own placeholders follow the persona; None means the world's. |
  | Q78 | Pins list: link rows edit the link's value; conflicts between pins that can lay in one text (one bearer, or player vs cast entity). |
  | Q79 | A cast entity's text: world pins, then the player's trait pins, then its own on top. |
  | Q80 | Persona story 54 stands: a persona-only entity's Others openings never draw. Amended by Openings Refresh Q8: its Self openings draw when it is the pick. |
  | Q81 | The Persona-only switch is in the world entity editor only. |
  | Q82 | In the conflict note a Persona-marked entity's traits count as both its own and the player's, so they rival every cast entity's; the cast entity wins in its own text. Amended by emberwatch-world Q27: two Persona-marked entities' traits never rival each other, since only one is played and each wins in its own text. |
  | Q83 | Under None or a library persona, Custom Persona's links merge into the player's root categories; no separate heading. |
  | Q84 | The player is one bearer, so Q64 applies to the union: an original held at the root and through the played persona's link shows once (root wins), holds one stat record, and the Test Bench reports the redundant link. |
  | Q85 | A linked group's per-link keys travel off-world with child names and rebind by id, then unique name within the subtree, else drop. |
  | Q86 | Inside a world the library editor shows links live with This Link, Remove and Detach, and makes no new links. |
  | Q87 | "Every bearer as if picked" is the rule pass, once per persona choice. No lens picker change. |
  | Q88 | The redundant-link rule covers the four duplicate shapes; the jump lands on the link inside the other's group. |
  | Q89 | On the player bearer `{{char}}` reads exactly as `{{user}}`: the persona's name, or "the player" under None, root traits included. |
  | Q90 | Roll priming walks every bearer's traits with bearer-relative pins bound (link value, else pin value) and skips unbound ones. Nothing more. |

- **Reviewed 2026-09-27 (Q49–Q56).** Eight gaps surfaced; all ruled above. Candidates noted, not ruled: a Test Bench rule for a named-scope requirement whose bearer no longer bears the target; a rename remap or rule for per-link pin values keyed by placeholder name; confirmation copy for removing Templates should say its traits become offered to the player.
- **Superseded during the grill:** a per-node offer setting (Q1, Q1a, Q5, Q19), per-entity ordering (Q15a), the template visibility mark (Q31), root links (Q33), owned-trait originals (Q28), and per-link locked (Q23). The Templates and Custom Persona nodes replaced the first four.
- **Closed at ticket time (Q60–Q62):** the move gesture survives as a drag that starts from an owned row; a world row dropped into an entity links.
