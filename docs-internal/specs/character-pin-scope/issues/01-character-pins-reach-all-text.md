# 01: Character Pins Reach All Text

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: `docs-internal/specs/character-pin-scope/spec.md`

Model rationale: it changes shipped trait behavior and the pin order every text reads, across play, the editor and the Test Bench.

## What to build

A character's stat bands and traits pin placeholders in every text, for any persona, by the spec's rulings Q6–Q21. A Blueprint stat's band pins each owner's own copy. Ties inside one kind follow the Q18 order. The Test Bench warns about a tie between characters. Docs, CONTEXT.md and the changelog say so.

## Acceptance criteria

- [ ] A band on a character's own stat pins a world placeholder in world text, in another entity's text and in the player's text, while either persona is played.
- [ ] A band on a character's own stat can pin that character's own placeholder.
- [ ] A character's trait pin reaches the same texts as her stat band does.
- [ ] Two mares with one Pregnancy Blueprint, in different bands, each read their own copy's pinned value.
- [ ] A Blueprint stat descriptor's pin menu offers no world placeholder, and the pin collection ignores one set by hand.
- [ ] Ties inside one kind: global wins, then the played persona, then the character later in the entity list. The order between kinds is unchanged.
- [ ] A character's pin holds while she is out of the scene.
- [ ] The Test Bench warns when two characters can pin one placeholder to different values, and names the winner.
- [ ] The placeholder's **Pins** tab lists character stat bands with their owner, in play order.
- [ ] Docs, the CONTEXT.md **Pin** entry and one changelog entry (fragment) state the new reach, the trait change included.
- [ ] A test fails when the collection goes back to global stats only, and another when trait pins go back to per-owner scope.
