# 04: Openings On Entities

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Openings](../spec.md)

**What to build:** An entity carries its own weighted openings. Both entity editors gain an **Openings** tab with the same rows the world panel uses. At Start Game, the openings of authored entities present at the player's chosen starting location join the world's pool at equal standing. An entity somewhere else adds nothing. Openings travel with the entity in the exported entity card and in a published listing, and come back under fresh ids on import.

**Rationale for the model:** an entity shape change, a file format change, and the pool union with the location gate. Opus at high effort for the data and round-trip work.

## Acceptance criteria

- [ ] An entity carries an ordered list of openings and a weight map, in the same shape the world uses. Entities have no switch of their own.
- [ ] Both entity editors show an Openings tab after Descriptions. The row component is the one the world panel uses, not a copy.
- [ ] The pool is read at draw time and never copied into the world. It is the world's rows plus the rows of authored entities present at the chosen starting location.
- [ ] Entity presence is read through the existing entity presence helper, per ADR-0003.
- [ ] The world switch removes authored entities' rows from the draw as well as the world's own.
- [ ] Deleting an entity removes its openings from the pool. Duplicating an entity copies them under fresh ids.
- [ ] The entity card file and the listing payload carry openings and weights. Import restores them under fresh ids, with the weight map re-keyed. Chips in an opening still resolve after import, through the placeholders that travel with the card.
- [ ] A card or a world written before this ticket loads with no openings and no error.
- [ ] The find bar reaches an entity's openings and opens the Openings tab.
- [ ] The dev-router reaches the Openings tab in both editors.
- [ ] Module tests cover the location gate, a world with several starting locations, and the switch. Round-trip tests cover the card. One guard is proven by reinstating its fault.
- [ ] Both tabs are checked in the preview, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

**Export shape:** this ticket changes the entity record, the world export that holds entities, and the entity card file. Say so in the hand-over. If the listing payload is validated by the server, name the server change as a follow-up and do not edit the server here.
