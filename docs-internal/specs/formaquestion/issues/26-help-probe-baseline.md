# 26: Help probe baseline

Status: in-progress
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

**Built.** `npm run probe:help` runs a fixed set of 123 questions through the help session and through a no-docs control, and prints the report. No bar is set. The numbers below are the baseline for the user's ruling.

| File | What it is |
|---|---|
| `testing/baseline/help-baseline-cases.json` | The fixed set. It replaces `help-retrieval-cases.json`: ticket 27's 66 blind questions are its first 66 `cases`, with keys added |
| `testing/baseline/harness/help-baseline.cli.ts` | The harness: arms, requests, report, `--lookup`, `--rescore FILE` |
| `testing/baseline/harness/help-baseline-score.ts` | The score, by text match only |
| `testing/baseline/harness/help-baseline-cases.ts` | Reads the set |
| `help-baseline-score.test.ts`, `help-baseline-cases.test.ts` | 26 tests. The second runs the set against the real docs |

**The set.**

| Kind | Questions | Notes |
|---|---|---|
| Task | 75 | 2 or more for each of the 33 guide pages. 66 from ticket 27, 9 new so each page with how-to sections has a how-to question |
| Here | 12 | 6 ask what the open tab or dialog is. 6 ask "how do I add one here?" |
| Follow-up | 10 | Each runs after a task question, with that run's answer as the history |
| Language | 16 | 4 tasks × Spanish and Japanese × two forms: English question with the setting, and the question written in the language |
| Not covered | 10 | Features the app does not have, general AI terms, and off-topic questions |

- Every new question was written from the section headings only, before the section text was read. The search numbers stay honest.
- 97 questions have keyed facts, and 26 of them have forbidden names. A forbidden name is the control of another task, or a name the app does not have.
- The released changelog is in the index, but the set has no question on it: its text changes with each release.
- One key changed after the run: `here-output-tab` wanted two section names, and the model's summary of the tab was correct without them. The key now also takes the summary's own words. No other key changed.
- One weak key: `world-editor-openings-1` has the single fact "Weight", and the control produced it in 4 of 5 runs.

**Batch.** Default cloud endpoint, model `default`, 123 questions × 2 arms × 5 runs = 1,230 answers in 1,122 s, 0 failed. Raw answers: `testing/baseline/runs/help-baseline-2026-10-01T22-58-58-584Z.json` (not tracked).

Retrieval arm, the mode that ships:

| Questions | Answers | Grounded-correct | Wrong step | Invented name | False flag | Wrong, no flag | Right source | Missed flag | In language | Tokens in / out |
|---|---|---|---|---|---|---|---|---|---|---|
| Task | 375 | 48% | 0% | 10% | 12% | 40% | 48% | – | – | 2427 / 157 |
| Here | 60 | 52% | 8% | 10% | 0% | 48% | 58% | – | – | 1913 / 130 |
| Follow-up | 50 | 38% | 20% | 14% | 8% | 54% | 40% | – | – | 2403 / 190 |
| Language, setting only | 40 | 93% | 0% | 0% | 0% | 8% | 100% | – | 100% | 2520 / 164 |
| Language, asked in it | 40 | 0% | 0% | 45% | 100% | 0% | 0% | – | 100% | 547 / 77 |
| Not covered | 50 | – | – | – | – | – | – | 0% | – | 1680 / 73 |
| **All** | 615 | 47% | 3% | 12% | 16% | 37% | 49% | 0% | 100% | 2198 / 146 |

No-docs control, same batch:

| Questions | Answers | Keys met | Invented name | In language | Tokens in / out |
|---|---|---|---|---|---|
| Task | 375 | 3% | 54% | – | 124 / 124 |
| Here | 60 | 2% | 22% | – | 127 / 79 |
| Follow-up | 50 | 0% | 62% | – | 273 / 129 |
| Language | 80 | 0% | 79% | 100% | 158 / 133 |
| **All** | 615 | 2% | 55% | 100% | 140 / 118 |

How to read the columns:

