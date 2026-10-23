# 10: Parity Probes

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: runs the existing baseline harness with two arms; it needs an agreed GPU window, not deep reasoning.

## What to build

Measure narration changes from the switch (spec: Testing Decisions; Q12, Q21). This doesn't block the merge.

- Run the baseline harness on Cydonia, the node-llama-cpp engine (from main) against `llama-server` (this branch), with an in-batch control, at least 5 runs per arm.
- Report the rubric scores, paragraph-break counts and repetition per arm. Repetition Penalty now counts prompt tokens and line breaks, so watch those two.
- Local runs need a GPU window the user agrees to. Ask before starting.

## Acceptance criteria

- [ ] Probe numbers per arm, with the in-batch control, in the landing.
- [ ] Any regression is named with its metric, and a follow-up is proposed rather than fixed here.

For you: read a few paired outputs from each arm and judge whether the narration changed in a way you care about.
