# 06: Intent Probe

Status: ready-for-agent
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

- [ ] The corpus holds every case kind above, and the help-question count supports the 2% bar
- [ ] The probe reports all four numbers for the shipped classifier prompt, with an in-batch control
- [ ] The help baselines ran on and off in one batch, with deltas reported against the control's spread
- [ ] The default flips only when every bar passes, and the numbers are recorded in the ticket's Landed section either way

For you: decide whether the recorded numbers and any near-miss cases change the bars.
