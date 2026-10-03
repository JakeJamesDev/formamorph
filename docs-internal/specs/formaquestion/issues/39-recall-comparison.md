# 39: Search recall comparison

Status: done
Status note: The numbers and a recommendation are in the Handover. The user picks the approach (Q67).
Base: 62ef56e0
Blocked by: 38, 41, 42
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The user gets numbers to pick how the search reaches a section from the player's own words (Q67). In ticket 37, the right section reached the model for 60% of answers. The 80% bar needs about 93%, because answers are 86% correct when the section arrives. Player words often do not appear in the section: "folder" means Group, "go back three moves" means rewind. This ticket measures. It changes no shipped behavior.

**A fresh blind question set.** Ticket 26's 125 questions are now known, so a fix tuned on them proves nothing.

- Write at least 60 new English task and follow-up questions in player words, covering every guide page.
- Write each one from the page and section headings only, before reading the section text, as ticket 26 did.
- Key each question to its right sections only. Recall needs no answer facts.
- Keep the set apart from ticket 26's set. No approach may be tuned on it.

**Approaches.** Measure each on both sets:

| Approach | What it is | How to measure |
|---|---|---|
| Keyword search (control) | The shipped search, after tickets 38, 41 and 42 | Offline |
| Semantic search | Rank sections by meaning with the shipped semantic-memory embedder: section vectors built at build time, the question embedded on the device | Offline |
| Hybrid | Keyword and semantic ranks merged | Offline |
| AI picks sections | A first request sends the section headings and asks which sections answer the question; the app sends those sections | Default cloud model, 5 runs |
| Bigger word map | Authored keyword lines (Q47) grown with player synonyms, written without reading either question set | Offline |

**Report.** A table per approach and set:

- right section in the top 5 (recall@5), and right section first
- added latency, and added tokens per question
- the download size and memory cost, for any approach that needs a model on the device
- whether it works on every endpoint, and with no network

Then recommend one approach, or a mix. The user picks. Write no product ticket here.

Recommended model rationale: the blind set and a fair comparison decide whether the numbers mean anything.

## Acceptance criteria

- [x] A blind set of at least 60 questions covers every guide page, each written from headings only and keyed to its right sections
- [x] Every approach is measured on both sets with the same recall scorer, and the cloud one has 5 runs
- [x] The report table holds recall@5, top-1, latency, tokens, download size and endpoint reach per approach
- [x] No shipped behavior changes, and no approach was tuned on the blind set
- [x] A recommendation is in the handover, and the status moves to `ready-for-human` for the user's pick

## Handover

**Result: no approach reaches 93%.** The best single approach finds the right section for 72% of the blind questions. The best mix finds it for 87%. The shipped keyword search finds it for 52%.

**Built.** `npm run probe:help-recall -- --ai --runs 5` scores every approach on both sets. It changes no shipped code.

| File | What it is |
|---|---|
| `testing/baseline/help-recall-blind-cases.json` | The blind set: 84 task questions and 10 follow-ups, 2 or more for each of the 33 guide pages |
| `testing/baseline/help-word-map.json` | The bigger word map: 3,529 phrases on 466 sections. Only the probe reads it |
| `testing/baseline/harness/help-recall.cli.ts` | The probe: the approaches, the cloud requests, the report |
| `testing/baseline/harness/help-recall-score.ts` | The recall score, the rank merge, the pick reader, the chunker, the keyword-line injector |
| `testing/baseline/harness/help-recall-cases.ts` | Reads both sets |
| `help-recall-score.test.ts`, `help-recall-cases.test.ts` | 34 tests. The second runs the blind set against the real docs |

**How each approach is scored.** Every approach goes through the shipped block builder, `helpSections`, with its own search in place of the keyword search. The open screen's section, the follow-up rule and the 12,000-character budget are the same for all.

- **Recall@5:** a keyed section is among the five sections of the block, with no size budget.
- **First:** a keyed section is the first section of the block.
- **Sent:** a keyed section is in the block that fits the budget. This is the "right source" of tickets 26 and 37.

**Batch.** 2026-10-02, at 62ef56e0 plus this ticket's files. Default cloud endpoint, model `default`. 191 questions × 5 runs = 955 pick requests in 210 s, 0 failed. 12 replies copied no line of the list; they score as misses. The offline approaches give the same result on every run. Raw rows: `testing/baseline/runs/help-recall-2026-10-02T16-21-29-398Z.json` (not tracked).

