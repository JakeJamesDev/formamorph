# 37: Help baseline against the bar

Status: done
Base: 6c238e4a
Blocked by: 32, 34, 35, 36
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The user learns whether Formaquestion meets the 80% bar (Q59). Run ticket 26's full harness on the build with tickets 32, 34, 35 and 36.

- Default cloud model, 125 questions, both arms, 5 runs, the same keys as ticket 26. Change no key.
- The bar: 80% grounded-correct over the English task, "here" and follow-up questions together. Report each kind too.
- A result inside 5 points of the bar gets a second batch before any verdict, because batches drift by about that much.
- Under the bar: list the worst questions with causes, as ticket 26 did, and hand them to the spec session for follow-up tickets. Do not tune the prompt here.
- Questions in another language stay out of the bar (Q61).

Recommended model rationale: the verdict and the cause list decide what comes next.

## Acceptance criteria

- [x] One full batch on the default cloud model with no key changed, and a second batch if the result is within 5 points of 80%
- [x] The report states pass or fail against the bar, with per-kind numbers next to ticket 26's
- [x] On a fail, the worst questions and their causes are in the handover
- [x] Status moves to `ready-for-human`

## Handover

**Verdict: fail.** 51.3% grounded-correct against the 80% bar (Q59). The result is 29 points under the bar, far outside the 5-point drift, so no second batch ran.

**Batch.** `npm run probe:help -- --runs 5` at 6c238e4a, which holds tickets 32, 34, 35 and 36. Default cloud endpoint, model `default`. 125 questions × 2 arms × 5 runs = 1,250 answers in 953 s, 0 failed. No key changed: `help-baseline-cases.json` is unchanged since ticket 26's fold-in (fdeb43ae). Raw answers: `testing/baseline/runs/help-baseline-2026-10-02T12-39-04-518Z.json` (not tracked).

Ticket 33 (52282cf6) landed during the run. It changes the harness and three search files. The batch ran on 6c238e4a's code:

- `git status -- src testing` was empty just before the start.
- The harness and the search modules have no dynamic imports, so every module loaded at the start.

**The bar, next to ticket 26.** I rescored ticket 26's final batch with the same keys. Both columns use one scorer.

| Kind | Answers | Ticket 26 | Ticket 37 | Change |
|---|---|---|---|---|
| Task | 375 | 46.1% | 49.3% | +3.2 |
| Here | 60 | 50.0% | 85.0% | +35.0 |
| Follow-up | 50 | 34.0% | 26.0% | −8.0 |
| **Bar (all three)** | 485 | **45.4%** | **51.3%** | +5.9 |

- The 5 runs score 49.5% to 53.6%. The verdict does not depend on one run.
- Outside the bar (Q61): language with the setting 83% (ticket 26: 88%), asked in the language 0%, changelog 100% (0%), not covered 0% missed flags.
- Retrieval arm, all 625 answers, ticket 26 in brackets. These include the questions outside the bar.

  | Right source | Wrong step | False flag | Wrong, no flag | Invented name | Tokens in |
  |---|---|---|---|---|---|
  | 59% (49%) | 1% (3%) | 18% (16%) | 29% (36%) | 11% (11%) | 1,928 (2,177) |
- No-docs control: keys met 2%, so the keys still cannot be guessed.

**What the four tickets did.**

| Ticket | Effect in this batch |
|---|---|
| 32, "here" searches the surface's page | The 5 failing "how do I add one here?" questions went from 0/5 to 4 or 5 of 5. The sixth, `here-import-world`, was 5/5 in both. "Here" right source is 100% |
| 34, guide above the changelog | Changelog questions 0/10 → 10/10. `avatars-2` 0/5 → 5/5. No changelog section reached any of the 485 bar answers |
| 35, follow-ups weight the earlier page | `follow-tool-try` 0/5 → 4/5. The follow-up kind still fell, see below |
| 36, filler words | `here-ai-context` 0/5 → 5/5 |

**The main finding: the search still decides the answer.**

| A keyed section | Answers | Grounded-correct | Ticket 26 |
|---|---|---|---|
| reached the model | 290 of 485 (60%) | 86% | 240 of 485, 92% |
| did not reach the model | 195 of 485 (40%) | 0% | 245 of 485, 0% |

- 195 of the 236 failed answers are search misses.
- 42 of the 97 bar questions have no correct run. 39 of those 42 never got a keyed section in any run.
- At 86% when the section arrives, the bar needs a keyed section in about 93% of answers. The search sends one in 60%.

**First causes.** 54 bar questions have a failed run. By the harness rule: 39 search misses, 14 model errors, 1 docs gap. The docs gap is `follow-publish-update`; I read it as a model error (see below). Over all 125 questions the harness counts 64: 47 search misses, 16 model errors, 1 docs gap.

