# 06: Ask Probes With Fuzzy and Semantic On

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Prove that Ask holds its quality with fuzzy keywords and Semantic Search on (Q4, Q16).

- Run the help retrieval and baseline probes on the cloud model with fuzzy keywords and Semantic Search on. Use in-batch controls with the ranking from before ticket 01, and enough runs per arm for the cloud model's drift.
- The bar is no regression: 77.5% answer quality and 93% Take Me There, or better. Report the gain.
- When a probe misses the bar, tune the fuzzy weights or the semantic floor, and re-run. Never tune on the blind set.
- Smoke-test first; scale only a run the smoke proved.
- The control arm builds its index with `fuzzy: false`. After ticket 01, the help-baseline control indexes (untiered, unfiltered, hubOld) run with fuzzy on, so a control must set the flag explicitly.
- Known weak spots from ticket 01, to check first on a miss:
  - Prefix first (Q30): a typo that is also the start of another word gets no correction.
  - With two typo words in one question, a hub section's repeated exact words can outrank the specific section. The half weight on expanded words decides it.
  - A typo written in the docs or changelog matches exactly and never expands. Docs text must not quote typo examples literally.

Spec: Testing Decisions → Probes.

Recommended model rationale: probe design, reading noisy cloud results, and tuning judgment.

## Acceptance criteria

- [ ] Probe numbers for both arms, with run counts, quoted in the ticket.
- [ ] Both bars met or beaten, or the miss escalated to the user with the numbers.
- [ ] Any tuning lands with its tests; four gates green.
