# 05: Route-accuracy probe

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An offline report of how often the keyed section's route matches the surface a question is about, so the user can set a bar.

- The keyed task and here questions gain an expected-surface field, authored once.
- A new probe in the baseline harness scores, with no model run: for each question, the keyed section's route against the expected surface. Output is a table per kind with hit, miss and no-route counts, and the misses by name.
- The first run's table goes in the ticket's Answer. The bar is the user's to set after (Q20).

Spec: Q20; Implementation → Probe.

Recommended model rationale: a pure scorer and a data field, with the harness's rescore path as prior art.

## Acceptance criteria

- [ ] Every keyed task and here question has an expected surface.
- [ ] The scorer is tested on a fixture: hit, miss, no-route and the table shape.
- [ ] The first report is in the Answer; no bar is asserted.
- [ ] The four gates are green.
