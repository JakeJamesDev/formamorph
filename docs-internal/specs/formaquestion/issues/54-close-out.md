# 54: Close-out

Status: done
Status note: Pass. 77.5% grounded-correct over two batches against the 75% bar (Q84). Two keys gained a section; tickets 46 and 53 rescore to 76.6% and 76.4%. The AI Picks reply causes the `here-make-tool` loss, not ticket 52's line. No fix ships (Q85).
Base: 2dd6581a
Blocked by: 53
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Formaquestion meets its final bar of 75% (Q84), and the effort closes. Three runs held at 74.5–75.5%, so the user set the bar at the measured level.

**1. Fix the `here-make-tool` regression.** In ticket 53, "how do I make a new one here?" on the Tools tab lost **How to Try a Tool** from its block and failed 10 of 10. The only Tools.md change was ticket 52's core-term keyword line, which was not tested alone.

- Confirm the cause by testing that line alone.
- Fix it so the question gets its how-to again, without losing ticket 52's `tools-2` gain. Check the blind set.

**2. Fix two keys (Q84).** Both questions are answered right from a real guide section that their key does not list.

- `memory-2`: add `Memory#turning-memory-off`.
- `world-editor-openings-2`: add `World-Editor-Openings#how-to-add-an-others-opening`.
- Change no other key.
- Rescore tickets 46 and 53's raw answers with the new keys, so every bar number compares.

**3. Final measurement.** Ticket 26's harness, default cloud model, 125 questions, both arms, 5 runs, the new keys. The bar is 75% grounded-correct over the English task, "here" and follow-up questions. A result inside 2 points of the bar gets a second batch before the verdict.

Recommended model rationale: one regression to trace, then the measurement that closes the effort.

## Acceptance criteria

- [x] The handover names the `here-make-tool` cause, tested alone, and the question gets its how-to again. Superseded by Q85: the cause is named, ticket 52's line is cleared, and no fix ships. At HEAD the question is right in 14 of 20 runs
- [x] `tools-2` keeps its gain, and blind recall@5 does not drop; same batch. Superseded by Q85: no fix ships, so no same-batch check applies. `tools-2` fell from 5/10 to 3/10 through a later docs section. Blind recall@5 is 89.4%, the same as ticket 53
- [x] The two keys list their extra section, and no other key changed
- [x] Tickets 46 and 53 are rescored with the new keys
- [x] The report states pass or fail against the 75% bar
- [x] Four gates green

## Handover

**Verdict: pass.** 77.5% grounded-correct against the 75% bar (Q84), over two batches with the new keys. Batch 1 scored 77.3%, which is 2.3 points over the bar, so the ticket asked for no second batch. Batch 2 ran anyway, to give 10 runs per question for the two regression checks: 77.7%. All ten runs scored 75.3% or more (75.3% to 81.4%).

**The build.** Both batches ran at `2dd6581a` in this ticket's worktree, with the two key changes only. No search, prompt or docs change ships in this ticket. Since ticket 53's build (`089281ca`), the help answer gained preset answer options. Their defaults are the help pins (temperature 0.2, penalty 1, 800 tokens). `Formaquestion.md` gained the Formaquestion settings sections. The AI Picks list has 496 headings, against 495 in ticket 53.

### 1. The `here-make-tool` cause

**Ticket 52's Tools.md line is not the cause.** I built two indexes in one process from the bundled pages: the current docs, and the current docs with only that line reverted.

- The full keyword ranking of the question is the same, with and without the score floor (328 hits, and 12 above the floor).
- With a fixed pick reply, the pick request (20,067 characters) and the answer request are byte-equal.
- The keyword lines are not in the AI Picks list, so the pick request cannot change.
- Live, both indexes interleaved, 10 runs each: 8/10 with the line, 7/10 without it.

**The cause is the AI Picks reply.** For this question the model writes one of these Tools lines as its third pick:

| Third pick | What joins slot 3 | Result |
|---|---|---|
| **Tools › How to Try a Tool** | **How to Try a Tool** | Right |
| **Tools › How to Share Your Tools** | **How to Share Your Tools** | Right |
| **Tools › Try It**, a reference section | **How to Turn On Tools**. The on-page how-to step skips **Try It**, because it is not a how-to | Wrong |

- **How to Turn On Tools** step 6 names the **Preset** list at the top of the Tools tab.
- `Prompts#how-to-make-a-prompt-preset` is in slot 5. With both, the model reads "a new one" as a new prompt preset. It then gives the **Add New Preset…** steps.
- 30 live answers ran on byte-equal requests. Every run with **How to Turn On Tools** in the block failed (9 of 9). Every other run was right (21 of 21).
- The model's choice of line changes with the `Formaquestion.md` pick lines. Live, 6 runs each, current code:

