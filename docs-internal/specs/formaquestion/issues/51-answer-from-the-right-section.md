# 51: Answer from the right section

Status: done
Status note: No prompt change ships (Q83). Four variants stayed inside drift; the arms stay in the help baseline.
Base: d9abe002
Blocked by: 46
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the right section is sent, the answer uses it instead of a sibling section that was also sent (Q79). In ticket 46, four questions got the keyed section and still failed every run:

- `follow-backup-restore`: keyed section first in all 10 runs; the answer used the save-import section on the same page
- `saves-and-backup-2`: also used a world-import section from another page
- `statcodeguide-3`: copied an example section instead of the how-to
- `formaquestion-1`: used another sent section

This is a prompt change, so read `docs-internal/notes/prompt-writing-guide/notes.md` first.

- Find what draws the model to the sibling: section order, section titles, how the prompt frames the sections, or the follow-up history.
- Options to measure include the section order in the block, a short label per section, or a positive line in the help prompt about matching the question to a section. Give no example values a small model can copy.
- Measure at least two variants. Do not fit the wording to the four questions.

**Probe.** Ticket 26's harness on all kinds, default cloud model, 5 runs per arm, the current build as the in-batch control. A prompt change needs 5–12 runs per arm on cloud; run more if the arms are within drift.

Recommended model rationale: a prompt change whose value only a careful probe can show.

## Acceptance criteria

- [x] The handover names what drew the model to the sibling in each of the four
- [x] At least two variants measured against the current build in the same batch
- [x] The shipped variant does not drop any kind by more than the 5-point drift (no variant ships, Q83)
- [x] Four gates green

## Handover

**Verdict: no prompt change ships (Q83).** Four variants ran against the current build. None gained more than drift. The best, a heading list, scored +0.9 ± 1.9 points on the bar over 12 paired runs. A prompt change ships on a measured gain, not on passing the guard.

**What drew the model to the sibling.** In each case, the cause is word overlap between the question and a sibling section's names. Position is not the cause.

| Question | Keyed section sent at | What the answer used | Words that pull the answer to the sibling |
|---|---|---|---|
| `follow-backup-restore` | 1st in all runs | How to Import a Save (same page) | "load" in the question matches **Load Game** in the save-import steps. The restore steps say "Restore", never "load". The history is not the cause: all 12 first answers name **Backup & Restore** and none names **Load Game** |
| `saves-and-backup-2` | 2nd to 5th | How to Import a World (Library), next to the save import | "game progress file" fits both imports. The world import ranks first, so the answer gives both and names **Import World** |
| `statcodeguide-3` | 2nd in all runs | Examples (same page) | "hunger … every turn … little script" matches the Examples section, which holds Hunger code and a per-hour drain. The how-to holds the controls but no script |
| `formaquestion-1` | 2nd in all runs | How to Move the Help Tab (same page, 1st) | "help popup … drag" matches the Help tab heading and its "Drag the **Help** tab" step |

- Over ticket 46's raw rows, the position of the keyed section does not predict a failure. Task answers with the keyed section 3rd to 5th were correct 90–95% of the time. The low cell is 2nd, at 65%. In that cell, the top hit is often the sibling that shares the question's words.
- **Drift.** Two of the four are not fixed failures. In this ticket's control, `formaquestion-1` scored 7/12 and `follow-backup-restore` 5/12, against 1/10 and 0/10 in ticket 46. `formaquestion-1` got the same block in all 12 runs, so its change is model drift. `follow-backup-restore` got a different block in 3 runs: **How to Load a Game** was sent too. All 3 failed. With the usual block it scored 5/9, so part of its change is search variance.

**Variants.** Each changes one lever and is described in `help-answer-variants.ts`. None of them names a question or holds an example value.

| Arm | What changes | Runs | Bar | Paired diff vs control (95% CI) | Kinds down by 5 points or more |
|---|---|---|---|---|---|
| Control | the current build | 12 | 76.1% | – | – |
| `v-labels` | the headings of the sent sections, as one line after the guide | 12 | 77.1% | +0.9 ± 1.9 | none (worst: language, asked in it, −2.1) |
| `v-order` | the block in reverse, top hit next to the question; the screen's lead stays first | 12 | 76.2% | +0.1 ± 1.2 | language with the setting −7.3, follow-up −5.0 |
| `v-goal` | system prompt line: "Answer from the guide section whose heading names what the player asks about." | 5 | 75.1% | −1.6 ± 4.5 | language with the setting −10.0 |
| `v-close` | the same rule as the user message's closing line | 7 | 74.1% | −1.6 ± 1.8 | follow-up −7.1, language with the setting −12.5, language asked in it −7.1 (batch 2) |

