# 01: Character Pins Reach All Text

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: `docs-internal/specs/character-pin-scope/spec.md`

Model rationale: it changes shipped trait behavior and the pin order every text reads, across play, the editor and the Test Bench.

## What to build

A character's stat bands and traits pin placeholders in every text, for any persona, by the spec's rulings Q6–Q21. A Blueprint stat's band pins each owner's own copy. Ties inside one kind follow the Q18 order. The Test Bench warns about a tie between characters. Docs, CONTEXT.md and the changelog say so.

## Acceptance criteria

- [x] A band on a character's own stat pins a world placeholder in world text, in another entity's text and in the player's text, while either persona is played. (ownedTraitsInPlay.test "pins world text and every other text from a cast entity's band, whoever is played": None, world and library persona)
- [x] A band on a character's own stat can pin that character's own placeholder. ("pins the character's own placeholder"; editor filter: placeholderPins.test Q11 case)
- [x] A character's trait pin reaches the same texts as her stat band does. ("lays a cast entity's pins in world-level text, under the global traits (Q18)"; lens and aiContext tests)
- [x] Two mares with one Pregnancy Blueprint, in different bands, each read their own copy's pinned value. ("reads each mare's own copy's pinned value, from her own band")
- [x] A Blueprint stat descriptor's pin menu offers no world placeholder, and the pin collection ignores one set by hand. (PlaceholderPinRows.test "offers a Blueprint stat's band only blueprints"; "ignores a world placeholder a Blueprint stat's band pins by hand")
- [x] Ties inside one kind: global wins, then the played persona, then the character later in the entity list. The order between kinds is unchanged. ("orders ties inside the band kind", "lays every global trait after the persona's", "keeps the order between kinds")
- [x] A character's pin holds while she is out of the scene. ("holds while the character is out of the scene": the collection reads presence, not the scene)
- [x] The Test Bench warns when two characters can pin one placeholder to different values, and names the winner. (rules.test "warns when two characters can pin one placeholder to different values")
- [x] The placeholder's **Pins** tab lists character stat bands with their owner, in play order. (placeholderPins.test "lists the cast's bands in entity order…", link override rows too)
- [x] Docs, the CONTEXT.md **Pin** entry and one changelog entry (fragment) state the new reach, the trait change included. (four World Editor pages, CONTEXT.md, `changelog.d/character-pin-scope-01.md`)
- [x] A test fails when the collection goes back to global stats only, and another when trait pins go back to per-owner scope. (mutation-tested: dropping the entity bands fails 10 tests; dropping cast traits from the set fails 13)

## Landed

**Not verified**

- No browser check of the Pins tab or the descriptor pin menu; DOM tests and unit tests only.
- Enter World's draft pins read entity stats at their seeded start, before trait start effects; the game's opening reads the settled ones. Not compared.
- Q11 is enforced in the editor's pin menu only; play still applies a hand-set pin on another entity's placeholder.
- The Bench's dead-value fix walks entity stats but not stat-link band overrides.
- An entity with no copy of a Blueprint pins the Blueprint itself, which now reaches every text that reads the Blueprint directly.

**For you**

- A shipped world with owned-trait pins now changes world text and other entities' text (Q20). Check the bundled worlds' trait pins read right in play.
- In the editor, a Persona that is not persona-only ranks as cast in the Pins tab; the tie warning names it with "unless the player plays …".
