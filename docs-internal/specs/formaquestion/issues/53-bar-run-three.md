# 53: Help baseline against the bar, third run

Status: in-progress
Base: 0da1cbe4
Blocked by: 50, 51, 52
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion meets the 80% bar (Q59, kept in Q79). Run ticket 46's measurement again on the build with tickets 50, 51 and 52.

- Default cloud model, ticket 26's 125 questions, both arms, 5 runs, the same keys as ticket 46. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind next to tickets 26, 37 and 46.
- Report ticket 39's blind-set recall and task recall over the three open screens, as ticket 46 did.
- A result inside 5 points of the bar gets a second batch before any verdict.
- Under the bar: list the worst questions with causes and hand them to the spec session. Do not tune the prompt here.

Recommended model rationale: the verdict decides whether the effort closes.

## Acceptance criteria

- [x] One full batch with no key changed, and a second if the result is within 5 points of 80%
- [x] The report states pass or fail against the bar, with per-kind numbers next to tickets 26, 37 and 46, the blind-set recall and the open-screen recall
- [x] On a fail, the worst questions and their causes are in the handover
- [x] Status moves to `ready-for-human`

## Handover

**Verdict: fail.** 74.5% grounded-correct against the 80% bar (Q59, Q79), over two batches. Batch 1 scored 74.2%, inside 5 points of the bar, so batch 2 ran: 74.8%. No run of the ten reached 80% (71.1% to 78.4%). Ticket 46 scored 75.5%.

**The build.** Both batches ran at `089281ca`, in a detached worktree. Edits in progress in the shared checkout could not reach it. The build has tickets 50, 51 and 52, and the formaquestion-settings work committed through its ticket 11.

- Help reasoning is off. Ticket 09's default for the help answer is off, and the request bodies with that default and with reasoning forced off are byte-equal.
- Ticket 11 moved the help prompts into presets. Request bodies captured at `e095114c` and at `089281ca` for four questions are byte-equal, except the pick list: three new lines, `Formaquestion › Formaquestion Settings › General`, `› Endpoint` and `› Prompts`.
- Since ticket 46, `docs/` gained 222 lines, 98 of them in `Formaquestion.md`. The pick list has 495 headings; ticket 46's build has 491.