The four questions, correct runs:

| Question | Control | `v-labels` | `v-order` | `v-goal` | `v-close` |
|---|---|---|---|---|---|
| `follow-backup-restore` | 5/12 | 5/12 | 8/12 | 2/5 | 0/7 |
| `saves-and-backup-2` | 1/12 | 4/12 | 2/12 | 0/5 | 7/7 |
| `statcodeguide-3` | 0/12 | 3/12 | 0/12 | 0/5 | 0/7 |
| `formaquestion-1` | 7/12 | 0/12 | 0/12 | 3/5 | 6/7 |

- Each variant fixes some of the four and breaks others. `v-close` fixed `saves-and-backup-2` and kept `formaquestion-1`, but it lost every `follow-backup-restore` run and dropped follow-ups and language answers.
- `v-order` cut answers with an invented name from 10.5% to 8.5%, and `v-close` cut false flags from 4.8% to 1.7% (batch 2, same-batch control). Both arms also drop other kinds by 5 points or more.

**Batches.** `npm run probe:help -- --variants …` with `BASELINE_NO_WATCH=1`, default cloud endpoint, model `default`, the current build as the `retrieval` arm and `no-docs` as the key control. 0 failed requests in both batches.

| Batch | Arms | Runs | Answers | Time |
|---|---|---|---|---|
| 1 | control, `v-goal`, `v-labels`, `v-order` | 5 | 3,125 | 4,376 s |
| 2 | control, `v-labels`, `v-order`, `v-close` | 7 | 4,375 | 3,617 s |

- The times come from the probe's console log, not from the raw files.
- Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-03T00-32-48-406Z.json` and `…T01-35-45-709Z.json`.
- The bar is the grounded-correct rate of task, here and follow-up answers, scored by the harness's `scoreAnswer`. The paired diff compares each arm with the control run by run, inside the same batch.
- The control's bar runs ranged 73.2–78.4%, close to ticket 46's 75.5%. The no-docs control met the keys in 1% of answers in both batches.
- `v-goal` ran in batch 1 only and `v-close` in batch 2 only. Each dropped a kind by 10 points or more in its batch, so it did not run again.

**What stays.** The four arms stay in the help baseline as `--variants v-goal,v-close,v-labels,v-order`, so a later prompt change can measure against them. `help-answer-variants.test.ts` builds each rewrite from the real prompt and message. A variant stops the run when the prompt line it rewrites is gone. No app code changed.

**For ticket 53.** The four questions depend on which words the sibling shares with the question. A prompt line does not change that. A fix belongs in what the block holds. Examples: a sibling whose names match the question less, or a keyed section whose text uses the player's verb. That is a docs or search change, outside this ticket.

**Review** (`/mattpocock-skills:code-review d9abe002`, this ticket's commit only). The spec reviewer rescored all four batches and confirmed the bar, paired diffs, four-question cells and position cells. Folded in:

- `follow-backup-restore`: the history is ruled out as a cause, and the drift note now says its block changed in 3 runs, all failed.
- The variants table counts drops of 5 points or more, and adds `v-close`'s −7.1 on language asked in it.
- `v-close`'s false-flag gain is now against its own batch's control (4.8%).
- A rewrite that cannot apply now ends the probe, as `withoutEarlierAnswer` does. Before, the harness logged it as one failed row and ran on. A test covers it.
- The test mock is typed, so it needs no cast. The `--variants` check reuses `isVariant`. The two match-rule wordings share one string.
- Wording: no "draw", "trades" or "holds up".

Left as is:

- `answerVariant` repeats the request-rewrite shape of `withoutEarlierAnswer`. Two uses do not justify a shared helper yet.
- The constants copy lines of `helpPrompt.ts`. A changed line stops the run (`TAKE_LINE`, `CLOSE_LINE`) or fails a test that builds the message from the real prompt (`LEAD_LINE`, the section tag).
- The arm ternary in `askSession` gets one more branch, in the style of its neighbors.

**Gates** after the fold-in: `typecheck`, `lint` (3 warnings, all in other sessions' files), `test` (16,817 passed, 146 s) and `build` all exit 0. The first run, before the fold-in, had 3 test failures in files that other sessions were editing. No app code changed.
