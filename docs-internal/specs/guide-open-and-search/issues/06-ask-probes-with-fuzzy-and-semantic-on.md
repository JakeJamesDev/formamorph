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

Spec: Testing Decisions → Probes.

Recommended model rationale: probe design, reading noisy cloud results, and tuning judgment.

## Acceptance criteria

- [ ] Probe numbers for both arms, with run counts, quoted in the ticket.
- [ ] Both bars met or beaten, or the miss escalated to the user with the numbers.
- [ ] Any tuning lands with its tests; four gates green.
