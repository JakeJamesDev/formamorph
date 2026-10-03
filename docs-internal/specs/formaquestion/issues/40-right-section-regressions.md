# 40: Regressions with the right section sent

Status: done
Base: aabf1297
Blocked by: 37
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns why six questions got worse even though their right section still reached the model (Q68). In ticket 37, the grounded-correct rate when the right section arrives fell from 92% to 86%. Follow-ups fell in tickets 34, 36 and 37 in a row.

| Question | Ticket 26 → 37 |
|---|---|
| `follow-publish-update` | 5/5 → 0/5, flagged in every run; three extra sections now reach it |
| `here-backup-dialog` | 5/5 → 0/5, answers about the Formaquestion window |
| `here-memory-tab` | 5/5 → 2/5 |
| `linkedcontent-1` | 5/5 → 2/5 |
| `worldeditor-1` | 5/5 → 3/5 |
| `follow-group-add` | 4/5 → 2/5 |

- For each question, compare the request at ticket 26's build and at the current build: sections, order and size.
- Rerun the six on both builds in one batch, default cloud model, 10 runs per arm. Each arm is the other's control.
- Name a cause for each: a change in the sections sent, or model drift (same input, different answer).
- For each cause in the sections, propose a fix. Build it here only if it is small and its probe shows the six recover without other kinds falling more than the 5-point drift. Otherwise hand it to the spec session.

Recommended model rationale: telling drift from a real change needs careful reading of requests and answers.

## Acceptance criteria

- [x] Each of the six questions has a cause, backed by the request diff and the same-batch numbers
- [x] Same-batch numbers, ticket 26 build vs current build, 10 runs per arm, are in the handover
- [x] Any fix built here has probe numbers on all kinds; otherwise the proposed fixes are handed over
- [x] Four gates green if code changed (no code changed)

## Handover

**Verdict: all six are section changes, not model drift.** One question, `here-memory-tab`, has a small section effect, and drift made it look large in ticket 37.

**Builds.** Ticket 26's build is fdeb43ae. The current build is aabf1297, which holds tickets 32 to 36. Both ran from `git archive` copies in `.scratch/`, so the shared tree and ticket 38's edits did not touch them. The harness, the help prompt and the samplers are the same in both builds.

**Same batch.** `npm run probe:help -- --only <the six> --runs 10`, both builds started together, default cloud endpoint, model `default`. 160 answers per build in 112 s and 117 s, 0 failed. Each build sent the same sections in all 10 runs.

| Question | Ticket 26 build | Current build | Ticket 26 → 37 |
|---|---|---|---|
| `follow-publish-update` | 10/10 | 3/10, 7 flagged | 5/5 → 0/5 |
| `here-backup-dialog` | 10/10 | 0/10 | 5/5 → 0/5 |
| `here-memory-tab` | 10/10 | 9/10 | 5/5 → 2/5 |
| `linkedcontent-1` | 10/10 | 6/10 | 5/5 → 2/5 |
| `worldeditor-1` | 10/10 | 2/10 | 5/5 → 3/5 |
| `follow-group-add` | 6/10 | 0/10 | 4/5 → 2/5 |
| **All six** | **56/60** | **20/60** | |

**Ablation batch.** I resent each recorded request 10 times, changing one thing each time: one section removed, or one order changed. All 220 answers ran in one batch (105 s). The "exact" rows resend the recorded request unchanged. They match the batch above, so the same input gives the same result.

| Question | Exact, ticket 26 | Exact, current | Current with one change | Result |
|---|---|---|---|---|
| `worldeditor-1` | 10/10 | 4/10 | without Personas **Change It in Game** | 10/10 |
| `linkedcontent-1` | 10/10 | 5/10 | without `Glossary#building-a-world` | 10/10 |
| `follow-group-add` | 4/10 | 0/10 | without **The Load Game Dialog** | 10/10 |
| `follow-publish-update` | 10/10 | 0/10, 10 flagged | without `Glossary#building-a-world` | 9/10 |
| `here-backup-dialog` | 10/10 | 0/10 | without the three Formaquestion sections | 6/10, all 10 about the right dialog |
| | | | ticket 26's order, 5 sections | 0/10 |
| | | | current order, ticket 26's sixth section added | 8/10 |
| `here-memory-tab` | 10/10 | 7/10 | | |

**Causes.**

| Question | What changed in the request | Ticket |
|---|---|---|
| `worldeditor-1` | A changelog section left slot 2. Personas **Change It in Game** (0.29 of the top hit's score) took slot 5. The answer then explains how to rename a persona | 34 |
| `linkedcontent-1` | Two changelog sections left. `Glossary#building-a-world` came in, and the answer talks about Blueprint **Link** and **Copy** | 34 |
| `follow-group-add` | A changelog section left. **The Load Game Dialog** came in, and every answer gives the download steps. Both builds put "How to Download a World" first: "get one of my worlds" matches the download page | 34 |
| `follow-publish-update` | The large changelog section had stopped the block at 3 sections by the budget. Now the block holds 5 sections: the Glossary hub, **Upload or link** and **App Updates** (7,067 → 10,770 characters). The answer flags | 34 |
| `here-backup-dialog` | "window" finds three Formaquestion sections in both builds. Ticket 26's build passed by chance: both 5-section variants I tried score 0/10. Ticket 32 counts the lead section in the 5-section cap and moves an on-page how-to to slot 3 | 32 |
| `here-memory-tab` | Ticket 32 replaced two "the panel" sections with Memory how-tos. Answers then explain how to add a memory and miss the pin and forget controls. Ticket 37 sent the same request as the current build and got 2/5. This batch gets 9/10 and 7/10, so most of ticket 37's drop is drift | 32 |

The common cause: the changelog sections in slots 2 to 5 had nothing to do with the question, so the model ignored them. Ticket 34 replaced them with guide sections that look like answers.

**Proposed fixes.** None is built here. Ticket 38 is editing `docsIndex.ts` and the harness, and fixes 1 and 2 change the same ranking.

1. **The hub rule of ticket 38** should recover `linkedcontent-1` and `follow-publish-update`. Without the Glossary hub, they score 10/10 and 9/10. Ticket 38's probe should list both. Also, the first answer of `follow-publish-update` has the hub as its first source, so ticket 35 favors the Glossary page for the follow-up.
2. **A score floor for slots 2 to 5.** Leave out a hit that scores less than a set share of the top hit. Evidence: `worldeditor-1` gets 10/10 with only the key section, and its distractor scores 0.29 of the top hit. A floor does not fix `follow-group-add`: there, the key section and its distractor score 0.57 and 0.56. That question needs the first question's search to find **Group**, which is ticket 37's search-miss work.
3. **Screen words on a "here" question.** When a Surface is open, the search ignores "window", "panel", "dialog", "screen" and "tab", as ticket 36 does for "here". Evidence: without the Formaquestion sections, all 10 `here-backup-dialog` answers describe the right dialog. In `here-memory-tab`, "panel" brings in the World Editor panel sections.

Each fix needs a probe on all kinds, with the current build as the in-batch control.

**Files.** Not tracked, in `.scratch/`: the two build copies `t40-t26/` and `t40-cur/`, their raw answers under `testing/baseline/runs/` with each request's messages, and the ablation scripts `replay.ts`, `scores.ts` and `analyze.ts` in `t40-cur/`.

**Gates.** Not run, because no code changed.
