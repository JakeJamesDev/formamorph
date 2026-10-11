# 23: Stat Request Framing

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: prompt work judged by probe numbers on two models that fail in opposite directions; the user decides from the report.

Parent: [Entity Stats spec](../spec.md)

## What to build

The stat tracker gets a general framing of stats before it reads the list. The default Stat Updates prompt gains three short parts, in the built-in prompt text only:

1. **What a stat is:** a tracked quantity about one character, which moves only when the story moves it.
2. **How the list is laid out:** each owner's heading, the groups under it and what a group heading means, and that a stat belongs to the heading it sits under.
3. **What stats do to the story:** what stats in general can do to the narrative, not what any one stat does.

Custom prompts are not touched. Rulings Q76, and Q24 for custom prompts.

## Acceptance criteria

- [ ] The default system prompt for the stat request carries the three parts. The probe report states their wording.
- [ ] The text follows the prompt-writing guide: positive contracts, no example values a small model can parrot, and no stat names from any world.
- [ ] Each wording tried is an A/B in the entity stats probe on the cloud default model and Cydonia. Today's shipped request is the in-batch control, with at least 6 runs per case on the cloud model. Grouped and flat requests are both covered.
- [ ] The report gives exact, recall, wrong signs, invented changes (player and entity) and invented max changes for every arm, on both models, plus the `push-bram` case (Q64).
- [ ] The ticket does not land a wording on its own: it reports, and the user rules which wording ships, if any (Q76).

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
