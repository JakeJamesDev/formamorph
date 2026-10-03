# 53: Help baseline against the bar, third run

Status: done
Status note: Fail. 74.5% grounded-correct over two batches against the 80% bar. Blind recall@5 is 89.4%. The worst questions and their causes are in the Handover.
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

**Verdict: fail.** 74.5% grounded-correct against the 80% bar (Q59, Q79), over two batches. Batch 1 scored 74.2%, inside 5 points of the bar, so batch 2 ran: 74.8%. No run of the ten reached 80% (71.1% to 78.4%).

**The build.** Both batches ran at `089281ca`, in a detached worktree. Edits in progress in the shared checkout could not reach it. The build has tickets 50, 51 and 52. It also has the formaquestion-settings work, committed through its ticket 11.

- Help reasoning is off. Ticket 09's default for the help answer is off. The request bodies with that default and with reasoning forced off are byte-equal.
- Ticket 11 moved the help prompts into presets. I captured the request bodies of four questions at `e095114c` and at `089281ca`. They are byte-equal, except for three new lines in the AI Picks list: `Formaquestion › Formaquestion Settings › General`, `› Endpoint` and `› Prompts`.
- Since ticket 46, the guide pages gained 120 lines, 95 of them in `Formaquestion.md`. The AI Picks list has 495 headings. Ticket 46's build has 491.

