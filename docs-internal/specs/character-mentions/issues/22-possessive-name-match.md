# 22: Possessive Name Match

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Spec Q75 (1): `findEntityMatches` in `src/lib/entityMatch.ts` reads "the Captain's Hall" as the entity name "Captain Hall", because it accepts a possessive inside a multi-word name. Every consumer of the matcher sees the false hit: Character Mentions links, presence, and participants.

- **The rule:** a possessive may close only the last word of a name. "Captain Hall's sword" still matches Captain Hall; "the Captain's Hall" does not.
- **Scope:** the full-name path and aliases. Single-word names keep their current possessive handling.
- **Changelog:** a Fixed entry for the false link and presence, by surface.

## Acceptance criteria

- [x] "The weathered paper in the Captain's Hall announced…" gives no match for an entity named Captain Hall. "Captain Hall's sword" and "Captain Hall nods" still match. The test is proved by reinstating the bug. — `does not read a possessive inside the name as the name` and `still matches a name whose last word takes the possessive`; each guard (full-name and partial) reinstated, the first test went red.
- [x] The same holds for an alias with two or more words. — `holds for a multi-word alias`.
- [x] The existing `entityMatch`, presence, `characterCandidates` and `mentionReading` tests stay green, and the mention-reading gold scores are rerun and reported against the last run (ticket 14's numbers). — coref + entityMatch folders green (292 tests); gold scores below.

## Landed

**Not verified**
- Nothing unticked. Not run in the browser: the change is in the matcher, covered by unit tests only.

**Gold scores** (identical to ticket 14's): blind name 75/81, descriptor 24/43, pronoun 110/136 (7 wrong), traps 34/44, presence 27/29; hard 15/16, 8/15, 40/50, 8/8, 9/11; real pronoun 119/153, traps 41/41, presence 18/25; quotes 65/73, 0 wrong.

**Found while building** (not fixed): "Captain Blackwell waits in the hall" gives Captain Hall a partial hit on "Captain" when no Blackwell entity exists, because "captain" and "hall" are both common words, so both stay usable partial words.

**Rule as built:** a possessive may close only the last word of a name. The partial pass skips a word that a possessive joins to another word of the same name ("Captain's Hall" in either direction). "Emily's Mom" still reads as Emily. A name that carries its own apostrophe ("Mary's Tavern") is exempt.

**For you:** open a turn in Emberwatch that says "the Captain's Hall" and check it no longer links or lists Captain Hall.
