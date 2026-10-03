# 26: Help probe baseline

Status: done
Status note: The baseline is in the Handover. The user sets the pass bar from it (Q24). The lookup arm runs on Cydonia later, in a window the user names (asked 2026-10-01). Follow-up tickets come after the bar.
Base: fefcbc20
Blocked by: 13, 22, 23, 24, 27, 28, 29, 30, 31
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The user gets real numbers on how well Formaquestion answers, and sets the pass bar from them (Q24). This ticket sets no bar.

**Question set.** A fixed set, kept in the repo beside the other probe harnesses:

- at least two task questions for each docs page, in a player's words, not the page's words
- "here" questions that depend on the Surface
- follow-up pairs
- questions the docs do not cover, to measure the flag
- questions in another language, to measure the AI Language directive

Each question has keyed facts: the control names and steps a correct answer must contain, and facts it must not contain. Scoring is objective: keyed facts present, forbidden facts absent, sources include the right section, flag correct. No model judges the answers.

**Runs.**

- The default cloud model, 5 to 12 runs per arm, every batch with its own in-batch control (the same model with no docs).
- Arms: retrieval mode, lookup mode where the model supports it.
- A local arm on Cydonia only if the user agrees to a window. Ask; do not start one.
- Requests replicate the app's sampler pins and send reasoning off.

**Report.** A table per arm: grounded-correct rate, wrong-step rate, flag errors in both directions, source accuracy, tokens per question. List the ten worst questions with the cause of each: a docs gap, a search miss, or a model error.

Then the user sets the bar. Record it as a ruling in the spec. If the numbers are under the bar, write the follow-up tickets (docs fixes, search fixes or prompt changes) from the worst-question list; do not tune the prompt in this ticket.

Recommended model rationale: the question set and the scoring keys decide whether the numbers mean anything.

## Acceptance criteria

- [x] The question set covers every docs page with at least two task questions, with keyed facts for each
- [x] The harness scores from keyed facts and sources only, and runs with one command
- [x] Every batch has an in-batch no-docs control
- [x] The report table and the ten worst questions with causes are handed to the user
- [ ] No pass bar is invented; the user's bar is recorded in the spec as a ruling
- [ ] Follow-up tickets exist for the gaps under the bar, or the handover says none are needed
- [x] Status moves to `ready-for-human` for the user's ruling

## Handover

**Built.** `npm run probe:help` runs a fixed set of 125 questions through the help session and through a no-docs control, and prints the report. No bar is set. The numbers below are the baseline for the user's ruling.

| File | What it is |
|---|---|
| `testing/baseline/help-baseline-cases.json` | The fixed set. It replaces `help-retrieval-cases.json`: ticket 27's 66 blind questions are its first 66 `cases`, with keys added |
| `testing/baseline/harness/help-baseline.cli.ts` | The harness: arms, requests, report, `--lookup`, `--rescore FILE` |
| `testing/baseline/harness/help-baseline-score.ts` | The score, by text match only |
| `testing/baseline/harness/help-baseline-cases.ts` | Reads the set |
| `help-baseline-score.test.ts`, `help-baseline-cases.test.ts` | 40 tests. The second runs the set against the real docs |

**The set.**

| Kind | Questions | Notes |
|---|---|---|
| Task | 75 | 2 or more for each of the 33 guide pages (Q57). 66 from ticket 27, 9 new so each page with how-to sections has a how-to question |
| Here | 12 | 6 ask what the open tab or dialog is. 6 ask "how do I add one here?" |
| Follow-up | 10 | Each runs after a task question, with that run's answer as the history |
| Language | 16 | 4 tasks × Spanish and Japanese × two forms: English question with the setting, and the question written in the language |
| Changelog | 2 | "What's new" questions, scored on source and flag only (Q57) |
| Not covered | 10 | Features the app does not have, general AI terms, and off-topic questions |

- Every new question was written from the section headings only, before the section text was read. The search numbers stay honest.
- 97 questions have keyed facts, and 26 of them have forbidden names. A forbidden name is the control of another task, or a name the app does not have.
- The keys were fixed before the final batch, and no key changed after it. After a first batch and the review, 11 keys changed: `here-output-tab` and `tools-2` were too strict; `follow-backup-restore`, `memory-1` and `world-editor-entities-3` held one name inside another; `prompts-2`, `world-editor-openings-2`, `world-editor-placeholders-2`, `worldformat-2` and `textformatting-2` were too loose; `world-editor-locations-1` lists a second section that holds the same steps.
- Weak keys that stay: `world-editor-openings-1` has the single fact "Weight", and the control produced it in 5 of 5 runs. `home-1` asks for "Settings" and "endpoint" only, because its section says little more.
- A text match has no grammar: "do not use **Export save**" counts as a wrong step. I read every wrong-step answer in the first batch; none was a negation.

