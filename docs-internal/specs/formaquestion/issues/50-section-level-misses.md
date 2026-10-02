# 50: Right page, wrong section

Status: ready-for-agent
Blocked by: 46
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the search reaches the right page, the keyed section on that page reaches the block too (Q79). In ticket 46, five questions reached the right page but never the keyed section in 10 runs: `memory-1`, `prompts-1`, `persona-authoring-2`, `statcodeguide-2`, `world-editor-openings-4`.

- For each, find why a sibling section ranked or was picked above the keyed one.
- Fix the cause with a rule you can state, in the search sources or the docs block. Do not add keyword lines or pick hints aimed at these five questions.
- Check the rule on ticket 39's blind set. It must not rely on the known set alone.

**Probe.** Ticket 39's recall probe on both sets, shipped defaults, 5 runs. Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control.

Recommended model rationale: a general rule from five cases, without fitting them.

## Acceptance criteria

- [ ] Each of the five has a named cause in the handover
- [ ] The rule is stated in the code and a test, with no question named
- [ ] Blind-set recall@5 does not drop; same batch
- [ ] Probe numbers on all kinds, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
