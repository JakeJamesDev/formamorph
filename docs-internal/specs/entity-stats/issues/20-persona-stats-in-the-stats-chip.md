# 20: Persona Stats in the Stats Chip

Status: done
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a prompt change in the narration, choices and planner chips, judged by probe numbers.

Parent: [Entity Stats spec](../spec.md)

## What to build

The narrator, the choice writer and the planner know the played persona's stats. After ticket 13, those stats are player stats in the panel and the stat request. But the Stats chip in the other prompts still lists only the world player stats, and the Entities chip skips the persona because it is not in the cast. The Stats chip gains the joined owners' stats after the world stats, laid out by each owner's groups, as the stat request does. Rulings Q11, Q14, Q28, Q70, Q72.

## Acceptance criteria

- [ ] The Stats chip outside the stat request lists the played persona's stats (and the Custom Persona entity's under a library persona) after the world player stats, in each format.
- [ ] A world with no persona stats renders byte for byte as before.
- [ ] Hidden stats render (hidden means hidden from the player); switched-off stats don't.
- [ ] Narration, choices and planning probes show no regression on the cloud default model and Cydonia, with the persona stats off as the in-batch control. Numbers go in the commit body.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