**Why the search misses.** I read the questions and what the search sent. The player's words do not appear in the section's words, so the keyword search ranks other sections first:

- "put my worlds together in a folder" needs **Group**. "make its box bigger" needs tile size. "go back three moves" needs rewind. "a cheaper model handle the summaries" needs routing.
- Two broad sections take many result slots. `Glossary#️-building-a-world` reached 13 bar questions and `Settings#output` reached 11. Each was nearly always a wrong section.
- Follow-ups with a generic verb ("create", "cap", "get it back") still go to the wrong page. Ticket 35 helps only when the first answer found the right page.

**Regressions with the right section sent.** The rate when the section arrives fell from 92% to 86%. Six questions dropped while a keyed section still reached the model:

| Question | Ticket 26 → 37 | What the answer did |
|---|---|---|
| `follow-publish-update` | 5/5 → 0/5 | Gave the update steps, but set the flag in all 5 runs. Three extra sections now reach it (Glossary, World Editor, App Updates) |
| `here-backup-dialog`: "what does this window do?" | 5/5 → 0/5 | Described the Formaquestion window. `Formaquestion#the-window` was second in both batches |
| `here-memory-tab` | 5/5 → 2/5 | Named the tab and the filter chips, but not the pin and forget controls |
| `linkedcontent-1` | 5/5 → 2/5 | Missed **Apply Updates** |
| `worldeditor-1` | 5/5 → 3/5 | Missed **Replace all** |
| `follow-group-add` | 4/5 → 2/5 | Missed **Add To Group** |

- `here-backup-dialog` and `here-memory-tab` got almost the same sections in both batches. Model drift is a likely cause there, but it is not proven. In `here-backup-dialog`, the word "window" also brings in the Formaquestion page, which the model then describes.
- Six questions at 5 runs can move this much from noise alone.
- The follow-up kind lost 4 answers net. A follow-up ticket should check these rows again.
- `follow-require-count` also changed. In ticket 26, 5 of 5 answers named **Limit Active Characters**. Now 4 of 5 do, and 4 of 5 give the Group's **At Least** limit.

**Ten worst questions.** By the harness's order: fewest correct runs, then wrong steps, then no flag. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `follow-require-count`: "and can I cap how many of those they take?" | 0/5 | Gave the Group's **At Least** limits; 4 of 5 named **Limit Active Characters** | Search miss. "cap" found the Settings section |
| 2 | `entities-2`: put my own character into someone else's world | 0/5 | Explained what an Entity is, with no steps | Search miss. The Library group how-to ranked first |
| 3 | `follow-default-make`: "how do I create another one first?" after a default persona | 0/5 | Gave the steps to make a Group | Search miss. Same as ticket 26 #7 |
| 4 | `follow-forget-undo`: "I removed the wrong one, can I get it back?" after forgetting a memory | 0/5 | Talked about removing a cast member, or gave the rewind steps | Search miss. "removed" found the Entities page |
| 5 | `formaquestion-1`: drag the help popup aside and shrink it | 0/5 | Described the **Help** tab, or said the guide does not cover it, with no flag | Search miss. The sibling section won, as in ticket 26 #9 |
| 6 | `here-backup-dialog`: "what does this window do?" on Backup & Restore | 0/5 | Described the Formaquestion window | Model error. The right section was first. The search also sent the Formaquestion page, which the answer described |
| 7 | `image-generation-1`: draw a picture after every move | 0/5 | Gave the one-turn **Generate Scene Image** steps | Search miss. The one-turn section outranked the scene-images setting |
| 8 | `linkedcontent-2`: something my world was connected to can't be found | 0/5 | Talked about location **Connections** | Search miss. "connected" found the Locations page |
| 9 | `personas-2`: switch who I play as mid-story | 0/5 | Said the guide has no steps, with no flag | Search miss. Answers like this one also miss the flag |
| 10 | `statcodeguide-3`: make hunger rise every turn with a script | 0/5 | Gave a stat-code example from the examples page, not the how-to steps | Search miss. The examples and reading-this-turn sections ranked first |

**For the spec session.** Four of ticket 26's five follow-ups are done (32, 34, 35, 36). The fifth, other languages, waits under Q61. Each of the four fixed the questions it named.

The remaining gap is broad. 39 questions got no keyed section in any run, and they are spread over most pages. A fix for each question one at a time will not reach 93% source accuracy. The follow-up tickets need a decision on how the search finds a section from player words. Options for the spec session:

- a semantic search over the sections
- a map from player words to the section's terms
- the lookup arm on a model that takes function calls. On 2026-10-02 the cloud endpoint still returned HTTP 400 for function calls (ticket 33 checked)

Smaller items: rank the two broad sections lower, and set the flag when an answer says the guide does not cover the question.

**Gates.** Not run. This ticket changed only this file and ran the existing harness. No code changed.
