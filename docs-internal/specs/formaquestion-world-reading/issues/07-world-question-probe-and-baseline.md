# 07: World-Question Probe and Baseline

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: case design and scoring rules; the runs are mechanical.

## What to build

A world-question probe on the bundled worlds, in the help probe family, with a scored baseline the user sets the bar from.

- **Cases:** editor cases (how a part of the world works) and game cases (lore so far). Each game case carries a save state at a fixed point in the story, with unmet and hidden content that a leak would show.
- **Scores**, editor and game apart: grounded-correct, leak (unmet or hidden text in an answer), and opinion phrasing for "what would you try" cases (Q19).
- Answer keys are fixed before the scored batch.
- **Baseline:** cloud default model, in-batch control, the run counts the probe skill sets. Results go in the ticket for the user to set the bar (Q5).

Spec: Q5, Q19, Q27.

## Acceptance criteria

- [ ] The case set covers every bundled world it can, with editor and game cases
- [ ] The scorer reports grounded-correct, leak and opinion phrasing, editor and game apart
- [ ] The scorer's tests show a planted leak scores as a leak
- [ ] A baseline run on the cloud default model is recorded in the ticket with run counts

For you: set the pass bar from the baseline numbers.