| Docs | **How to Try a Tool** in the block |
|---|---|
| `Formaquestion.md` at ticket 46's build (`773f369a`) | 0 of 6. The picks name **Settings** sections, and the screen rule drops them all |
| `Formaquestion.md` at ticket 53's build (`089281ca`) | 1 of 6 |
| `Tools.md` at ticket 46's build, the rest at HEAD | 2 of 6 |
| HEAD | 9 of 12 (4 of 6, then 5 of 6) |

- The `Tools.md` row shows how far a 6-run count swings. Its pick and answer requests are byte-equal to HEAD's, apart from the hidden keyword line.
- With ticket 46's own code, ticket 53 measured 4 of 6 at `773f369a`. So a code change since then moves this pick too. I did not trace it.

**At HEAD the question is right in 14 of 20 runs:** 8 of 10 in the targeted run, and 6 of 10 in the two final batches. The targeted run's reverted arm got 7 of 10. Ticket 46 got 8 of 10, and ticket 53 got 0 of 10.

**No fix ships (Q85).** A fix needs its own measured gain and a blind check (Q80, Q83). The cause is in the spec's Backlog.

### 2. Keys and rescore

`help-baseline-cases.json`: `memory-2` lists `Memory#turning-memory-off`, and `world-editor-openings-2` lists `World-Editor-Openings#how-to-add-an-others-opening`, both as `otherSections`. No other key changed. The set tests pass (49 tests).

A scratch scorer runs the harness's `scoreAnswer` over the retrieval rows of the three bar kinds. It counts to one decimal. With the old keys, it gives the exact numbers tickets 46 and 53 reported.

| Kind | Ticket 46, old keys | Ticket 46, new keys | Ticket 53, old keys | Ticket 53, new keys | Ticket 54, old keys | **Ticket 54, new keys** |
|---|---|---|---|---|---|---|
| Task | 71.7% | 73.2% | 71.5% | 73.9% | 73.6% | **75.6%** |
| Here | 97.5% | 97.5% | 90.0% | 90.0% | 96.7% | **96.7%** |
| Follow-up | 77.0% | 77.0% | 79.0% | 79.0% | 69.0% | **69.0%** |
| **Bar** | 75.5% | **76.6%** | 74.5% | **76.4%** | 76.0% | **77.5%** |

- The new keys add 11 answers to ticket 46 (`memory-2` 0 → 9, `world-editor-openings-2` 5 → 7) and 18 to ticket 53 (10 and 8).
- On the new keys, all three bar runs pass 75%. On the old keys, ticket 53 was under it.

### 3. Final measurement

