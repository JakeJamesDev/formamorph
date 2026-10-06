# 14: Fence Tag Line

Status: done
Blocked by: 13 — Help Focus
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a rider wording change aimed at one measured failure, with a two-arm probe that also settles ticket 13's open gap.

## What to build

On the cloud default, the most common code-answer failure is the fence tag line: the model opens the block with ```javascript and puts `before` or `after` on the next line, so the fence has no slot and the answer fails. Ticket 13's probe counted 20 such misses in 100 answers, and on MeroMero ticket 07 saw 5 of 8 on one case. The Code rider's fence instruction is reworded so the slot sits on the fence line in the model's output. The rider's other lines and the test-first line are unchanged.

Probe, cloud default, smoke first: four arms in one batch, old rider × new rider × focus on and off, the five known cases × 5 runs each. The new rider must cut the tag-line misses with no drop in the other measures. The same batch settles ticket 13's question: with the tag line fixed, does naming the open stat cost anything? Record both results in the spec.

## Acceptance criteria

- [x] The rider's fence instruction is reworded (as built: a reason line above the unchanged fence lines; see Result); a rider test holds the new text and the no-member-names rule
- [x] Smoke run read before the batch
- [ ] Four-arm batch run on the cloud default, five known cases × 5 runs, one batch with an in-batch control
- [ ] Tag-line misses drop on the new rider with no other measure lower; numbers recorded in the spec
- [ ] Focus vs no-focus on the new rider recorded in the spec as ticket 13's follow-up result
- [x] Changelog fragment written

## Result

The rider keeps its two fence lines and gains one line above them: "The app reads the word after `javascript` on the opening line to put the code in the right box: `before` for **Before the AI**, `after` for **After the AI**." The model needs both parts. The reason alone drops the slot; a literal opener alone drifts.

Screens on the cloud default, five known cases, each arm against the old rider in the same batch. Every arm, the old rider included, ran as an `--alt` rider file; the old rider is `DEFAULT_CODE_RIDER` at `eaa1eafa`. Counts are first fences: slot on the fence line / on the next line / no slot.

| Batch | Arm | n | On line | Next line | No slot | Runs | Pass |
|---|---|---|---|---|---|---|---|
| 1 | old rider | 10 | 7 | 1 | 2 | 90% | 60% |
| 1 | `before` on the same line as `javascript` | 10 | 1 | 9 | 0 | 10% | 10% |
| 1 | opener, then "all on one line" | 10 | 0 | 0 | 10 | 100% | 60% |
| 1 | "three backticks, then `javascript before`" | 10 | 0 | 0 | 10 | 100% | 70% |
| 1 | opener in a double-backtick span | 10 | 4 | 0 | 6 | 100% | 80% |
| 2 | old rider | 20 | 13 | 5 | 2 | 75% | 55% |
| 2 | format template with `<language> <box>` | 20 | 0 | 0 | 20 | 100% | 65% |
| 3 | old rider | 20 | 15 | 1 | 4 | 95% | 75% |
| 3 | **reason line + old fence lines (shipped)** | 20 | **20** | 0 | 0 | 100% | 80% |
| 3 | reason line alone | 20 | 0 | 0 | 20 | 100% | 80% |

Without the reason, the model reads "box" as the UI box. With the template, it labeled each block with a `// Before the AI` comment instead of a slot.

User ruling 2026-10-05: the reason line ships on screen 3; the four-arm batch (old/new rider × focus on/off) is out of scope for now and runs with the full tests later. So the batch criteria above and ticket 13's follow-up stay open.
