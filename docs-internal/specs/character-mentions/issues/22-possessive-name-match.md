# 22: Possessive Name Match

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q75 (1): `findEntityMatches` in `src/lib/entityMatch.ts` reads "the Captain's Hall" as the entity name "Captain Hall", because it accepts a possessive inside a multi-word name. Every consumer of the matcher sees the false hit: Character Mentions links, presence, and participants.

- **The rule:** a possessive may close only the last word of a name. "Captain Hall's sword" still matches Captain Hall; "the Captain's Hall" does not.
- **Scope:** the full-name path and aliases. Single-word names keep their current possessive handling.
- **Changelog:** a Fixed entry for the false link and presence, by surface.

## Acceptance criteria

- [ ] "The weathered paper in the Captain's Hall announced…" gives no match for an entity named Captain Hall. "Captain Hall's sword" and "Captain Hall nods" still match. The test is proved by reinstating the bug.
- [ ] The same holds for an alias with two or more words.
- [ ] The existing `entityMatch`, presence, `characterCandidates` and `mentionReading` tests stay green, and the mention-reading gold scores are rerun and reported against the last run (ticket 14's numbers).
