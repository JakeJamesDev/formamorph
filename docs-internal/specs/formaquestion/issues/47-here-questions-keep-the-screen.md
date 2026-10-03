# 47: "Here" questions keep the screen

Status: done
Status note: Built and measured. "Here" answers 97% vs 90% before, task 69% vs 70%, same batch. Task recall over an open screen is low in every arm; see Seen, not fixed.
Base: aed678cc
Blocked by: 44
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

AI picks stop crowding a "here" question with look-alike sections (Q74). In ticket 44, "here" questions fell from 98% to 82% grounded-correct with the shipped sources on. The screen's section still led every time. The picks added sections that look like answers, the Q69 pattern, and three of the 12 questions account for the drop.

- Find what the picks add on those three questions, and why the model follows it.
- Measure at least two rules, for example:
  - no pick request when the screen's section leads and the question's own keyword search finds nothing above the floor
  - picks after the screen's section count only when they are on the screen's page
- Ship the rule that recovers "here" questions without losing the task gain. The rule must be stateable without naming questions.

**Probe.** Ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Ticket 39's recall probe on both sets.

Recommended model rationale: the rule must fix "here" questions without fitting the three known ones.

## Acceptance criteria

- [x] The handover names what the picks added on the three questions, and why
- [x] "Here" grounded-correct returns within the 5-point drift of 98%, and task grounded-correct does not drop more than the drift; same batch
- [x] The rule is stated in the code and a test, with no question named
- [x] Four gates green

## Handover

**Result: "here" questions answer 97% grounded-correct with the rule, against 90% for the build before it in the same batch. Task questions answer 69% against 70%.**

**The rule (Q77).** A question that points at the open screen with "here", "this" or "these" keeps only the AI picks on the screen's guide page. When none is left, the keyword search alone runs, with its floor, as with a pick that gives nothing. A question with no such word, or with no screen open, keeps every pick.

- `screenPicks` and `POINTS_AT_SCREEN` in `src/lib/formaquestion/helpSession.ts`. `helpSearch` takes the surface hint whole, as `hint`.
- `screenRule: false` on a question turns the rule off. It exists for tests and the probes' control arm, like `searchSources`.
- `helpSession.screen.test.ts` states the rule. Five mutations each turned it red, and each restore was checked: no word bounds ("where", "thistle"), no screen check, the override ignored, the filter inverted, the rule removed.

**What the picks added, and why the model followed it.** Cloud picks, 8 for each question, from two batches; ticket 44's answer rows agree. The open screen's section led every block in both arms.

| Question | What the picks add | Why the answer follows it |
|---|---|---|
| "what is this panel showing me?", Memory tab | `How-to-Play#the-game-screen` as the first pick in 8 of 8, then `How-to-Play#the-side-panel-tabs` in 7 of 8. The pick request ignores no word, so "panel" matches the side panel | The side-panel section answers "this panel" word for word. In 4 of 5 control answers the model listed the four side-panel tabs and none of the Memory tab's controls |
| "what am I looking at here?", AI Context dialog | Sections of other screens in 3 of 8: `Test-Bench#ai-context`, the two World Editor Overview columns, `StatCodeGuide#overview`, two Formaquestion sections. Ticket 44's rows hold `Test-Bench#ai-context` in 4 of 5 | `Test-Bench#ai-context` describes another screen with the same name. The control's miss answered from it ("the **at** list") |
| "how do I make a new one here?", Settings › Tools tab | Five Settings how-tos only (narration layout, quoted speech, font and more) in 7 of 8. The hint says "Settings dialog", and the model picks the Settings page | No pick is a how-to for a Tool, so the off-page how-to of the keyword search (`Prompts#how-to-make-a-prompt-preset`) reads as the "new one". In this batch the control got it right 5 of 5, so this question is mostly drift |

**Answer probe.** Ticket 26's harness, all kinds, default cloud endpoint, model `default`, 5 runs, 625 answers in each arm, 0 failed. `retrieval` has the rule; `keep-old` is the build before it, in the same batch. It ran as three batches (1, 1 and 3 runs), each with both arms next to each other in time, merged and scored with `--rescore`. Raw rows: `testing/baseline/runs/help-baseline-2026-10-02-ticket47-merged.json` (not tracked).

| Kind | Answers | With the rule: grounded-correct | Before: grounded-correct | With the rule: right source | Before: right source |
|---|---|---|---|---|---|
| Task | 375 | 69% | 70% | 79% | 79% |
| **Here** | 60 | **97%** | 90% | 100% | 100% |
| Follow-up | 50 | 78% | 80% | 90% | 90% |
| Language, setting only | 40 | 98% | 95% | 100% | 100% |
| Language, asked in it | 40 | 80% | 78% | 93% | 90% |
| Changelog | 10 | 100% | 100% | 100% | 100% |
| Not covered | 50 | – | – | – | – |
| **All** | 625 | 76% | 75% | 85% | 85% |

- Not covered: an answer is right when it carries the general-knowledge flag. Missed flags are 8% in both arms; the All row counts these answers.
- Here, per question with the rule vs before: Memory tab 5/5 vs 1/5, Backup dialog 5/5 vs 4/5, AI Context 4/5 vs 4/5, Tools tab 4/5 vs 5/5, the other eight 5/5 in both.
- Both misses with the rule had only screen-page sections. The AI Context answer left out the keyed controls, and the Tools answer gave the "How to Turn On Tools" steps.
- The probe asks no task, follow-up or language question over an open screen, so the rule cannot change them in this probe; their differences are drift.
- The control scored 90% here, not ticket 44's 82%. The default model drifts between batches, which is why the control runs in the same batch.
- Cost is unchanged: 2 requests, 6,073 tokens in, 199 out, for each question.

