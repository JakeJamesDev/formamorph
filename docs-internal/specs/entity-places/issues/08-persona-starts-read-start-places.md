# 08: Persona Starts Read Start Places

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

When a player enters a world as one of its entities, the places they can begin come from that entity's Start places. Today the readers use the stored list, which for an entity with a kind holds every Schedule row place and leaves out Player's Starting Location.

Readers that move: the persona's start location, the offered start locations in the Enter World flow, the same offer in the Test Bench lens and opening, and the "starts met" check for the played persona.

NPC Schedules tickets 33 and 34 already made both readers read the Starts (its Q229, Q230), through a helper of their own. This ticket moves them to the module's Start places and removes that helper. One behavior changes (Q16):

- **The New Game start list.** Today a Start at Player's Starting Location adds no place to the list. It offers the world's starting locations, or every location when none is flagged, as the met-by-start rule already counts it. The list keeps world order, and Start order still sets the preselected place.

Row places stay out of both readers, as landed.

The Custom Persona has no kind. Its stored locations keep working as today, read through the module.

Add the readers to the agreement test. The Enter World wiki text changes if it says where a played entity can begin.

Spec rulings: Q2, Q9 (#7, #8).

## Acceptance criteria

- [x] A played Unique entity with one Start at a town and a row that sends it to a forest is offered the town only, as today. The existing test passes unchanged. (`personaPick.test.ts` "leaves a row place out of the list", unchanged.)
- [x] A played entity whose Start is Player's Starting Location is offered each flagged starting location, and every location when none is flagged. The test fails with the "adds none" read. ("offers every location for a Start at Player's Starting Location when none is flagged" and the agreement block's "no place flagged" cases; all three failed with the read reinstated.)
- [x] The list keeps world order and the preselected place follows Start order. (Existing Start-order tests; "preselects a named Start place over one at Player's Starting Location" for Q28.)
- [x] The helper that tickets 33 and 34 of NPC Schedules added for Start places is gone, with no caller left. (`startPlaces` removed from `personaPick.ts`; typecheck green.)
- [x] A played Generic entity is offered the place of each of its Starts. ("offers the place of each Start of a Generic entity"; agreement block, gulls.)
- [x] The "starts met" check for a played persona is true at a Start place and false at a place only a row names, as today. The existing tests pass unchanged. (`presence.test.ts` unchanged and green; agreement block per persona.)
- [x] The Custom Persona is offered the same places as before. A test covers it. (Existing "keeps the Custom Persona on the starting locations" asserts the offered list.)
- [x] The Enter World flow and the Test Bench lens offer the same places for the same world and persona. A test compares them. (Agreement block "the Test Bench offers and preselects for $id what Enter World does", both worlds.)
- [x] The agreement test holds the readers moved here. ("the persona start readers agree with Start places".)
- [ ] A changelog fragment records the New Game list change.

Spec rulings added after this ticket was written: Q16.

## Landed

**Not verified**
- A changelog fragment records the New Game list change: replaced by Q25. A Start at Player's Starting Location exists only with entity kinds, which are unreleased, so no fragment. Fix for the kinds entry: the New Game start list now offers the starting locations (every location when none is flagged) for a persona whose Start is at Player's Starting Location; it used to add none.

**For you**
- Ruling Q28 (spec session): a Start at Player's Starting Location adds no preselect. Fold it into the spec.
- `docs/Persona-Authoring.md` step 4 gains one sentence on a start at Player's Starting Location.
- In Enter World, play a world entity whose only Start is Player's Starting Location in a world with no flagged location: the Starting Location list shows every location, and Random stays picked.