`npm run probe:help -- --runs 5` twice, with `BASELINE_NO_WATCH=1`. Default cloud endpoint, model `default`. Each batch: 125 questions × 2 arms × 5 runs = 1,250 answers, 0 failed. Batch 1 took 1,204 s, batch 2 took 1,103 s. Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-03T16-22-14-948Z.json` and `…T16-41-47-078Z.json`.

| Kind | Answers per batch | Ticket 26 | Ticket 37 | Ticket 46 | Ticket 53 | Ticket 54, batch 1 | Ticket 54, batch 2 | **Ticket 54, both** |
|---|---|---|---|---|---|---|---|---|
| Task | 375 | 46.1% | 49.3% | 73.2% | 73.9% | 76.0% | 75.2% | **75.6%** |
| Here | 60 | 50.0% | 85.0% | 97.5% | 90.0% | 95.0% | 98.3% | **96.7%** |
| Follow-up | 50 | 34.0% | 26.0% | 77.0% | 79.0% | 66.0% | 72.0% | **69.0%** |
| **Bar (all three)** | 485 | 45.4% | 51.3% | 76.6% | 76.4% | 77.3% | 77.7% | **77.5%** |

Tickets 46 and 53 are on the new keys. Tickets 26 and 37 are as reported, on the old keys.

- The bar needs 728 of the 970 answers. The two batches have 752: 24 more than the bar.
- A keyed section reached the model in 843 of 970 answers (86.9%), and 89.2% of those were right.
- Outside the bar, batch 1 / batch 2: language with the setting 95% / 95%, asked in the language 95% / 95%, changelog 100% / 100%, not covered 10% / 10% missed flags.
- Retrieval arm, all 625 answers: 80% / 81% grounded-correct, false flag 4% / 4%, invented name 11% / 9%. Cost per question: 2 requests, about 6,100 tokens in, about 200 out, 4.5–5.0 s.
- No-docs control: keys met 2% in both batches.

**Recall, shipped defaults.** `npm run probe:help-recall -- --ai --arms keyword,shipped --runs 5`, no screen, 0 failed pick requests, 495 s. Raw (not tracked): `testing/baseline/runs/help-recall-2026-10-03T16-10-27-173Z`.

| Set | Keyword recall@5 | Shipped recall@5 (run range) | Shipped task @5 | Shipped follow-up @5 | Ticket 53, shipped recall@5 |
|---|---|---|---|---|---|
| Known | 70.1% | 87.0% (85.6–88.7%) | 85.1% | 86.0% | 87.2% |
| **Blind** | 72.3% | **89.4%** (88.3–90.4%) | 89.5% | 88.0% | **89.4%** |

The known set uses the new keys, so it is not exactly comparable to ticket 53. The blind set did not change.

**Against ticket 53, per question (new keys):** 43 correct answers gained and 32 lost. 35 bar questions have a failed run, and 15 have no correct run.

| Question | Ticket 53 | Ticket 54 | Cause |
|---|---|---|---|
| `here-make-tool` | 0/10 | 6/10 | The pick reply, above |
| `memory-1` | 1/10 | 7/10 | Not traced |
| `world-editor-stats-1` | 2/10 | 6/10 | Not traced |
| `world-editor-placeholders-3` | 5/10 | 9/10 | Not traced |
| `library-1` | 10/10 | **0/10** | New, from the pick lines. The AI Picks reply now names **Library** export and import sections. Before, it named the Android export-folder sections. The test: 3 runs each, live, `Formaquestion.md` from ticket 53 against HEAD, 3 of 3 each way. The keyed **How to Make a Group** comes first in 10 of 10. No answer names **Create New Group**. The answers use `World-Editor-Placeholders#groups`, or they say the guide has no answer |
| `follow-group-add` | 7/10 | **0/10** | Follows `library-1`: the first answer is wrong, so the follow-up gives the **Import World** steps |
| `tools-2` | 5/10 | 3/10 | New. `Formaquestion#tools` (formaquestion-settings ticket 14, `6c9a72e3`) has "function calls, local model, not supported" in its keyword line. It is in 10 of 10 blocks, and the keyed section in 5 of 10. All 10 answers give the **read_guide** steps, also the 5 with the keyed section. The 3 right answers come from those 5. Cause UNVERIFIED: no run removed that keyword line |

The questions with no correct run: `library-1`, `follow-group-add`, `library-2`, `formaquestion-1`, `entities-2`, `personas-1`, `follow-default-make`, `prompts-1`, `glossary-1`, `world-editor-entities-2`, `world-editor-dictionary-1`, `world-editor-placeholders-2`, `persona-authoring-2`, `statcodeguide-2`, `world-editor-openings-4`. All but the first two are in ticket 53's worst list.

**For the Backlog.** The pick list is a shared input. A new docs section moves the AI Picks of questions on other pages. The moves go both ways: `here-make-tool` came back, and `library-1` went. Two batches cannot separate this from drift on one question. But in the pick tests, each move holds in every live run. `library-1` and `follow-group-add` went to the spec session for a Backlog row.

Saved block lists (not tracked): `testing/baseline/runs/help-blocks-ticket54-2026-10-03.tsv`. Targeted `here-make-tool` answers: `testing/baseline/runs/help-alone-ticket54-2026-10-03.json`.

### Review

`/mattpocock-skills:code-review 2dd6581a`, this ticket's one commit. The spec reviewer recounted every bar, rescore, recall and cause number from the raw files, and found them right. It also confirmed that only the two named keys changed. Folded in:

- The targeted run's reverted arm was counted as HEAD. HEAD is now 14 of 20 runs, not 21 of 30.
- The `Tools.md` arm joined the pick-line table, to show how far a 6-run count swings.
- **How to Share Your Tools** joined the third-pick table.
- `tools-2`: the cause is marked UNVERIFIED, and the read_guide steps in all 10 answers are stated.
- The two Q85 criteria now say "Superseded by Q85".
- Shorter sentences, and a 4-line commit body.
- `library-1` went to the spec session for its Backlog row.

### Gates

typecheck exit 0 (25 s), lint exit 0 (23 s, 2 warnings in files this ticket does not touch), test exit 0 (146 s wall, 144 s suite, 16,906 passed), build exit 0 (22 s).