**Batches.** `npm run probe:help -- --runs 5` twice, with `BASELINE_NO_WATCH=1`. Default cloud endpoint, model `default`. Each batch: 125 questions × 2 arms × 5 runs = 1,250 answers, 0 failed. Batch 1 took 1,077 s, batch 2 took 986 s. No key changed. Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-03T11-44-02-688Z.json` and `…T12-00-44-695Z.json`.

**The bar, next to tickets 26, 37 and 46.** A scratch scorer, as in ticket 46. It runs the harness's `scoreAnswer` over the retrieval rows of the three bar kinds and counts to one decimal. On ticket 46's raw files it gives 75.9% and 75.1%, as ticket 46 reported.

| Kind | Answers per batch | Ticket 26 | Ticket 37 | Ticket 46 | Ticket 53, batch 1 | Ticket 53, batch 2 | Ticket 53, both |
|---|---|---|---|---|---|---|---|
| Task | 375 | 46.1% | 49.3% | 71.7% | 70.9% | 72.0% | 71.5% |
| Here | 60 | 50.0% | 85.0% | 97.5% | 91.7% | 88.3% | 90.0% |
| Follow-up | 50 | 34.0% | 26.0% | 77.0% | 78.0% | 80.0% | 79.0% |
| **Bar (all three)** | 485 | **45.4%** | **51.3%** | **75.5%** | **74.2%** | **74.8%** | **74.5%** |

- The bar needs 776 of the 970 answers. The two batches have 723. That is 53 fewer than the bar.
- Outside the bar, batch 1 / batch 2: language with the setting 98% / 100%, asked in the language 90% / 90%, changelog 100% / 100%, not covered 10% / 10% missed flags.
- Retrieval arm, all 625 answers, batch 1 / batch 2: right source 88% / 88%, false flag 4% / 5%, invented name 12% / 9%. Cost per question: 2 requests, about 6,100 tokens in, about 200 out.
- No-docs control: keys met 2% / 1%. The keys still cannot be guessed.

**The search sends the keyed section more often. The answers use it less often.**

| A keyed section | Ticket 53, both batches | Grounded-correct | Ticket 46 |
|---|---|---|---|
| reached the model | 834 of 970 (86%) | 86.7% | 813 of 970 (84%), 90.0% |
| did not reach the model | 136 of 970 (14%) | 0% | 157 of 970 (16%), 0% |

- 247 answers failed: 136 with no keyed section, 111 with one.
- Of the 136, 18 met the keys from a section the key does not list: `memory-2` (10) and `world-editor-openings-2` (8).
- Of the 111, 93 missed a keyed fact and 30 held a forbidden name.
- 33 bar questions have a failed run. 18 have no correct run.
- Against ticket 46, per question: 40 correct answers gained and 49 lost. Gains: `worldformat-2` 0 → 10 and `tools-2` 0 → 5 (ticket 52's keyword lines), `prompts-2` 4 → 10, `world-editor-stats-2` 7 → 10. Losses: `here-make-tool` 8 → 0, `world-editor-dictionary-1` 8 → 0, `world-editor-stats-1` 10 → 2, `world-editor-openings-2` 5 → 0, `world-editor-placeholders-3` 10 → 5, `starting-a-game-2` 9 → 5.

**Build or model: the four large losses.** I sent the real search from ticket 46's commit (`773f369a`) and from `089281ca`, interleaved, 6 runs each. AI Picks went over the network and the answer was mocked. Saved block lists (not tracked): `testing/baseline/runs/help-blocks-ticket53-2026-10-03.tsv`.

| Question | Ticket 46's build, today | This build, today | Cause of the loss |
|---|---|---|---|
| `here-make-tool` | **How to Try a Tool** in 4 of 6 | **How to Try a Tool** in 0 of 6 | The build. In ticket 46, all 8 runs with that section were right, and both runs without it failed |
| `world-editor-dictionary-1` | keyed section in 0 of 6 | keyed section in 2 of 6 | The model. Ticket 46's build misses the section today too |
| `world-editor-openings-2` | keyed section in 0 of 6 | keyed section in 0 of 6 | The model, as above |
| `world-editor-stats-1` | both blocks of ticket 46 | both blocks of ticket 46 | Not the block. Ticket 46 answered right with both. The answer side is UNVERIFIED: I did not send the answer from ticket 46's build |

- The change behind `here-make-tool` is not isolated. Ticket 52's keyword line is the only change to `Tools.md`. I did not test it alone.

**Recall, shipped defaults (keyword + AI Picks, semantic off).** `npm run probe:help-recall -- --ai --arms keyword,shipped --runs 5` with no screen, and `--runs 3 --screen <screen>` for each screen. 0 failed pick requests and 0 failed first answers in every run. Raw rows (not tracked): `help-recall-2026-10-03T12-06-10-105Z` (no screen), `…T12-09-16-292Z` (library), `…T12-12-42-489Z` (stats), `…T12-15-34-944Z` (game).

| Asked over | Runs | Set | Keyword: task @5 | Shipped: recall@5 | Shipped: task @5 | Ticket 46: recall@5 | Ticket 46: task @5 |
|---|---|---|---|---|---|---|---|
| No screen | 5 | Known | 69.3% | 87.2% | 84.3% | 82.9% | 79.5% |
| No screen | 5 | **Blind** | 75.0% | **89.4%** | 89.3% | **87.9%** | 87.6% |
| Main Menu, Worlds tab | 3 | Known | 66.7% | 73.5% | 68.0% | 73.9% | 68.4% |
| Main Menu, Worlds tab | 3 | Blind | 70.2% | 81.9% | 81.0% | 81.2% | 80.2% |
| World Editor, Stats tab | 3 | Known | 66.7% | 64.9% | 58.7% | 66.3% | 60.9% |
| World Editor, Stats tab | 3 | Blind | 70.2% | 70.2% | 69.0% | 70.9% | 69.0% |
| Game screen, Memory tab | 3 | Known | 66.7% | 70.4% | 65.3% | 70.4% | 64.0% |
| Game screen, Memory tab | 3 | Blind | 70.2% | 72.7% | 71.8% | 71.6% | 70.2% |

- Blind-set recall@5 for the shipped defaults is 89.4%, up from 87.9%. Ticket 52 measured 89.4% too.
- With no screen, known-set task recall@5 rose from 79.5% to 84.3%.
- Over an open screen, recall did not change. Every screen row is within 2.2 points of ticket 46. Task recall@5 is still 8–26 points under the no-screen numbers.
- "Here" recall@5 is 100% on every screen. Follow-up recall@5 with no screen: 94.0% known and 90.0% blind. Over a screen: 70.0–83.3% known and 80.0–90.0% blind.
- Over the Stats tab, the shipped arm is still under the keyword search on the known set (64.9% vs 66.7%).

**Worst questions.** Both batches, by fewest correct runs, then by cause. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `follow-backup-restore`: "and how do I load that on the new machine?" | 0/10 | Gave the **Load Game** › **Import** steps | Model error, as in tickets 46 and 51. "load" matches the save-import section on the same page |
| 2 | `saves-and-backup-2`: "my friend sent me their game progress file" | 0/10 | Gave both imports and named **Import World** | Model error, as in tickets 46 and 51 |
| 3 | `formaquestion-1`: drag the help popup aside and shrink it | 0/10 | Gave the steps to move the **Help** tab | Model error, as in tickets 46 and 51. Ticket 51's control got 7/12 on the same block |
| 4 | `glossary-1`: a list of the terms used while playing | 0/10 | Said the **Glossary** has them and listed no term | Model error, as in ticket 46 |
| 5 | `statcodeguide-3`: make hunger rise every turn with a script | 0/10 | Gave `regen` and an example script. No **Advanced** › **Test Code** steps | Model error, as in tickets 46 and 51 |
| 6 | `world-editor-entities-2`: Robert is called Bob | 0/10 | Named **Aliases** in 9 of 10, **Advanced** in none | Model error, as in ticket 46. A missing step |
| 7 | `here-make-tool`: "how do I make a new one here?" on the Tools tab | 0/10 | Gave the **Add New Preset…** steps for a prompt preset, in 10 of 10 | Search change in the build, new. The block lost **How to Try a Tool** (see above). The answer then uses `Prompts#how-to-make-a-prompt-preset`, sent 5th |
| 8 | `world-editor-dictionary-1`: write lore the AI remembers | 0/10 | Gave the **Add Memory** steps in 9 of 10 | Search miss, new. No Dictionary section in any run. Model drift (see above) |
| 9 | `world-editor-openings-2`: each place with its own first scene | 0/10 | Gave the **Starting Location** steps. Met the keys in 8 of 10 from other sections | Search miss, new. **Location Openings** in no run. Model drift (see above) |
| 10 | `memory-2`: turn off summaries and recall | 0/10 | Met the keys in 10 of 10 | Key gap, as in ticket 46. Q79 keeps the key |
| 11 | `library-2`: "make its box bigger" | 0/10 | Flagged in 10 of 10 | Search miss, as in ticket 46 |
| 12 | `prompts-1`: cheaper model for summaries | 0/10 | Flagged in 10 of 10 | Search miss, as in ticket 46 |
| 13 | `statcodeguide-2`: can my script check the time of day | 0/10 | Flagged in 10 of 10 | Search miss, as in ticket 46 |
| 14 | `memory-1`: "drop an old event" | 1/10 | Met the keys in the one run with the keyed section | Search miss, as in ticket 46 |
| 15 | `personas-1`: the same character picked automatically | 2/10 | Right in 2 of the 4 runs with a Personas section | Search miss, as in ticket 46. Ticket 46 got the section in no run |
| 16 | `follow-default-make`: "how do I create another one first?" | 2/10 | Right in 2 of the 4 runs with a Personas section | Search miss. It follows `personas-1` |
| 17 | `world-editor-stats-1`: track a secret value like suspicion | 2/10 | Gave the steps for a **Hidden** trait | Model error, new. The keyed **How to Hide a Stat** is sent 5th in all runs. The answer uses `World-Editor-Traits#availability`, sent 1st. Cause UNVERIFIED (see above) |