**Scoring (Q58).** An answer is grounded-correct when it holds every keyed fact, holds no forbidden name, a keyed section is among its sources, and it has no general-knowledge flag. An answer that meets the keys from other sections shows in its own column.

**Final batch.** Default cloud endpoint, model `default`, 125 questions × 2 arms × 5 runs = 1,250 answers in 1,149 s, 0 failed. Raw answers: `testing/baseline/runs/help-baseline-2026-10-01T23-46-41-467Z.json` (not tracked).

Retrieval arm, the mode that ships:

| Questions | Answers | Grounded-correct | Correct, other source | Wrong step | Invented name | False flag | Wrong, no flag | Right source | Missed flag | In language | Tokens in / out |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Task | 375 | 46% | 2% | 0% | 11% | 13% | 39% | 49% | – | – | 2411 / 154 |
| Here | 60 | 50% | 3% | 8% | 0% | 0% | 47% | 58% | – | – | 1913 / 136 |
| Follow-up | 50 | 34% | 2% | 24% | 12% | 10% | 54% | 40% | – | – | 2400 / 192 |
| Language, setting only | 40 | 88% | 0% | 0% | 0% | 0% | 13% | 100% | – | 100% | 2520 / 163 |
| Language, asked in it | 40 | 0% | 0% | 0% | 48% | 100% | 0% | 0% | – | 100% | 547 / 74 |
| Changelog | 10 | 0% | – | 0% | 0% | 0% | – | 0% | – | – | 1528 / 85 |
| Not covered | 50 | – | – | – | 0% | – | – | – | 0% | – | 1680 / 77 |
| **All** | 625 | 44% | 2% | 3% | 11% | 16% | 36% | 49% | 0% | 100% | 2177 / 144 |

No-docs control, same batch:

| Questions | Answers | Keys met | Invented name | In language | Tokens in / out |
|---|---|---|---|---|---|
| Task | 375 | 2% | 56% | – | 124 / 125 |
| Here | 60 | 0% | 28% | – | 127 / 85 |
| Follow-up | 50 | 0% | 76% | – | 267 / 129 |
| Language | 80 | 0% | 79% | 100% | 158 / 144 |
| Changelog | 10 | – | 90% | – | 115 / 101 |
| Not covered | 50 | – | 48% | – | 115 / 98 |
| **All** | 625 | 1% | 58% | 100% | 139 / 121 |

How to read the columns:

- **Wrong step:** the answer holds a forbidden name.
- **Invented name:** the answer holds a bold name that is nowhere in the docs.
- **Wrong, no flag:** the answer misses its keys and carries no flag, so nothing warns the player.
- **False flag / Missed flag:** a covered question with the flag, and an uncovered question without it.
- **Keys met** on the control: the share of questions a model answers right with no guide. It is 1%, so the keys cannot be guessed.

**Batch-to-batch drift.** A first batch of 123 of these questions (all but the two changelog ones) ran 48 minutes earlier. Under the same final rules it scores 46% grounded-correct overall; the final batch scores 45% on those questions. Per kind the two batches differ by 0 to 5 points (follow-up 38% and 34%, language setting 93% and 88%). A bar closer than about 5 points to a kind's number is inside the noise at 5 runs.

**The main finding: the search decides the answer.**

| A keyed section | Questions | Grounded-correct | Flagged | Wrong step |
|---|---|---|---|---|
| reached the model | 48 of 99 | 92% | 1% | 1% |
| did not reach the model | 51 of 99 | 0%, by the Q58 rule (4% meet the keys from another section) | 20% | 6% |

(The 99 are the English task, here, follow-up and changelog questions.) With the right section, the model answers well. Without it, the model flags 1 answer in 5 and answers from the wrong sections in most of the rest. The flag itself works on uncovered questions: 0 of 50 answers missed it.

