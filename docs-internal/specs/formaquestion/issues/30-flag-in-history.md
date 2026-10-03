# 30: General-knowledge flag in history

Status: done
Base: 224770f3
Blocked by: 21, 24
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On a follow-up, the model knows which of its earlier answers did not come from the guide (Q52). Today a flagged answer goes back into the history without its `[NOT IN GUIDE]` marker, so the model sees its own general answer as if the guide supported it.

- When the session builds the follow-up history, a flagged answer carries the marker again, in the same place the prompt asks for it. A grounded answer carries none.
- The player never sees the marker. Only the request changes.

**Probe.** This changes the request, so it needs numbers. Use ticket 20's harness with follow-up pairs where the first answer is flagged: a not-covered question, then a follow-up the guide also does not cover, and one it does cover. Report, with and without the marker in history, in the same batch on the default cloud model: how often the follow-up is flagged correctly, and answer quality on the covered follow-up.

Recommended model rationale: a small code change whose value is decided by a follow-up probe.

## Acceptance criteria

- [x] A follow-up request after a flagged answer holds that answer with the marker; a test asserts it
- [x] A follow-up request after a grounded answer holds no marker; a test asserts it
- [x] The marker never shows in the window
- [x] Probe numbers with and without the marker in history, same batch, are in the handover
- [x] Four gates green

## Handover

Built: `EarlierExchange` takes `flagged`, and `historyMessages` puts `[NOT IN GUIDE]` alone on the first line of a flagged earlier answer, where the prompt asks for it. `useHelpChat` already passes its exchanges, `flagged` included, so the window needed no change. The window text never held the marker; a hook test asserts both sides.

Probe (`help-flag-history-probe.cli.ts --runs 10`, cloud default endpoint, one batch, 2026-10-01). 5 pairs from `help-flag-history-cases.json`. Each first question is not in the guide; 50 of 50 first answers were flagged. Each follow-up went out in both arms with the same first answer. The arm check: 100 of 100 marked requests held the marker, 0 unmarked did.

| Follow-up | Arm | n | Flagged | Sections sent | Marked when sections sent | Facts | Complete |
|---|---|---|---|---|---|---|---|
| Not in the guide | marked (shipped) | 50 | 100% | 100% | 100% | – | – |
| Not in the guide | unmarked (control) | 50 | 100% | 100% | 100% | – | – |
| In the guide | marked (shipped) | 50 | 0% | 100% | 0% | 90% | 80% |
| In the guide | unmarked (control) | 50 | 0% | 100% | 0% | 90% | 80% |

- No difference on the cloud model: both arms are at the ceiling on both follow-up kinds, so this batch cannot show an effect either way. Every follow-up got sections, so each flag came from the model's own marker.
- The change does no harm, and it makes the history honest (Q52). A model weaker at the marker could gain from it; that needs a local arm, not run per the cloud-first policy.
- The 20% incomplete is one pair: "Then how do I publish the world?" after the villain question. The search sends no publish section there (section sent 0 of 20), in both arms. That is a follow-up search problem, not a marker problem.