The other questions with no correct run are search misses, as in ticket 46: `entities-2`, `world-editor-placeholders-2`, `persona-authoring-2`, `world-editor-openings-4`, `worldformat-3`.

**For the spec session.** The 80% bar fails by 5.5 points. The 247 failed answers split into five groups:

| Group | Questions | Failed answers |
|---|---|---|
| Search misses: keyed section in 4 of 10 runs or fewer, 2 correct runs at most | 13 | 125 |
| Search change in the build: `here-make-tool` | 1 | 10 |
| Model errors: keyed section in every run, 2 correct runs at most | 7 | 68 |
| Key gap: `memory-2`, kept by Q79 | 1 | 10 |
| Questions with 5 to 9 correct runs | 11 | 34 |

- **Tickets 50–52 improved the search. The bar did not rise.** Keyed sections reach the model 2 points more often. Blind recall@5 rose 1.5 points. Ticket 52's two targets gained 15 answers.
- **The losses are of about the same size.** Answers with the keyed section were right less often (90.0% → 86.7%). Two pick misses came from the model: ticket 46's build makes them today too. One block change came from the build.
- **The model drifts.** Ticket 51's control ranged 73.2–78.4% per run. This run ranged 71.1–78.4%. With two batches, a change of under about 2 points is smaller than the drift.
- **Model errors.** In five of the seven, the answer uses another section of the block. Ticket 51 found that a prompt line does not fix this. Ticket 51 also found the cause: the question shares words with the names of the other section.
- **Keys.** `world-editor-openings-2` met its keys in 8 of 10 runs from a section its key does not list. This is new evidence on Q79's key ruling. With that section listed, the bar gains 0.8 points.

Semantic search is built and off (Q71). It was not measured here, because the ticket names the shipped defaults.

**Review** (`/mattpocock-skills:code-review 0da1cbe4`, this ticket's commit only). The spec reviewer recounted the bar, the per-kind and per-run numbers, the failure split, the groups, the per-question gains and losses and every recall row from the raw files, and found them right. Folded in:

- `here-make-tool` was a model error. In ticket 46, its result follows the block. A search from both builds shows the block changed with the build.
- The drift claims had no saved data. The search comparison now runs both builds interleaved, 6 runs each, and saves its block lists. `world-editor-stats-1` is marked UNVERIFIED.
- `memory-2` asked for a ruling that Q79 already gave. It now cites Q79. `world-editor-openings-2` moved from a "keys met" group to the search misses, because only 8 of its 10 failures met the keys.
- The worst list left out `memory-1`, `personas-1` and `follow-default-make`. Row 11 held three questions. Each question has its own row now.
- Row 6: **Aliases** in 9 of 10, not 10. Row 9: the keys came from other sections, not from **Add Opening to**.
- The docs line count now counts insertions in the guide pages only. `Design-System.md` is not in the help index.
- Status and its Status note, separate columns for ticket 46's recall, the glossary term **AI Picks**, and shorter sentences.

**Gates.** Not run. This ticket changed only this file and ran the existing harnesses in a worktree. No code changed, as in tickets 37 and 46.
