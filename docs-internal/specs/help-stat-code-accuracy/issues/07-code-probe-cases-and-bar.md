# 07: Code Probe Cases And Bar

Status: ready-for-agent
Blocked by: 01 — Quick Reference Section; 02 — Pin The Quick Reference On Code Turns; 05 — Code Rider Names And Typo
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: harness cases plus a multi-arm probe campaign on a drifting cloud model; judgment on numbers.

## What to build

The help-code harness gains five known cases from the source transcript: a daypart-gated trait, a day-count-gated trait, a persona trait switch, a threshold check on a named stat from another stat's Code tab, and a multi-condition placeholder pin. Each asserts the real member names and the absence of `clock.time`, `clock.days` and a whole stat compared to a number. The bar run on the cloud default, with the Quick Reference pinned, passes the five cases on 80% of runs at 5 or more runs each, and the existing code cases do not drop. A second arm, rider names on versus off, decides whether ticket 05's `entities`/`persona` names stay; on no gain, this ticket removes them.

## Acceptance criteria

- [ ] Five new cases in the harness, each asserting presence of real names and absence of the invented ones
- [ ] Bar run: 80% pass across the five cases, 5+ runs each, existing code cases not lower, with an in-batch control
- [ ] Rider arm run; numbers recorded in the spec; names kept or removed per the result
- [ ] Changelog fragment written if the rider changes