**Ten worst questions.** 67 questions have a failed run. First cause: 59 search misses, 7 model errors, 1 docs gap by the rule (it is a model error; see below). A docs gap only shows when the right section reaches the model, so the count can rise after a search fix. 41 questions have no correct run, so the order inside the ten is: wrong steps first, then answers with no flag. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `follow-require-count`: "and can I cap how many of those they take?" after a trait requirement | 0 / 5 | Gave **Limit Active Characters** in Settings | Search miss |
| 2 | `here-add-location`: "how do I make a new one here?" on World Editor → Locations | 0 / 5 | Gave the steps to make a prompt preset | Search miss. The hint section is the page intro, not the how-to, and the question has no keyword |
| 3 | `follow-tool-try`: "how do I test it?" after making a Tool | 0 / 5 | Led with the Test Bench opening preview | Search miss. "test" found the Test Bench |
| 4 | `avatars-2`: change the Profile Image | 0 / 5 | Described Morph art from the changelog | Search miss. Changelog sections ranked first |
| 5 | `changelog-1`, `changelog-2`: what is new | 0 / 10 | Told the player to open **What's new**, from the Saves and Backup page | Search miss. No changelog section was sent. The answer is useful, but it is not the changelog |
| 6 | `entities-2`: add a library entity to a game | 0 / 5 | Quoted changelog lines, with developer names such as `bindCarriedBlueprints` | Search miss. Changelog sections ranked first |
| 7 | `follow-default-make`: "how do I create another one first?" | 0 / 5 | Gave the steps to make a Group | Search miss. "create" found the Group how-to |
| 8 | `follow-rewind-edit`: "what if I only want to change what I typed instead?" | 0 / 5 | Explained the Measured Clock | Search miss |
| 9 | `formaquestion-1`: move and shrink the help window | 0 / 5 | Described the Help tab | Search miss. The sibling section won |
| 10 | `here-ai-context`: "what am I looking at here?" in the AI Context dialog | 0 / 5 | Named the inspector, then gave the **Help for This Screen** steps | Model error. The right section was first, and a search hit on "here" drew the model away |

Three more findings outside the ten:

- **Other languages.** All 8 questions written in Spanish or Japanese scored 0 of 40. The keyword search finds nothing for a question that is not in English, so every answer is flagged general knowledge. The AI Language directive itself works: 100% of answers are in the language, and with an English question 88% are grounded-correct.
- **"Here" task questions.** "How do I add one here?" failed on 5 of 6 surfaces. The surface maps to the page intro, and the how-to section is not sent.
- **Leaked reasoning.** 2 of 625 answers held the model's thinking text in front of the answer, both on `formaquestion-2`. The marker inside that text also set the flag, which is the 1 "docs gap" above.

**Not run.** The lookup arm. The cloud endpoint still rejects function calls (HTTP 400, checked today), so that arm needs a local model. `--lookup` is built from the same request framing as ticket 22's probe, but UNVERIFIED: it has not run. A Cydonia window needs the user's agreement; none was started.

**Possible follow-up tickets, once the bar is set.** All come from the worst list. None is written yet.

1. "Here" task questions: use the Surface's page for the search, or send the page's how-to sections with the hint. Ticket 32 changes the same docs block and reruns these cases.
2. Rank guide sections above released changelog sections, and still find the changelog for "what's new".
3. Follow-ups with a generic verb ("test", "create", "cap"): weight the previous topic's page.
4. Questions in another language: search with an English form of the question.
5. Search hits on filler words ("here", "this") that pull the Formaquestion page in.

**Review fold-in.** Spec: Q57 and Q58 came from this review and are applied; the loose and strict keys above are fixed; the final batch reran everything, so no number here comes from a key fitted to its own answers. Standards: a name inside another keyed name no longer counts twice, and a test rejects such a key; invented names use the whole-word rule and count on every answer; the language check no longer reads "a" as English and refuses a language it does not know; `--rescore` scores only the questions a batch was run for; the harness types its report rows. Kept: the harness copies the snapshot, pool and control prompt from the older help probes, as each of them does. Ticket 33 moves these to one module, and this harness is a fifth user of it.

**Tests.** Each guard was proven to bite: 17 breaks of the set and 35 bugs put into the score, one at a time. Each turned a test red.

**Gates** (final tree): typecheck 0 (18 s), lint 0 (19 s, 2 warnings in files this ticket does not touch), test 0 (16,227 passed, 119 s wall, exits at once), build 0 (20 s). The harness files typecheck clean under a scratch config with Node types; the root config does not include `testing/`.
