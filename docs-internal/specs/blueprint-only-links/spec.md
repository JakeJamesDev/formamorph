# Blueprint-Only Links

Status: ready-for-human

## Problem Statement

An author drags a root trait group onto the Custom Persona entity to make it the persona's. The drop is refused with "The player already has Bonds at the top level." In Advanced mode, a world row dropped on an entity always becomes a link. The Custom Persona entity is the player, and the player already has every root item, so the link would add nothing. No drag moves the item in instead.

The rule behind this is wider than the Custom Persona. Any world item can be linked, root or Blueprint. A root item is then both offered to the player and borne by an entity. That second path adds nothing that Blueprints can't do, and it breaks attribution: a root item can't simply belong to someone. Placeholders already work the other way. A drag moves a world placeholder in as owned, and only Blueprints make copies.

Persona entities also can't own stat-changing traits. A stat trait reaches a persona only as a link, even though a link's stat changes already apply when that persona is played.

## Solution

- **Only Blueprints link.** A link's original is always a Blueprints item. **Link To…** shows only on Blueprints items.
- **A root item dropped on an entity moves in** as that entity's own item, in Advanced as in Basic.
- **A linked item stays in Blueprints.** A drag out of Blueprints is refused while any entity links it or something in it.
- **Root links are dropped on load and import.** A world or card link whose original sits outside Blueprints is removed.
- **Persona entities own stat traits.** The Custom Persona entity and Persona-marked entities may own traits with stat changes and stat toggles. They apply only while that persona is played, like a link's.

## User Stories

1. As an author, I want to drag a root trait or group onto an entity and have it become that entity's, so that I can attribute it directly.
2. As an author, I want the same drag onto the Custom Persona entity, so that a trait belongs to the persona and not to every player.
3. As an author, I want links to come only from Blueprints, so that one rule tells me what is shared and what is owned.
4. As an author, I want **Link To…** only on Blueprints items, so that I'm never offered a link that can't exist.
5. As an author, I want a drag out of Blueprints refused while entities link the item, with a notice that names them, so that no link is left pointing at a root item.
6. As an author, I want a Persona-marked entity to own a trait with stat changes, so that a playable character can carry its own bonuses.
7. As an author, I want the Custom Persona entity to own stat traits, so that a persona-only class works without Blueprints.
8. As an author, I want a stat trait on an unmarked entity kept with its stats dormant, and a note that says so, so that removing the mark loses nothing.
9. As an author, I want Detach on a persona entity to keep stat changes, so that detaching does not change play.
10. As an author, I want a character card to carry a persona's owned stat traits, so that a round trip keeps them.
11. As a player, I want a played persona's owned stat traits to move my stats, and to reverse when I switch persona.

## Implementation Decisions

- **Link creation.** `applyOwnedTraitDrop` links a world row dropped into an entity only when `createLinks` is on and the row is in the Blueprints subtree. Otherwise the drop takes the move path. `addLink` and the **Link To…** button refuse a non-Blueprints original.
- **Refusals.** The `offered` refusal and its copy go. A new `blueprint-linked` refusal names the linking entities. It reuses the drop refusal notice.
- **Load and import.** `migrateWorld` removes every entity link whose original is not in Blueprints. It is idempotent and runs at every import boundary and in `loadWorldData`. Card and library link binding treats a root match as no match.
- **Stats.** `canOwnStatTraits(entity)` = `customPersona || persona`. The drop's stats refusal, Detach's strip, the card parser and the Stats tab read it. A Stats tab on an unmarked entity shows only when the trait already has stat effects, with the dormant note. Runtime already applies a player bearer's stat traits by bearer, so play needs no new path.
- **Test Bench.** The `trait-link-redundant` rule loses its `offered` reason, since root links can't exist.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | Only Blueprints items can be linked, by drag and by **Link To…**. |
| Q2 | In Advanced, a root item dragged onto an entity moves in as owned, as in Basic. |
| Q3 | The Custom Persona entity and Persona-marked entities may own stat-changing traits. The stats apply only while played, and reverse on a switch. Other entities refuse. |
| Q4 | This is its own effort, amending trait-links and Blueprints. |
| Q5 | The loader drops links whose original is outside Blueprints, overrides included. Reopened once after `v3.1.0` was found to ship root links; ruled the same. |
| Q6 | After an unmark, owned stat traits stay with their stats dormant and show "Stat changes don't apply to entities". |
| Q7 | A drag out of Blueprints is refused while any entity links the item or something in it. The notice names the entities. |
| Q8 | Detach keeps stat changes and toggles on persona entities. Other entities strip them after the confirmation. |
| Q9 | Cards read owned traits' stat changes and toggles, as they read link overrides. Unknown stat ids go dormant. |
| Q10 | An owned trait shows the Stats tab on a persona entity, or on any entity when it already has stat effects. |
| Q11 | Removing the Blueprints group works item by item. Each linked item, with everything below it, is detached into every entity that links it, then deleted. Unlinked items move to the top level. |
| Q12 | When a Q11 detach into a cast entity strips stat changes, the removal confirmation names those entities. |

**Amends:** trait-links Q58 (the `offered` refusal), Q63 (the note now also covers owned traits), Q71 and Q72 (**Link To…** placement and the Custom Persona check), Q53 (Detach strip); the trait-links rule that a world row dropped on an entity links it.

## Out of Scope

- Placeholders. They already copy only from Blueprints and move on drag.
- Basic mode. It never links and keeps its move behavior.
- Converting root links to anything. Q5 drops them.

## Shape Changes

- World: links to non-Blueprints originals are removed on load.
- Entity card: owned traits' `statChanges` and `statToggles` are read on import. Additive.