- **Grounded-correct:** every keyed fact, no forbidden name, no general-knowledge flag.
- **Wrong step:** the answer holds a forbidden name.
- **Wrong, no flag:** the answer is not grounded-correct and carries no flag, so nothing warns the player.
- **False flag / Missed flag:** a covered question with the flag, and an uncovered question without it.
- **Keys met** on the control: the share of questions a model answers right with no guide. It is 2%, so the keys cannot be guessed.

**The main finding: the search decides the answer.**

| The right section | Questions | Grounded-correct | Flagged | Wrong step |
|---|---|---|---|---|
| reached the model | 47 of 97 | 91% | 0% | 1% |
| did not reach the model | 50 of 97 | 5% | 19% | 6% |

(The 97 are the English task, here and follow-up questions.) With the right section, the model answers well and never flags. Without it, the model flags 1 answer in 5 and answers from the wrong sections in most of the rest. The flag itself works: 0 of 50 uncovered answers missed it.

**Ten worst questions.** 64 questions have a failed run: 56 search misses, 8 model errors, 0 docs gaps. A docs gap only shows when the right section reaches the model, so the count can rise after a search fix. I read the answers of each row.

| # | Question | Correct | What the answer did | Cause |
|---|---|---|---|---|
| 1 | `here-add-location`: "how do I make a new one here?" on World Editor → Locations | 0 / 5 | Gave the steps to make a prompt preset | Search miss. The hint section is the page intro, not the how-to, and the question has no keyword |
| 2 | `follow-tool-try`: "how do I test it?" after making a Tool | 0 / 5 | Led with the Test Bench opening preview | Search miss. "test" found the Test Bench |
| 3 | `follow-require-count`: "and can I cap how many of those they take?" | 0 / 5 | Gave **Limit Active Characters** in Settings | Search miss |
| 4 | `here-add-stat`: "How do I add one here?" on World Editor → Stats | 0 / 5 | Gave the steps for **Help for This Screen** | Search miss. Same as row 1, and the word "here" finds the Formaquestion page |
| 5 | `here-ai-context`: "what am I looking at here?" in the AI Context dialog | 0 / 5 | Named the inspector, then gave the **Help for This Screen** steps | Model error. The right section was first, and a search hit on "here" drew the model away |
| 6 | `here-download-world`: "how do I get one of these onto my computer?" | 0 / 5 | Two vague steps, never **Download World** | Search miss. The hint section is Browsing |
| 7 | `entities-2`: add a library entity to a game | 0 / 5 | Described library traits and character cards | Search miss. Changelog sections ranked first |
| 8 | `follow-default-make`: "how do I create another one first?" | 0 / 5 | Gave the steps to make a Group | Search miss. "create" found the Group how-to |
| 9 | `formaquestion-1`: move and shrink the help window | 0 / 5 | Described the Help tab | Search miss. The sibling section won |
| 10 | `image-generation-1`: an image after every turn | 0 / 5 | Said no such feature exists | Search miss |

One more class is outside the ten: all 8 questions written in Spanish or Japanese scored 0 of 40. The keyword search finds nothing for a question that is not in English, so every answer is flagged general knowledge. The AI Language directive itself works: 100% of answers are in the language, and with an English question 93% are grounded-correct.

**Not run.** The lookup arm. The cloud endpoint still rejects function calls (HTTP 400, checked today), so that arm needs a local model. A Cydonia window needs the user's agreement; none was started.

**Possible follow-up tickets, once the bar is set.** All come from the worst list. None is written yet.

1. "Here" task questions: use the Surface's page for the search, or send the page's how-to sections with the hint.
2. Rank guide sections above released changelog sections.
3. Follow-ups with a generic verb ("test", "create", "cap"): weight the previous topic's page.
4. Questions in another language: search with a translated or English form of the question.
5. Search hits on filler words ("here", "this") that pull the Formaquestion page in.

**Tests.** Each guard was proven to bite: 11 breaks of the set (a page with one keyed question, a missing section, a fact the section does not hold, a forbidden name it does hold, an unknown surface, and more) and 18 bugs put into the score, one at a time. Each turned a test red.
