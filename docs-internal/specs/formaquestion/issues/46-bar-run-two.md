# 46: Help baseline against the bar, second run

Status: done
Status note: Fail. 75.5% grounded-correct over two batches against the 80% bar. Blind recall@5 is 87.9%. The worst questions and their causes are in the Handover.
Base: 773f369a
Blocked by: 43, 44, 45, 47, 49
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion now meets the 80% bar (Q59, kept in Q72). Run ticket 37's measurement again on the build with tickets 43, 44, 45, 47 and 49 and the shipped source defaults.

- Default cloud model, ticket 26's 125 questions, both arms, 5 runs, the same keys. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind next to tickets 26 and 37.
- Also report ticket 39's blind-set recall for the shipped defaults, since the known set flatters the search.
- Also report task recall@5 with an open screen (ticket 47's screen option), since in the app every question has one (Q77). It is reported, not part of the bar.
- A result inside 5 points of the bar gets a second batch before any verdict.
- Under the bar: list the worst questions with causes and hand them to the spec session. Do not tune the prompt here.

Recommended model rationale: the verdict and the cause list decide what comes next.

## Acceptance criteria

- [x] One full batch with no key changed, and a second if the result is within 5 points of 80%
- [x] The report states pass or fail against the bar, with per-kind numbers next to tickets 26 and 37, and the blind-set recall
- [x] On a fail, the worst questions and their causes are in the handover
- [x] Status moves to `ready-for-human`

## Handover

**Verdict: fail.** 75.5% grounded-correct against the 80% bar (Q59), over two batches. The first batch scored 75.9%, inside 5 points of the bar, so a second batch ran: 75.1%. No single run of the ten reached 80% (73.2% to 78.4%).

**Batches.** `npm run probe:help -- --runs 5` twice, with `BASELINE_NO_WATCH=1`. Default cloud endpoint, model `default`. Each batch: 125 questions × 2 arms (retrieval, no-docs) × 5 runs = 1,250 answers, 0 failed. Batch 1 ran at 773f369a (1,401 s). Batch 2 ran at 46ecbcc8 (1,140 s). The only help-side change between them is two `docs/Changelog.md` lines. No changelog section reaches a bar answer (ticket 37). No key changed: `help-baseline-cases.json` and the scorer are unchanged since ticket 37. Raw answers (not tracked): `testing/baseline/runs/help-baseline-2026-10-02T20-51-29-638Z.json` and `…T21-11-08-982Z.json`.

**The bar, next to tickets 26 and 37.** One scorer for every column. A scratch script runs the harness's `scoreAnswer` over the retrieval rows of the three bar kinds and counts to one decimal. From ticket 37's raw file it gives 51.3%, as ticket 37 reported. `npm run probe:help -- --rescore <file> --kinds task,here,followUp` gives the same rates, rounded.

| Kind | Answers per batch | Ticket 26 | Ticket 37 | Ticket 46, batch 1 | Ticket 46, batch 2 | Ticket 46, both |
|---|---|---|---|---|---|---|
| Task | 375 | 46.1% | 49.3% | 71.7% | 71.7% | 71.7% |
| Here | 60 | 50.0% | 85.0% | 100% | 95.0% | 97.5% |
| Follow-up | 50 | 34.0% | 26.0% | 78.0% | 76.0% | 77.0% |
| **Bar (all three)** | 485 | **45.4%** | **51.3%** | **75.9%** | **75.1%** | **75.5%** |

- The bar needs 776 of the 970 answers. The two batches have 732, so 44 short: about five questions that now fail every run.
- Outside the bar, batch 1 / batch 2: language with the setting 95% / 100%, asked in the language 75% / 80%, changelog 100% / 100%, not covered 10% / 8% missed flags.
- Retrieval arm, all 625 answers, batch 1 / batch 2: right source 86% / 86%, false flag 4% / 5%, invented name 12% / 9%. Cost per question: 2 requests, about 6,070 tokens in, about 200 out.
- No-docs control: keys met 1% in both batches, so the keys still cannot be guessed.
- Ticket 47's retrieval arm, scored the same way, gives about 73% on the bar. This run agrees within drift. By ticket 49's ruling, ticket 49 changes the blocks of no case in this set.

**The search still decides most failures, but much less than in ticket 37.**

| A keyed section | Ticket 46, both batches | Grounded-correct | Ticket 37 |
|---|---|---|---|
| reached the model | 813 of 970 (84%) | 90% | 290 of 485 (60%), 86% |
| did not reach the model | 157 of 970 (16%) | 0% | 195 of 485 (40%), 0% |

- 238 answers failed: 157 with no keyed section, 81 with one.
- Of the 157, 14 met the keys from a section the key does not list. 9 of these are `memory-2` (see the worst list).
- Of the 81, 79 missed a keyed fact and 22 held a forbidden name.
- 37 bar questions have a failed run; 18 have no correct run. 14 of the 18 never got a keyed section in any of the 10 runs (ticket 37: 39 of 42).
- None of the 14 got a keyed section in 10 runs, so more runs will not fix them.

**Recall, shipped defaults (keyword + AI picks, semantic off).** Ticket 39's probe, same endpoint: `npm run probe:help-recall -- --ai --arms keyword,shipped --runs 5` with no screen, and `--runs 3 --screen <screen>` for each screen. 0 failed pick requests and 0 failed first answers in every run. Raw rows (not tracked): `help-recall-2026-10-02T20-36-38-524Z` (no screen), `…T20-41-58-411Z` (library), `…T20-47-13-526Z` (stats), `…T20-51-42-192Z` (game).

| Asked over | Runs | Set | Keyword: task @5 | Shipped: recall@5 | Shipped: task @5 | Ticket 49: task @5 |
|---|---|---|---|---|---|---|
| No screen | 5 | Known | 68.0% | 82.9% | 79.5% | 78.9% (ticket 47) |
| No screen | 5 | **Blind** | 73.8% | **87.9%** | 87.6% | 86.7% (ticket 47) |
| Main Menu, Worlds tab | 3 | Known | 64.0% | 73.9% | 68.4% | 66.7% |
| Main Menu, Worlds tab | 3 | Blind | 67.9% | 81.2% | 80.2% | 77.4% |
| World Editor, Stats tab | 3 | Known | 64.0% | 66.3% | 60.9% | 56.0% |
| World Editor, Stats tab | 3 | Blind | 67.9% | 70.9% | 69.0% | 68.7% |
| Game screen, Memory tab | 3 | Known | 64.0% | 70.4% | 64.0% | 64.4% |
| Game screen, Memory tab | 3 | Blind | 67.9% | 71.6% | 70.2% | 71.8% |

- Blind-set recall@5 for the shipped defaults is 87.9%. Ticket 39 measured 84% (Q71).
- "Here" recall@5 is 100% on every screen. Follow-up recall@5 with no screen: 88.0% known, 90.0% blind.
- Over an open screen, task recall@5 is still 7–19 points under the no-screen numbers.
- Follow-up recall@5 over a screen is 66.7–83.3% known and 83.3–90.0% blind, against 88.0% and 90.0% with no screen. Not part of the bar.
- Over the Stats tab, the shipped arm is under the keyword search on the known set (60.9% vs 64.0%), as in tickets 47 and 49.

**Worst questions.** Over both batches, by fewest correct runs, then by cause. Row 8 holds a question and its follow-up, so the table names 11. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `follow-backup-restore`: "and how do I load that on the new machine?" after a backup | 0/10 | Gave the **Load Game** › **Import** steps for one save. Never named **Backup & Restore** | Model error. The keyed section was first in all 10 runs. The answer used the save-import section on the same page |
| 2 | `saves-and-backup-2`: "my friend sent me their game progress file" | 0/10 | Gave both the save and the world import steps and asked which one. Names **Import World**, which the key forbids | Model error. The keyed section is sent. The answer also uses `Library#how-to-import-a-world`, on another page |
| 3 | `glossary-1`: "is there a list explaining the terms people use while playing?" | 0/10 | Said the **Glossary** has them and listed no term | Model error. `Glossary#-playing` was sent in all 10 runs |
| 4 | `statcodeguide-3`: make hunger rise every turn with a script | 0/10 | Copied the **Drain Per Hour** example. Never gave the **Advanced** › **Test Code** steps | Model error. The keyed how-to is sent. The answer used `StatCodeGuide#examples`, sent too. Ticket 37 had this as a search miss |
| 5 | `library-2`: "make its box bigger" on the main screen | 0/10 | Flagged in 10 of 10. Talked about thumbnails | Search miss. No Library section in any run. "box" never reaches **Tile Size** |
| 6 | `personas-1`: "I always play the same guy, can I make him get picked automatically?" | 0/10 | Gave the starting-trait steps | Search miss. No Personas section in any run |
| 7 | `statcodeguide-2`: can my script check the time of day | 0/10 | Flagged in 10 of 10 | Search miss inside the right page. Five StatCodeGuide how-tos are sent, never `the-story-clock` |
| 8 | `follow-default-make`: "how do I create another one first?" after `personas-1` | 0/10 | Gave trait or connection steps | Search miss. No Personas section in any run. The first question misses too |
| 9 | `memory-2`: turn off summaries and recall | 0/10 | Met the keys in 9 of 10 | Key gap. The answers come from `Memory#turning-memory-off`, which the key does not list in `otherSections`. I did not change the key |
| 10 | `formaquestion-1`: drag the help popup aside and shrink it | 1/10 | Gave the steps to move the **Help** tab | Model error. The keyed section is second and the Help tab how-to is first. Ticket 37 #5 had the same answer as a search miss. Now the keyed section is sent in 10 of 10 |
| 11 | `world-editor-entities-2`: Robert is called Bob, make the AI know both | 1/10 | Named the **Aliases** field in 10 of 10, **Advanced** mode in 1 | Model error. A missing step, not a wrong one |

The other never-sourced questions, all search misses: `memory-1` ("drop an old event" → Entities remove-a-cast-member), `entities-2` (own character into another world → Linked Copies), `prompts-1` (cheaper model for summaries → Memory settings), `tools-2` ("function calling" → desktop engine, flagged 10/10), `world-editor-placeholders-2`, `persona-authoring-2` (gets **Persona** chip, not **Player Name**), `worldformat-2`, `world-editor-openings-4`, `worldformat-3` (JSON question → the World Editor trait how-to).

**For the spec session.** The 80% bar fails by 4.5 points. The 238 failed answers split into four groups:

| Group | Questions | Failed answers |
|---|---|---|
| Search misses: no keyed section in any run | 13 | 130 |
| Model errors: keyed section sent, no correct run or one | 6 | 58 |
| Key gap: `memory-2` | 1 | 10 |
| Questions with 4 to 9 correct runs | 17 | 40 |

- **Search misses.** Five of the 13 reach the right page but not the right section (`memory-1`, `prompts-1`, `persona-authoring-2`, `statcodeguide-2`, `world-editor-openings-4`). Of the other eight, `worldformat-2` reaches the page in 3 of 10 runs and seven never do.
- **Model errors.** In four of the six, another section sent with the keyed one is the one the answer uses: a how-to on the same page (`follow-backup-restore`, `formaquestion-1`), the examples section (`statcodeguide-3`), or a how-to on another page (`saves-and-backup-2`). `glossary-1` points at the Glossary and lists nothing. `world-editor-entities-2` leaves out **Advanced**.
- **Key gap.** Adding `Memory#turning-memory-off` to the `otherSections` of `memory-2` is a key change, so it needs a ruling. Alone it adds about 1 point.

Fixing about five questions of the first two groups reaches the bar. Semantic search is built and off (Q71). It was not measured here because the ticket names the shipped defaults.

**Review** (`/mattpocock-skills:code-review 773f369a`, this ticket's commit only). Both reviewers recounted the numbers from the raw rows and found them right. Folded in:

- The 14 never-sourced questions do not get the same sections every run. Only 4 do. The claim is now that none of them got a keyed section in 10 runs.
- `memory-2` was in two groups. The groups are now one split of the 238 failed answers.
- The model-error causes name the section each answer used. Two of them are not on the keyed page.
- The worst table is in order of correct runs and says it names 11 questions.
- The scorer, the full recall commands, and follow-up recall over a screen are stated.
- Wording: shorter sentences, no "won", "hedges" or "inherits".

Left as is:

- `home-1` scores 10 of 10 with steps for running the app from source. Its keys are loose. A change needs a ruling, like `memory-2`.

**Gates.** Not run. This ticket changed only this file and ran the existing harnesses. No code changed, as in ticket 37.
