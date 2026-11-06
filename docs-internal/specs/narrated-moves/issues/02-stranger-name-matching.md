# 02: Stranger Name Matching

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a contained change to one matcher, with pure tests.

## What to build

The story's name for a stranger names her. When the narration prose holds an entity's full Stranger Name, that entity takes part in the turn, as a name or alias match does today (Q1).

- The Stranger Name matches only in full, under the strict rule for multi-word names. A single word of it never matches alone.
- Aliases keep their own case-sensitive rule.
- It applies everywhere participants are read, so In Scene, the Entities tab and the scene pull all see the same match. The pull's full-name-only parse counts a full Stranger Name as a full hit.
- A Stranger Name inside quoted dialogue does not count, as for names.

## Acceptance criteria

- [x] A test shows a full Stranger Name in prose names its entity, and that the test fails when the Stranger Name is left out of matching. (`findEntityMatches — Stranger Name`; with the match disabled, 5 tests went red; restored and grepped)
- [x] A test shows one word of a two-word Stranger Name does not name the entity, when that word is also a race or common word in the scene. (`never matches one word of a multi-word Stranger Name`)
- [x] A test shows a Stranger Name inside quoted speech names no one. (`names no one from a Stranger Name inside quoted speech`)
- [x] A test shows the pull's full-name parse counts a full Stranger Name. (`selectVisitorAdditions > counts a full Stranger Name as a full-name hit`)
- [x] The Strangers section of the entity docs says the story's use of the Stranger Name brings the entity into the scene. ([World-Editor-Entities.md](docs/World-Editor-Entities.md))
- [x] A changelog fragment states the outcome for players. (`docs-internal/changelog.d/narrated-moves-02.md`)

## Landed

**Not verified**
- The `useResolvedWorld` wiring of `resolveStrangerNames` has no test of its own; only the function is tested. Reason: the hook needs the full context stack.
- A Stranger Name holding an Entity Name chip may resolve differently in the Test Bench lens, which has no entity owner.

**For you**
- Rulings from the spec session: a leading a/an/the is ignored; a one-word remainder needs an initial capital; matching continues after the player meets the entity. Check in play that a hooded stranger joins In Scene on the full Stranger Name.
