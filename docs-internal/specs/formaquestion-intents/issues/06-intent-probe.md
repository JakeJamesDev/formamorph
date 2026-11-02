# 06: Intent Probe

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a labeled corpus, a drifting cloud model, and a default that flips only on a pass.

## What to build

Measure the Intent Classifier against its bars, tune its prompt, and flip its default only if it passes.

- A labeled corpus covering every Intent; two-ask messages; follow-ups that only resolve through the last exchange; create asks off-editor; lore questions; non-English questions. At least about 150 Help, Code and World cases, so the 2% Chat bar can be measured.
- A probe that reports: correct Intents, Formamorph questions given Chat, other questions given Create, and median classifier latency. Cloud default first, with an in-batch control, per the probe skill.
- The help baselines (`help-baseline`, `help-recall`, the world-question probe) run with the classifier on and off in one batch.
- Bars: at least 90% correct, at most 2% to Chat (Q29), at most 5% false Create (Q8), latency at most 1.5 s at the median (Q63), and no baseline drop beyond the control's spread or 3 points (Q60).
- On a pass, flip the Intent Classifier switch's default to on. On a fail, leave it off and record the numbers (Q15, Q43).

Spec: Q8, Q15, Q29, Q43, Q60, Q63; Testing Decisions.

## Acceptance criteria

- [x] The corpus holds every case kind above, and the help-question count supports the 2% bar: `testing/baseline/help-intent-cases.json`, 277 cases in 11 kinds, 209 Help, Code and World cases; `parseIntentCases` checks labels, kinds and sets, and its tests pass
- [x] The probe reports all four numbers for the shipped classifier prompt, with an in-batch control: `help-intent-probe.cli.ts`, shipped, prompted, control and keyword arms, shuffled per case, 5 runs
- [x] The help baselines ran on and off in one batch, with deltas reported against the control's spread: one chained batch on the cloud default, 5 runs each, numbers below
- [x] The default flips only when every bar passes, and the numbers are recorded in the ticket's Landed section either way: Q60 fails, so `intentClassifier` stays off

For you: decide whether the recorded numbers and any near-miss cases change the bars.

## Landed

**Result: fail on Q60. The Intent Classifier stays off by default.** The revised classifier prompt ships in `src/lib/formaquestion/helpPrompt.ts`, so players who turn Sort Questions on get it (spec session ruling). No export-shape change.

Cloud default (`api.lyonade.net`, model `default`), 2026-10-31, 5 runs per arm.

### Intent probe (shipped prompt, revision 2)

| Arm | Set | Correct | To Chat | False Create | Median latency |
|---|---|---|---|---|---|
| shipped | dev | 94.5% | 1.43% | 0.00% | 414 ms |
| shipped | blind | 90.0% | 0.00% | 1.23% | 400 ms |
| control (A/A) | dev | 94.2% | 1.43% | 0.00% | 412 ms |
| control (A/A) | blind | 89.8% ❌ | 0.00% | 1.23% | 399 ms |
| prompted (no schema) | dev | 93.0% | 2.14% ❌ | 0.00% | 231 ms |
| prompted (no schema) | blind | 91.3% | 0.00% | 1.23% | 225 ms |

- Shipped per-run spread: 92.4–93.5% correct.
- Second ask: found 85% of the time, marked on 7% of the rest.
- Old prompt (revision 0) in an earlier batch: 85.8% correct, 2.86% to Chat. Keyword floor: 67% correct, 30% to Chat.
- Latency beside both picks (help-baseline intent arm): 655 classifier requests, median 411 ms, slowest 12,440 ms. Q63 passes.

### Help baselines, classifier off vs on

| Probe | Off | On | Delta |
|---|---|---|---|
| help-baseline grounded-correct, all | 74% | 68% | −6 ❌ |
| help-baseline follow-up grounded-correct | 72% | 50% | −22 |
| help-baseline asked-in-language grounded-correct | 73% | 53% | −20 |
| help-recall Sent, known (off spread 79.6–82.5%) | 81.0% | 76.1% | −4.9 ❌ |
| help-recall Sent, blind | 81.0% | 71.8% | −9.2 ❌ |
| world-question correct (32 cases) | 83.3% | 90.0% | +6.7 |
| world-question leak | 0% | 0% | 0 |

**Cause:** problem-phrased how-tos ("a side character keeps showing up and I want them gone") get World, Chat or Create, and those Intents send no guide. About 24 of 201 recall questions take this path.

### What changed during the build

- Prompt revisions: v1 and v2 moved script how-tos to Help and stopped second-ask marks on single asks. v3 added "change, undo or fix" to Help. It scored 94.6% vs v2's 94.1% on dev, but added new misses, so v2 ships. That used the cap of 3 revisions.
- 12 dev and 8 blind problem-phrased how-to cases (`hp-`, `bhp-`) were added mid-build, after help-recall showed the gap.

### Commands

```
npx vite-node testing/baseline/harness/help-intent-probe.cli.ts -- --runs 5 --parallel 4
npx vite-node testing/baseline/harness/help-recall.cli.ts -- --ai --arms shipped,intent --runs 5
npx vite-node testing/baseline/harness/world-question-probe.cli.ts -- --arms shipped,off,full,intent --runs 5
npx vite-node testing/baseline/harness/help-baseline.cli.ts -- --intent --runs 5 --parallel 1
```

### Not verified

- The help-recall intent arm builds its follow-up history from the classifier-off first answers.
- Blind correct sits on the 90% line, and the A/A control misses it by 0.2 points.
- help-baseline and world-question have no A/A arm, so only help-recall has a measured off-arm spread. The help-baseline drop of 6 points fails the 3-point bar anyway.
- Latency is read per classifier request. A schema retry counts as two short samples, though the player waits for both.
- The blind set holds about 69 Help, Code and World cases. One case misrouted on every run gives 1.45% to Chat there.

### For you

- Decide whether the recorded numbers and any near-miss cases change the bars.
- Near misses: blind correct at 90.0% (control 89.8%), and the no-schema path at 2.14% to Chat on dev.
- The routing gap: problem-phrased how-tos routed to World, Chat or Create get no guide. Decide the fix, for example sending the guide with World, before the flip comes back.
