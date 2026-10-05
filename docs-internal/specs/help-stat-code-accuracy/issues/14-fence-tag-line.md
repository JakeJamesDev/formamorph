# 14: Fence Tag Line

Status: ready-for-agent
Blocked by: 13 — Help Focus
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a rider wording change aimed at one measured failure, with a two-arm probe that also settles ticket 13's open gap.

## What to build

On the cloud default, the most common code-answer failure is the fence tag line: the model opens the block with ```javascript and puts `before` or `after` on the next line, so the fence has no slot and the answer fails. Ticket 13's probe counted 20 such misses in 100 answers, and on MeroMero ticket 07 saw 5 of 8 on one case. The Code rider's fence instruction is reworded so the slot sits on the fence line in the model's output. The rider's other lines and the test-first line are unchanged.

Probe, cloud default, smoke first: four arms in one batch, old rider × new rider × focus on and off, the five known cases × 5 runs each. The new rider must cut the tag-line misses with no drop in the other measures. The same batch settles ticket 13's question: with the tag line fixed, does naming the open stat cost anything? Record both results in the spec.

## Acceptance criteria

- [ ] The rider's fence instruction is reworded; a rider test holds the new text and the no-member-names rule
- [ ] Smoke run read before the batch
- [ ] Four-arm batch run on the cloud default, five known cases × 5 runs, one batch with an in-batch control
- [ ] Tag-line misses drop on the new rider with no other measure lower; numbers recorded in the spec
- [ ] Focus vs no-focus on the new rider recorded in the spec as ticket 13's follow-up result
- [ ] Changelog fragment written