**Recall probe.** Ticket 39's probe, both sets, same endpoint. `npm run probe:help-recall -- --ai --arms keyword,shipped,keep-old`, with `--screen` for the open-screen rows. 0 failed pick requests in every run. Raw rows (not tracked): `help-recall-2026-10-02T18-42-51-923Z.json` (no screen), `…T18-51-12-539Z` (library), `…T18-59-34-192Z` (stats), `…T19-09-37-754Z` (game).

| Asked over | Runs | Set | Keyword: task @5 | Rule: task @5 | Before: task @5 |
|---|---|---|---|---|---|
| No screen | 5 | Known | 68.0% | 78.9% | 78.9% |
| No screen | 5 | Blind | 73.8% | 86.7% | 86.7% |
| Main Menu, Worlds tab | 3 | Known | 45.3% | 60.0% | 61.8% |
| Main Menu, Worlds tab | 3 | Blind | 59.5% | 72.6% | 76.2% |
| World Editor, Stats tab | 3 | Known | 56.0% | 53.8% | 52.4% |
| World Editor, Stats tab | 3 | Blind | 64.3% | 58.7% | 58.7% |
| Game screen, Memory tab | 3 | Known | 56.0% | 58.7% | 60.4% |
| Game screen, Memory tab | 3 | Blind | 59.5% | 63.5% | 63.1% |

- With no screen open: recall@5 is 82.7% vs 82.7% on the known set and 87.0% vs 86.8% on the blind set, follow-ups 90% in both on the known set. The rule changes nothing there, as built.
- "Here" recall@5 is 100% in every arm: the right section is the screen's own.
- Follow-ups over a screen are left out. In these runs the before arm's follow-ups came after first answers made with the rule. The review fixed the probe, so each arm's first answers now use that arm's rule. Task questions have no history, so their column is exact.

**The rules measured.** Offline on the same cached picks, through the shipped `helpSections`: "here" questions 5 picks each, known tasks 2 picks each over three screens.

| Rule | Here @5 | Here blocks with an off-page pick | Tasks @ Library | @ Stats | @ Memory tab |
|---|---|---|---|---|---|
| Before | 100% | 25/60 | 62.7% | 55.3% | 61.3% |
| Keyword only | 100% | 0/60 | 45.3% | 56.0% | 56.0% |
| A: no pick request when the keyword search finds nothing | 100% | 24/60 | 62.7% | 55.3% | 61.3% |
| B: picks count only on the screen's page | 100% | 0/60 | 45.3% | 52.0% | 54.0% |
| C: B only when one pick is on the screen's page | 100% | 10/60 | 64.0% | 51.3% | 57.3% |
| **I: B only when the question says here, this or these (shipped)** | 100% | 0/60 | 60.0% | 55.3% | 59.3% |

- A, the ticket's first example, fires only on the AI Context question; the keyword search finds something for the other two.
- B, the ticket's second example, takes away every task gain whenever a screen is open, which is every question in the app. The answer probe cannot see this: its task questions have no screen.
- I gives the same blocks as B on all 12 "here" questions.

**False catches.** "this" can name the app, not the screen: 4 of 75 known tasks and 4 of 84 blind tasks ("I just installed this, what should I do first?", "how do I get this game onto my phone?"). Over a screen, such a question keeps only the picks on that screen's page. This is most of the Main Menu gap above (blind 72.6% vs 76.2%). By the ruling, the word list has no exception for these.

**Seen, not fixed.**

- **Task recall over an open screen is far under the bar's measure.** Known tasks drop from 78.9% with no screen to 53.8–60.0% over a screen, in every arm. The screen's section and its page's how-tos take up to three of the five slots before the question's own hits. Over the Stats tab, the picks add nothing over the keyword search. The spec session added this report to ticket 46.
- **The pick request names the dialog, not the tab's page.** "Settings dialog, Tools tab" brings Settings how-tos into the picks for a Tools question.
- **`npm run probe:help` crashed twice on a locked file under `.scratch/`.** Vite's watcher follows the whole checkout. `BASELINE_NO_WATCH=1` turns it off and both reruns passed.

**Review** (`/mattpocock-skills:code-review aed678cc`, this commit only). Folded in:

- `helpSearch` takes the surface hint whole, and the override is named `screenRule`.
- The recall probe lists its session arms once, takes one `--screen` value, and gives `keep-old` first answers with the rule off.
- The "Not covered" row is in the answer table.

Left as is:

- The answer probe ran as three batches, each with both arms next to each other in time. "Same batch" reads that way here, as in ticket 44.
- The probe's arm flags are spread over five places in `help-baseline.cli.ts`. The pattern is older than this ticket.

**Tests.** `helpSession.screen.test.ts`, 9 tests. 247 tests in the help modules pass.

**Gates**, after the review fold-in: typecheck exit 0 (19 s), lint exit 0 (19 s, 2 warnings in files this ticket does not touch), test exit 0 (16,513 passed, 3 skipped, 126 s), build exit 0 (20 s). `testing/` is outside `tsconfig.json`, so the two probe files were checked with a scratch config: exit 0.
