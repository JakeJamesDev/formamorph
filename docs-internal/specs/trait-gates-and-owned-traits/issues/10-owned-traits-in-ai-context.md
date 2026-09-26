# 10: Owned traits in AI context

Status: ready-for-agent
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt-text change that needs A/B probes on both model tiers per the prompt-writing guide.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

The story treats each NPC as the player shaped it, and treats the player as the entity they play.

## Acceptance criteria

- [ ] An NPC's active owned traits join its full entity context, each AI description under the trait's name.
- [ ] The NPC's summary gets one "Traits: …" line of names.
- [ ] The played entity's active owned traits join the player's trait context beside the world traits.
- [ ] The change follows the prompt-writing guide: A/B probes on both tiers, at least two runs per case, before/after metrics, and an other-metric regression check, reported in the response.
- [ ] Context builder tests cover the three lines.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
