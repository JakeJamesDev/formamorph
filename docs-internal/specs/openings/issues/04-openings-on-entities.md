# 04: Openings On Entities

Status: ready-for-human
Base: 452ac588
Blocked by: 01, 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Openings](../spec.md)

**What to build:** An entity carries its own weighted openings. Both entity editors gain an **Openings** tab with the same rows the world panel uses. At Start Game, the openings of authored entities present at the player's chosen starting location join the world's pool at equal standing. An entity somewhere else adds nothing. Openings travel with the entity in the exported entity card and in a published listing, and come back under fresh ids on import.

**Rationale for the model:** an entity shape change, a file format change, and the pool union with the location gate. Opus at high effort for the data and round-trip work.

## Acceptance criteria

- [x] An entity carries an ordered list of openings and a weight map, in the same shape the world uses. Entities have no switch of their own.
- [x] Both entity editors show an Openings tab after Descriptions. The row component is the one the world panel uses, not a copy.
- [x] In the World Editor the Openings tab is Advanced-only, like Placeholders and like the world opening panel. The library editor always shows it. An entity with openings counts as Advanced data for the notice beside the mode switch.
- [x] The pool is read at draw time and never copied into the world. It is the world's rows plus the rows of authored entities present at the chosen starting location.
- [x] Entity presence is read through the existing entity presence helper, per ADR-0003.
- [x] The world switch removes authored entities' rows from the draw as well as the world's own.
- [x] Deleting an entity removes its openings from the pool. Duplicating an entity copies them under fresh ids.
- [x] A library or listing entity added to a world keeps its opening ids, so a linked copy does not read as a local edit against its source. Fresh ids apply on card import and on duplicate only.
- [x] The pool and the no-repeat list identify a row by its owner plus its opening id. Two entities that share opening ids, such as one library entity added twice, draw and count as separate rows. A test proves it.
- [x] The entity card file and the listing payload carry openings and weights. Import restores them under fresh ids, with the weight map re-keyed. Chips in an opening still resolve after import, through the placeholders that travel with the card.
- [x] A card or a world written before this ticket loads with no openings and no error.
- [x] The find bar reaches an entity's openings and opens the Openings tab.
- [x] The dev-router reaches the Openings tab in both editors.
- [x] Module tests cover the location gate, a world with several starting locations, and the switch. Round-trip tests cover the card. One guard is proven by reinstating its fault.
- [x] Both tabs are checked in the preview, with static DOM evidence.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

**Export shape:** this ticket changes the entity record, the world export that holds entities, and the entity card file. Say so in the hand-over. If the listing payload is validated by the server, name the server change as a follow-up and do not edit the server here.