**Batches.** `npm run probe:help -- --runs 5` twice, with `BASELINE_NO_WATCH=1`. Default cloud endpoint, model `default`. Each batch: 125 questions × 2 arms × 5 runs = 1,250 answers, 0 failed. Batch 1 took 1,077 s, batch 2 took 986 s. No key changed. Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-03T11-44-02-688Z.json` and `…T12-00-44-695Z.json`.

**The bar, next to tickets 26, 37 and 46.** A scratch scorer, as in ticket 46: the harness's `scoreAnswer` over the retrieval rows of the three bar kinds, to one decimal. It gives 75.9% and 75.1% on ticket 46's raw files, as ticket 46 reported.

| Kind | Answers per batch | Ticket 26 | Ticket 37 | Ticket 46 | Ticket 53, batch 1 | Ticket 53, batch 2 | Ticket 53, both |
|---|---|---|---|---|---|---|---|
| Task | 375 | 46.1% | 49.3% | 71.7% | 70.9% | 72.0% | 71.5% |
| Here | 60 | 50.0% | 85.0% | 97.5% | 91.7% | 88.3% | 90.0% |
| Follow-up | 50 | 34.0% | 26.0% | 77.0% | 78.0% | 80.0% | 79.0% |
| **Bar (all three)** | 485 | **45.4%** | **51.3%** | **75.5%** | **74.2%** | **74.8%** | **74.5%** |

- The bar needs 776 of the 970 answers. The two batches have 723, so 53 short.
- Outside the bar, batch 1 / batch 2: language with the setting 98% / 100%, asked in the language 90% / 90%, changelog 100% / 100%, not covered 10% / 10% missed flags.
- Retrieval arm, all 625 answers, batch 1 / batch 2: right source 88% / 88%, false flag 4% / 5%, invented name 12% / 9%. Cost per question: 2 requests, about 6,100 tokens in, about 200 out.
- No-docs control: keys met 2% / 1%, so the keys still cannot be guessed.

**The search sends the keyed section more often, but the answers use it less well.**

| A keyed section | Ticket 53, both batches | Grounded-correct | Ticket 46 |
|---|---|---|---|
| reached the model | 834 of 970 (86%) | 86.7% | 813 of 970 (84%), 90.0% |
| did not reach the model | 136 of 970 (14%) | 0% | 157 of 970 (16%), 0% |

- 247 answers failed: 136 with no keyed section, 111 with one.
- Of the 136, 18 met the keys from a section the key does not list: `memory-2` (10) and `world-editor-openings-2` (8).
- Of the 111, 93 missed a keyed fact and 30 held a forbidden name.
- 33 bar questions have a failed run; 18 have no correct run.
- Against ticket 46, per question: 40 correct answers gained and 49 lost. Gains: `worldformat-2` 0 → 10 and `tools-2` 0 → 5 (ticket 52's keyword lines), `prompts-2` 4 → 10, `world-editor-stats-2` 7 → 10. Losses: `here-make-tool` 8 → 0, `world-editor-dictionary-1` 8 → 0, `world-editor-stats-1` 10 → 2, `world-editor-openings-2` 5 → 0, `world-editor-placeholders-3` 10 → 5, `starting-a-game-2` 9 → 5.

**Drift in the pick model.** For `world-editor-dictionary-1` and `world-editor-openings-2`, I sent the same pick requests from ticket 46's commit (`773f369a`) and from `089281ca`, 3 runs each, minutes apart. Ticket 46's build now picks the same Memory sections for the lore question, and drops **Location Openings** for the openings question. So these two losses come from the cloud model, not from the build. Ticket 51 saw the same drift on the answer side.

**Recall, shipped defaults (keyword + AI picks, semantic off).** `npm run probe:help-recall -- --ai --arms keyword,shipped --runs 5` with no screen, and `--runs 3 --screen <screen>` for each screen. 0 failed pick requests and 0 failed first answers in every run. Raw rows (not tracked): `help-recall-2026-10-03T12-06-10-105Z` (no screen), `…T12-09-16-292Z` (library), `…T12-12-42-489Z` (stats), `…T12-15-34-944Z` (game).

| Asked over | Runs | Set | Keyword: task @5 | Shipped: recall@5 | Shipped: task @5 | Ticket 46: recall@5 / task @5 |
|---|---|---|---|---|---|---|
| No screen | 5 | Known | 69.3% | 87.2% | 84.3% | 82.9% / 79.5% |
| No screen | 5 | **Blind** | 75.0% | **89.4%** | 89.3% | **87.9%** / 87.6% |
| Main Menu, Worlds tab | 3 | Known | 66.7% | 73.5% | 68.0% | 73.9% / 68.4% |
| Main Menu, Worlds tab | 3 | Blind | 70.2% | 81.9% | 81.0% | 81.2% / 80.2% |
| World Editor, Stats tab | 3 | Known | 66.7% | 64.9% | 58.7% | 66.3% / 60.9% |
| World Editor, Stats tab | 3 | Blind | 70.2% | 70.2% | 69.0% | 70.9% / 69.0% |
| Game screen, Memory tab | 3 | Known | 66.7% | 70.4% | 65.3% | 70.4% / 64.0% |
| Game screen, Memory tab | 3 | Blind | 70.2% | 72.7% | 71.8% | 71.6% / 70.2% |

- Blind-set recall@5 for the shipped defaults is 89.4%, up from 87.9%. Ticket 52 measured 89.4% too.
- With no screen, known-set task recall@5 rose from 79.5% to 84.3%.
- Over an open screen, recall did not move: every screen row is within 2.2 points of ticket 46. Task recall@5 is still 8–26 points under the no-screen numbers.
- "Here" recall@5 is 100% on every screen. Follow-up recall@5: 94.0% known and 90.0% blind with no screen; 70.0–83.3% known and 80.0–90.0% blind over a screen.
- Over the Stats tab, the shipped arm is still under the keyword search on the known set (64.9% vs 66.7%).

**Worst questions.** Both batches, by fewest correct runs, then by cause. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `follow-backup-restore`: "and how do I load that on the new machine?" | 0/10 | Gave the **Load Game** › **Import** steps | Model error, as in tickets 46 and 51. "load" matches the save-import section on the same page |
| 2 | `saves-and-backup-2`: "my friend sent me their game progress file" | 0/10 | Gave both imports and named **Import World** | Model error, as in tickets 46 and 51 |
| 3 | `here-make-tool`: "how do I make a new one here?" on the Tools tab | 0/10 | Gave the **Add New Preset…** steps for a prompt preset, in 10 of 10 | Model error, new. The keyed how-to is 2nd in all runs. The answer uses `Prompts#how-to-make-a-prompt-preset`, sent 5th, as in ticket 46. The block now has **How to Turn On Tools** in place of **How to Try a Tool** |
| 4 | `formaquestion-1`: drag the help popup aside and shrink it | 0/10 | Gave the steps to move the **Help** tab | Model error, as in tickets 46 and 51. Ticket 51's control got 7/12 on the same block |
| 5 | `glossary-1`: a list of the terms used while playing | 0/10 | Said the **Glossary** has them and listed no term | Model error, as in ticket 46 |
| 6 | `statcodeguide-3`: make hunger rise every turn with a script | 0/10 | Gave `regen` and an example script. No **Advanced** › **Test Code** steps | Model error, as in tickets 46 and 51 |
| 7 | `world-editor-entities-2`: Robert is called Bob | 0/10 | Named **Aliases**, never **Advanced** | Model error, as in ticket 46. A missing step |
| 8 | `world-editor-dictionary-1`: write lore the AI remembers | 0/10 | Gave the **Add Memory** steps in 9 of 10 | Search miss, new. No Dictionary section in any run. Model drift: ticket 46's build picks the same today |
| 9 | `world-editor-openings-2`: each place with its own first scene | 0/10 | Gave the **Starting Location** steps, and **Add Opening to** from the Others opening how-to | Search miss, new: **Location Openings** in no run. Model drift, as row 8. The keys are met in 8 of 10 from an unlisted section |
| 10 | `memory-2`: turn off summaries and recall | 0/10 | Met the keys in 10 of 10 | Key gap, as in ticket 46: `Memory#turning-memory-off` is not in `otherSections` |
| 11 | `library-2`, `prompts-1`, `statcodeguide-2` | 0/10 | Flagged in 10 of 10 | Search misses, as in ticket 46 |
| 12 | `world-editor-stats-1`: track a secret value like suspicion | 2/10 | Gave the steps for a **Hidden** trait | Model error, new. The keyed **How to Hide a Stat** is sent 5th in all runs; the answer uses `World-Editor-Traits#availability`, sent 1st. Ticket 46 sent this same block in 2 of its 10 runs and answered right in both, so the change is model drift |

