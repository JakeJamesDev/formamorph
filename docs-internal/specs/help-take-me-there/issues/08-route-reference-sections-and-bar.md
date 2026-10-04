# 08: Route reference sections and meet the bar

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A "what is this panel" answer and the four parent-routed how-tos get a button on the exact surface, and the route probe meets its bar.

- Every section the surface map ties to a screen, dialog or tab gets a route line equal to that surface id (Q40). A source test keeps the two in step: a surface-map target without a route line, or with a different one, fails.
- Four how-tos route one level deeper (Q41): the Worlds-tab tile menus, a preset's Options, and an entity's Openings, as ticket 05's miss table names them.
- Route changes from the grill (Q44–Q47): "How to Turn On Tools" → the Output tab; "How to Add a Self Opening" → the entity's Openings tab; "How to Enter a Contest" and "How to Publish a Prompt Preset" stay as chosen.
- The two how-tos ticket 03 left without a line (formaquestion-2, world-editor-entities-1 in the miss table) get one.
- The route probe reruns. Bar (Q39): surfaced task questions at 90% or better. The here kind is reported, not gated. The Answer carries the full table.
- Route lines add no text, so the recall probe runs once after, and the Answer reports it.

Spec: Q39–Q47; Implementation → Route tags in the docs; Probe.

Recommended model rationale: docs lines guided by two source tests and an offline probe.

## Acceptance criteria

- [ ] Every surface-map target section carries its surface's route; the source test fails on a missing or different one, proven by removing a line.
- [ ] The four granularity misses and the two unrouted how-tos route as the spec says.
- [ ] Route probe: surfaced task hit rate ≥ 90%; the table is in the Answer.
- [ ] Recall probe reported; a moved pick is named.
- [ ] The four gates are green.
