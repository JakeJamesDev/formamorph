# 27: Search in player words

Status: in-progress
Base: 9a010b82
Blocked by: 15, 20
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player who asks in their own words gets the right docs section (Q47). Ticket 20's probe found that keyword search found the right section for 8 of 8 questions in the guide's words, but 2 of 8 in a player's words ("back up everything before I reinstall", "redo the last turn", "make a folder"). With the right section, the answers were correct. The search is the weak part.

This fixes the search for every path that uses it: the no-AI docs search (Q7), retrieval mode on models with no tool support (Q10), and the nearest sections under a flagged answer (Q15).

**Authored keywords.** Each "How to…" section gets one hidden line of player phrasings: the words a player uses for that task that the section's text does not. Use an HTML comment, so the wiki and the in-app reader do not show it. The Docs Index reads the line and ranks a keyword match like a heading match. Write the keywords from player language: synonyms, the old names of renamed controls, and common verbs ("undo", "redo", "folder", "reinstall"). Do not repeat words already in the heading.

**Stemming.** The index matches word forms ("folders", "folder"; "backing", "back up"). Use a small rule set or a vetted library; confirm the package from its registry before you install it.

**A check.** The ticket 01 docs checks gain one rule: every "How to…" section has a keyword line. Prove it bites.

**Numbers.** Extend ticket 20's help probe with a player-wording question set: at least one player-worded question for each docs page, written without looking at the section text. Report the right-section hit rate for guide wording and for player wording, before and after, in the same batch. The search runs without a model, so these numbers are exact and need no in-batch control. Also report the answer-level effect on the default cloud model with ticket 20's harness.

Recommended model rationale: a pass over every docs page plus a ranking change whose effect must be measured, not judged.

## Acceptance criteria

- [x] Every "How to…" section has a hidden keyword line; the wiki and the reader do not show it
- [x] The Docs Index ranks a keyword-line match like a heading match; a test proves it
- [x] Stemming matches singular and plural and common verb forms; a test proves it
- [x] The docs checks fail on a how-to section with no keyword line, proven to bite
- [x] The player-wording question set covers every docs page
- [x] Right-section hit rates for guide and player wording, before and after, are in the handover
- [x] Answer-level numbers on the default cloud model are in the handover
- [x] The guide-wording hit rate does not drop
- [x] Four gates green

## Handover

**Built.** A player who asks in their own words now gets the right docs section about half the time on a blind set, up from 1 in 7.

- 🏷️ Every "How to…" section (168 on 31 pages: 167 from this ticket, 1 from ticket 25) has one hidden `<!-- keywords: … -->` line under its heading: synonyms, old control names and common verbs. The index removes the line from the section text, so the in-app reader and the model never see it; the wiki hides HTML comments.
- ⚖️ A keyword-line term counts as a heading term (`docsIndex.ts`). The index reads no keyword line inside a code fence.
- 🌱 Stemming uses `stemmer` 2.0.1 (Porter, MIT, no dependencies, `words/stemmer` on npm). It replaces the plural-only rule. A hyphenated word also gives its joined form, so "re-generate" finds "regenerate". The package lands in the lazy docs chunk.
- ✅ `keywordLineProblems` fails a guide-page "How to…" heading whose next non-blank line is not a keyword line with a word in it.
- 🧪 Each guard was proven to bite by putting the bug back: keyword terms out of the heading set (3 tests red), keyword line kept in the text (3), no stemming (2), the check never reporting (1), one docs page losing a keyword line (2).

**Question set.** `testing/baseline/help-retrieval-cases.json`: 66 player-worded questions, 2 for each of the 33 docs pages. A subagent wrote them from the section headings only, with no access to the section text. I wrote the keyword lines without reading the questions, and changed no keyword line to fit them after. Four keyword lines changed after the first run, and only to stop them stealing guide-worded questions from other sections.

**Search numbers** (`help-retrieval-probe.cli.ts --before 9a010b82`, no model, exact). "Sent" is the ticket 20 measure: the right section is among the sections retrieval mode puts in the prompt.

| Question set | Index | Sent | Top 1 | Top 3 |
|---|---|---|---|---|
| Guide wording, every "How to…" heading (168) | before | 167 (99%) | 161 (96%) | 167 (99%) |
| | after | **168 (100%)** | 162 (96%) | 168 (100%) |
| Player wording, blind set (66) | before | 9 (14%) | 6 (9%) | 8 (12%) |
| | after | **32 (48%)** | 20 (30%) | 31 (47%) |
| Ticket 20 guide wording (8) | before | 8 | 8 | 8 |
| | after | 8 | 8 | 8 |
| Ticket 20 player wording (8) | before | 2 | 1 | 2 |
| | after | 8 | 6 | 8 |

The ticket 20 player questions were known while the keywords were written, so the blind set is the honest number.

**Answer numbers** (`help-probe.cli.ts --runs 6 --before 9a010b82`, cloud default endpoint, 21 cases × 3 arms × 6 runs, one batch of 378 requests, 0 failed). The `before` arm is the same request with the base commit's search.

| Cases | Arm | Facts | Complete | Declined | Flagged |
|---|---|---|---|---|---|
| Covered, guide wording (48) | after | 100% | 100% | 0% | 0% |
| | before | 100% | 100% | 0% | 0% |
| Covered, player wording (48) | after | **83%** | **75%** | 13% | 13% |
| | before | 37% | 25% | 10% | 25% |
| Not covered (30) | after | – | – | 60% | 100% |
| | before | – | – | 47% | 100% |
| Covered (96) | no-docs control | 13% | 7% | 0% | 100% |

**Findings, not fixed here:**

- 📜 13 of the 34 blind misses rank a released changelog section first. Long changelog sections match many words of a long question, and the coverage factor rewards that. A ranking fix belongs with ticket 26 or 28.
- 📁 With the right section sent, the model still declines "make a folder" 6 of 6 times: the section says Group and never says folder, and the keyword line is hidden from the model. A docs line such as "A Group is a folder of tiles" would fix the answer; that is a docs content call.
- ⏱️ `vite-node` start-up took 25–90 s per probe run on this machine today, while other sessions ran their suites.

**Gates:** typecheck 0 (20 s), lint 0 (18 s, 4 warnings in files this ticket does not touch), test 0 (16,094 passed, 125 s wall, exits at once), build 0 (19 s). The harness files typecheck clean under a scratch config with Node types; the root config does not include `testing/`.
