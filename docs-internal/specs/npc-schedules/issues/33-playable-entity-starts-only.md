# 33: A Playable Entity Offers Its Starts Only

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In New Game, a player who plays as a Playable or Persona-Only entity picks where to start. The list should hold the places that entity's Starts begin at. Today it holds every place the entity's routine uses: the persona pick reads the entity's derived location list, which also has every place a row names. So an entity that begins at the Inn and patrols the Square offers the Square as a start. Found by ticket 32.

The Routine tab hint already says "Lets the player start at any start location as this entity", and the wiki now says the same (ticket 32). The user confirmed on 2026-11-11 that Starts only is the intent (Q229).

- The start list for a played entity holds the place of each of its Starts, in Start order, each once.
- A Start at Player's Starting Location adds no place of its own; the world's starting locations are already in the list.
- The preselected place keeps today's rule, applied to that list: the first one that is a starting location, else the first.
- The Custom Persona and an entity with no kind keep today's behavior.

Check every other reader of the played entity's locations in the New Game and persona path for the same fault, and name each in the landing.

No world or save shape changes.

Spec rulings: Q229, Q147.

## Acceptance criteria

- [ ] A Playable entity with a Start at one location and a row that names a second offers only the first. The test fails with the old read.
- [ ] An entity with two Starts offers both, in Start order.
- [ ] An entity whose only Start is Player's Starting Location adds nothing beside the world's starting locations.
- [ ] The preselected place follows the rule above on a list where the first Start is not a starting location and the second is.
- [ ] The Custom Persona's list is unchanged.
- [ ] The landing lists the other readers checked and what each reads.
