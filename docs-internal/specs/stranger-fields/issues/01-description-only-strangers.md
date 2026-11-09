# 01: Description-Only Strangers

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket changes the Met start rule. The Presence module, the Stranger view and the Formaquestion Player World all read that rule, so a mistake shows in several places. Opus is worth its cost here.

## What to build

An entity with a Stranger Description and no Stranger Name starts unmet (Q11). The player and the AI still see its real Name (Q12). The player sees the Stranger Description in place of the Player-Facing Description until they meet the entity.

- The Presence module gets one predicate, "has a stranger face". It is true when a Stranger Name is set (one that resolves blank still counts, as today) or the Stranger Description is not blank. It mirrors the item rule for an unidentified face.
- The start rule's first case uses that predicate. Relationships, Known In and runtime characters still meet the entity at the start.
- An unmet entity with only a Stranger Description takes its real Name as its label. The story never stores an alias for it. Entities with a Stranger Name keep today's label rule: latest alias, else Stranger Name, else nothing.
- The prompts' stranger reveal stays limited to entities with a Stranger Name. The AI sees nothing new.
- The meeting rule does not change (Q13).
- Opening such an entity in play opens the Stranger view under its real Name, showing the Stranger Description (Q14). After meeting, the normal entity panel shows.
- The Formaquestion Player World lists it under its real Name with the Stranger Description, never the Player-Facing Description.
- `CONTEXT.md`: update **Stranger** and **Met** as the spec says.
- The dev-router `stranger` modal picks the first entity with a stranger face.
- Add a changelog fragment for description-only strangers.

Help topics and the editor layout belong to ticket 03. Leave the existing Stranger help topic alone.

## Acceptance criteria

- [x] A description-only entity starts unmet; with a relationship to the persona, or a Known In pick that covers the persona's location, it starts met. (`presence.test.ts` "starts unmet, unless a relationship or a Known In pick meets it")
- [x] A description-only unmet entity shows its real Name in the scene list and Look Around. (`presence.test.ts` "shows its real Name…"; `GamePanels.test.tsx` "shows by its real Name and opens the stranger popup under it")
- [x] A cast alias for a description-only unmet entity is not stored. (`presence.test.ts` "never takes a story alias"; fails with the guard removed)
- [x] Narration that names a description-only entity while it is present meets it. (`presence.test.ts` "is met when the narration names it while it is here")
- [x] An entity with a Stranger Name behaves as before (existing presence tests pass unchanged). (no existing test edited; all 44 presence tests green)
- [x] The Stranger view for a description-only unmet entity shows its real Name and the Stranger Description. (`StrangerModal.test.tsx`, plus the GamePanels click test for the real-Name label)
- [x] The Formaquestion Player World shows a description-only unmet entity under its real Name with the Stranger Description. (`playerView.test.ts`, `playerViewWorld.test.ts`)
- [x] Reinstating the old start rule makes the description-only start test fail. (mutation run: 5 tests red across presence, playerView, playerViewWorld, GamePanels)

## Landed

Rulings Q15 and Q16 from the spec session: a description-only stranger is known by name everywhere. `EntityPresence.known` and `Presence.known` carry it; the map roster and the Player World read `known`.

**Not verified**
- None of the criteria. The map roster's switch to `known` in `GameViewer` has no test of its own; it is one line feeding the tested `metRosterByLocation`.

**For you**
- Play a world with a description-only character at the start location and check how soon the narration meets them.
- Open the Map while that character is unmet: it should list them under their real Name.