The other questions with no correct run are search misses, as in ticket 46: `entities-2`, `world-editor-placeholders-2`, `persona-authoring-2`, `world-editor-openings-4`, `worldformat-3`.

**For the spec session.** The 80% bar fails by 5.5 points. The 247 failed answers split into four groups:

| Group | Questions | Failed answers |
|---|---|---|
| Search misses: keyed section in 4 of 10 runs or fewer, 2 correct runs at most | 12 | 115 |
| Model errors: keyed section in every run, 2 correct runs at most | 8 | 78 |
| Keys met from an unlisted section: `memory-2`, `world-editor-openings-2` | 2 | 20 |
| Questions with 5 to 9 correct runs | 11 | 34 |

- **Tickets 50–52 moved the search, not the bar.** Keyed sections reach the model 2 points more often, and blind recall@5 rose 1.5 points. Ticket 52's two targets gained 15 answers. Losses of about the same size came from answers that had the keyed section and did not use it (90.0% → 86.7%), and from two pick misses that ticket 46's build makes today too.
- **The model drifts.** Ticket 51's control ranged 73.2–78.4% per run; this run ranged 71.1–78.4%. A gain of under about 2 points cannot be told from drift with two batches. Three of the six large losses (rows 8, 9, 12) are drift on a block ticket 46's build also gets.
- **Model errors.** In six of the eight, the answer uses another section of the block. Ticket 51 found that a prompt line does not fix this, and that the cause is the words the question shares with the sibling's names.
- **Key gaps.** Adding `Memory#turning-memory-off` to `memory-2` and `World-Editor-Openings#how-to-add-an-others-opening` to `world-editor-openings-2` is a key change and needs a ruling. Together they add about 1.9 points.

Semantic search is built and off (Q71). It was not measured here, because the ticket names the shipped defaults.

**Gates.** Not run. This ticket changed only this file and ran the existing harnesses in a worktree. No code changed, as in tickets 37 and 46.