**Blind set, 94 questions.** "One key" counts only the first keyed section of each question; see the note on keys below.

| Approach | Recall@5 | One key @5 | First | Sent | Task @5 | Follow-up @5 |
|---|---|---|---|---|---|---|
| Keyword (control) | 52.1% | 47.9% | 36.2% | 52.1% | 51.2% | 60% |
| Bigger word map | 72.3% | 67.0% | 41.5% | 71.3% | 75.0% | 50% |
| Semantic | 63.8% | 57.4% | 40.4% | 63.8% | 65.5% | 50% |
| Hybrid (keyword + semantic) | 68.1% | 63.8% | 45.7% | 68.1% | 67.9% | 70% |
| AI picks, 5 runs | 70.9% (70.2–71.3) | 67.9% | 42.3% | 70.9% | 71.0% | 70% |
| Mix: word map + semantic | 73.4% | 70.2% | 53.2% | 73.4% | 73.8% | 70% |
| Mix: AI picks + word map | 84.0% (83.0–85.1) | 81.5% | 60.2% | 84.0% | 85.7% | 70% |
| Mix: AI picks + word map + semantic | **87.2%** (86.2–88.3) | 84.0% | 66.0% | 87.2% | 89.3% | 70% |

**Known set, 97 questions** (ticket 26's English task, "here" and follow-up questions).

| Approach | Recall@5 | First | Sent | Task @5 | Here @5 | Follow-up @5 |
|---|---|---|---|---|---|---|
| Keyword (control) | 63.9% | 35.1% | 62.9% | 60.0% | 100% | 50% |
| Bigger word map | 71.1% | 35.1% | 71.1% | 69.3% | 100% | 50% |
| Semantic | 68.0% | 37.1% | 68.0% | 64.0% | 91.7% | 70% |
| Hybrid (keyword + semantic) | 72.2% | 45.4% | 72.2% | 68.0% | 100% | 70% |
| AI picks, 5 runs | 66.4% (64.9–67.0) | 44.5% | 66.4% | 61.9% | 100% | 60% |
| Mix: word map + semantic | 78.4% | 47.4% | 78.4% | 76.0% | 100% | 70% |
| Mix: AI picks + word map | 78.6% (78.4–79.4) | 46.2% | 78.6% | 77.6% | 100% | 60% |
| Mix: AI picks + word map + semantic | **81.9%** (81.4–82.5) | 50.5% | 81.9% | 81.9% | 100% | 60% |

- The control's 62.9% sent on the known set agrees with ticket 37's 60% plus tickets 38, 41 and 42.
- The keyword search scores 12 points lower on the blind set, and 16 lower with one key. Tickets 27 to 42 fixed the known questions, so the known set flatters it.
- **Keys.** A blind question has 1.76 keyed sections on average; a known one has 1.01. Approach against approach inside a set is fair. Blind against known, or blind against the 93% need, is not like for like: use the "One key" column for that.
- A mix merges the rankings by reciprocal rank fusion, with the constant of the method's paper (60). No number of it was tuned.

**Cost of each approach.**

| Approach | Added time per question | Added tokens | Download and memory | Every endpoint | No network |
|---|---|---|---|---|---|
| Keyword | 0.5 ms | 0 | None | Yes | Yes |
| Bigger word map | 0.5 ms | 0 | None. 51 KB of hidden keyword lines in the docs | Yes | Yes |
| Semantic, hybrid | 3 ms to embed, in Node | 0 | 22.6 MB model, once (`Xenova/all-MiniLM-L6-v2` q8: 21.9 MB weights, 0.7 MB tokenizer). +73 MB resident in Node. 738 KB of section vectors in the build | Yes | Yes after the download. Semantic Memory is off by default, so most players do not have the model |
| AI picks | 844 ms mean, 1,252 ms at the 90th percentile, on the cloud | 4,454 in, 42 out | None | Yes. It is one plain chat request, with no function call | Only with a local model |

- The embed time is from the Node runtime. **UNVERIFIED — not measured on the app's single-thread WASM worker**, which is slower.
- The pick request holds 491 heading lines. The cloud model's window is 10,750 tokens, so it fits. On a local model the time depends on prompt speed; I did not measure one.

**What still misses.** On the blind set, 8 of 94 questions are found by no approach and no mix in any run, so the ceiling of what was measured is 91%. I read the 12 questions the best mix misses in 3 or more of 5 runs:

- **Follow-ups with a pronoun** (3 of the 10 follow-ups): "and how do I send it back to them after I change it?". Every approach stays at 50–70% on follow-ups.
- **A player word with two meanings**: "something I made a long time ago" goes to saves, not to world file versions. "a file of the setting they made" goes to Import a Save.
- **A term question**: "what do you mean by a 'listing'?" goes to the listing how-tos, not to the glossary.
- **Two possible docs gaps**, from the key check: no section says what a new player does first after an install (`Home#-getting-started` is the run-from-source setup), and `World-Editor-Locations#delete-a-location` names no control.

**What this means for the bar (Q59).** Answers were 86% correct when the section arrived (ticket 37). At that rate the best mix gives about 0.87 × 0.86 = 75% on the blind set and 0.82 × 0.86 = 70% on the known set. The 80% bar needs more than search: the 86% must rise too, or the bar moves.

**Recommendation: the word map first, then AI picks on top.**

1. **Grow the keyword lines.** It gives the largest gain of any single approach (+20 points on the blind set) at no cost at runtime, on every endpoint and offline. The cost is authoring: the map needs a review by a person before it goes into the docs, and each new section needs its line.
2. **Add the AI pick request, fused with the keyword ranking.** It adds 11.7 points on the blind set (72.3% → 84.0%) and 7.5 on the known set, for one request of about 4,500 tokens and 0.85 s.
3. **Leave semantic search out for now.** On top of the two it adds about 3 points on each set for a 22.6 MB download that most players do not have. Look again if Semantic Memory becomes on by default.
4. **Follow-ups need their own fix.** No approach here moves them.

The user picks. No product ticket is written here.

**How the comparison stayed fair.**

- **Blind set.** I wrote each question from the heading list alone (`index.contents()`, ids and labels), before any section text. Before that I had seen the ticket 26 questions that tickets 26 and 37 quote, and a cut-off print of its "here" and follow-up entries. A test fails when a blind question repeats a known one.
- **Keys.** I keyed from the headings. A second agent then read the section text and proposed 74 key changes. I applied the 34 it marked sure (28 added sections, 6 removed) and none of the 40 it marked unsure. This was fixed before the first blind measurement.
- **Word map.** Three agents wrote it from the guide pages alone. Their brief forbade `testing/`, `docs-internal/` and any search run. No person has reviewed the phrases.
- **Choices made on the known set only.** Semantic section text: heading alone 62.9%, heading and body 63.9%, body chunks 55.7%; heading and body is used. Those three ran before the emoji came off the heading lines; with that change, heading and body scores the 68.0% of the table. The model reads the first 512 tokens of a text, so a long section is embedded by its start. AI pick reply: numbers of a numbered list 52.6% (1 run), copied heading lines 64.9% (1 run); copied lines are used.
- **One choice made after the first blind result.** The first full run had the five approaches of this ticket. I then added the three mixes, because the ticket asks for "one approach, or a mix". The merge rule has no tuned number.
- **The score floor of ticket 41** applies to the keyword and word map arms alone. The semantic, AI and mix arms have no score it fits, so their blocks always hold five sections.
- **Semantic and the favored page.** A follow-up's first hit favors the earlier answer's page. The semantic arm doubles the similarity there, as the keyword search doubles its score.
- **The word map changes one split.** A keyword line counts toward a section's size, so `World-Editor-Traits#links` splits into parts in the word map index: 495 sections against 492.
- **Fixed after the review.** A mix first merged 50 sections of each ranking, and the "here" rule asks for every hit of the open page. That cost the hybrid and the word map + semantic mix one "here" question (91.7%). The mixes now pass the full depth, and the batch above is the rerun.

**Tests.** `help-recall-score.ts` and `help-recall-cases.ts`: 100% lines, 96.9% branches at the first commit; the review then added `chunksOf` with its tests. 13 mutations of the scorer each turned the expected test red. The probe script itself has no unit test; its block builder is the shipped `helpSections`.

**Gates.** typecheck exit 0 (19 s), lint exit 0 (18 s), test exit 0 (16,411 passed, 125 s), build exit 0 (20 s).

**Seen, not fixed.**

- `testing/` is outside the `tsconfig.json` include, so `npm run typecheck` does not check a probe harness. I checked the new files with a scratch config.
- Every `vite-node` probe that loads the bundled docs takes about 27 s to start on this machine.
