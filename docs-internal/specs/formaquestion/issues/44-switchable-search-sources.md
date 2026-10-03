# 44: Switchable search sources

Status: done
Status note: Built and measured. Answers rise from 61% to 73% grounded-correct, and "here" questions fall from 98% to 82%. Four points in the Handover need a ruling.
Base: 199c2b26
Blocked by: 39
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A help question's sections come from up to three search sources, merged into one ranking (Q71). Each source has its own on/off constant. A later Formaquestion settings page will flip them, so nothing built here is removed later. Ticket 39 measured AI picks plus the word map at 84% blind recall@5.

**Sources.**

| Source | What it does | Default |
|---|---|---|
| Keyword | The shipped search with its keyword lines (ticket 43) | On |
| AI picks | One plain chat request before the answer: the section headings and the question, and the model names the sections that answer it. No function call, so it works on every endpoint | On |
| Semantic | Ranks sections by meaning with the shipped semantic-memory embedder. Section vectors are built with the app; the question is embedded on the device | Off |

- One named constant per source in the help session. Like lookup mode (Q53), none is a player setting yet, and none is in a preset or an export.
- The merge is reciprocal rank fusion with the method's standard constant (60), as ticket 39 measured. No number is tuned.
- The merged ranking feeds the existing docs block: the open screen's section, the follow-up rule, the floor, the budget and the cap still apply.
- AI picks:
  - pin its temperature and penalty explicitly, and send reasoning off
  - read only lines the model copies from the list; a reply with no usable line leaves the other sources' ranking alone
  - a failed pick request sends the question with the other sources' ranking; the answer request is never sent twice (ADR-0008)
- Semantic:
  - when the embedding model is not on the device, the source is skipped; it never starts a download
  - the build checks that the section vectors match the embedder's model
- The Search tab stays keyword-only.
- The request's sources still name the sections that reached the model.

**Probe.** Run ticket 39's recall probe on both sets for the shipped defaults, and ticket 26's harness on all kinds, default cloud model, 5 runs, with the current build as the in-batch control. Report recall, grounded-correct per kind, added time and tokens per question.

Recommended model rationale: three sources, one merge, and failure paths that must never send a request twice.

## Acceptance criteria

- [x] Each source switches by its own constant; tests cover every on/off mix
- [x] With the defaults, a question makes one pick request, then one answer request; a test asserts it
- [x] A failed or unusable pick still answers from the other sources, with no second answer request; a test asserts it
- [x] Semantic on with no model on the device is skipped and starts no download; a test asserts it
- [x] Probe numbers for recall and grounded-correct, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

**Result: the shipped switches answer 73% of the fixed set grounded-correct, against 61% for the keyword search alone. The bar (Q59, 80%) is not met. "Here" questions fall from 98% to 82%.**

**Built.**

| File | What it is |
|---|---|
| `src/lib/formaquestion/helpSession.ts` | The three switches (`HELP_KEYWORD_SOURCE`, `HELP_AI_PICKS_SOURCE`, `HELP_SEMANTIC_SOURCE`), `helpSearch` (the sources of one question, merged) and the merge |
| `src/lib/formaquestion/helpPicks.ts` | The pick prompt, the pick list, the reply reader and the pick request |
| `src/lib/formaquestion/helpSemantic.ts`, `sectionVectors.ts` | The semantic ranking, the vectors file format and its drift rule |
| `src/lib/formaquestion/sectionVectors.json` | 492 section vectors, 1.0 MB. A lazy chunk of its own in the build (1,043 kB, 764 kB gzip); it loads only when Semantic runs |
| `src/lib/formaquestion/rankMerge.ts`, `guideSections.ts` | The rank fusion and vector ranking (moved from ticket 39's probe), and the guide's heading lines |
| `src/lib/embeddingWorkerClient.ts` | `openCachedEmbeddingModel`: opens the model only when its four files are in the browser cache |
| `scripts/buildHelpVectors.ts` | `npm run build:help-vectors`. It embeds only the sections whose text changed (13 s for one section, 35 s for all) |
| `src/lib/docs/docsIndex.ts` | `whatsNew(query)` on the Docs Index: the release sections a what's-new question leads with |

**How it behaves.**

- A question sends one pick request, then one answer request. The pick request is the `help` kind: temperature 0.2, repetition penalty 1, reasoning off, 150 tokens.
- A failed pick, an empty reply, a reply that copies no line, or a reply cut in its reasoning gives no picks. The question then runs on the other sources. Neither request goes out twice.
- The keyword search alone keeps its score floor. A merged ranking has none (Q73).
- A what's-new question keeps its release sections first with any mix of sources. Other changelog matches stay under every guide section.
- Stop during the pick request, or while the semantic source opens its model, ends the question with no answer request.
- Semantic: a section whose text changed since the vectors were built is left out of that ranking. A vectors file from another model gives no ranking.

**Recall probe.** 2026-10-02, at e45b4191 plus this ticket, default cloud endpoint, model `default` (root `/home/fiery/gemma_deploy/model`, a 10,750-token window). `npm run probe:help-recall -- --ai --arms keyword,ai+keyword,shipped --runs 5`: 191 questions × 5 runs for each AI arm, 0 failed requests, 10 replies with no line of the list. Raw rows: `testing/baseline/runs/help-recall-2026-10-02T17-16-09-580Z.json` (not tracked).

| Set | Approach | Recall@5 | First | Sent | Task @5 | Here @5 | Follow-up @5 | Added time | Added tokens |
|---|---|---|---|---|---|---|---|---|---|
| Blind (94) | Keyword | 71.3% | 41.5% | 70.2% | 73.8% | n/a | 50.0% | 1 ms | 0 |
| Blind (94) | AI picks + keyword, ticket 39's arm | 84.5% (84.0–85.1) | 58.9% | 84.5% | 85.7% | n/a | 74.0% | 761 ms | 4,493 |
| Blind (94) | **Shipped switches** | **84.7%** (84.0–85.1) | 57.7% | 84.7% | 86.4% | n/a | 70.0% | 738 ms | 4,493 |
| Known (97) | Keyword | 69.1% | 33.0% | 69.1% | 68.0% | 100% | 40.0% | 1 ms | 0 |
| Known (97) | AI picks + keyword, ticket 39's arm | 81.4% (80.4–82.5) | 48.0% | 81.4% | 79.5% | 100% | 74.0% | 751 ms | 4,498 |
| Known (97) | **Shipped switches** | **81.6%** (79.4–82.5) | 48.2% | 81.6% | 79.5% | 100% | 76.0% | 787 ms | 4,498 |

- The shipped number agrees with ticket 39's 84.0% for the same mix. The `shipped` arm runs the app's own `helpSearch`; the other AI arm is the probe's own merge.
- The semantic source is off in every arm above, as it ships.
- This run was before the review fixes. They change only what's-new questions and the keyword-off mixes, and neither set has one.

**Answer probe.** Ticket 26's harness, all kinds, same endpoint, 5 runs, 625 answers for each arm, 0 failed. `retrieval` is the shipped switches; `keyword-only` is the build before this ticket, in the same batch. It ran as three batches (1, 2 and 2 runs: a background command here must end inside 10 minutes), each with both arms next to each other in time, merged with `--rescore`. Raw rows: `testing/baseline/runs/help-baseline-2026-10-02-ticket44-merged.json` (not tracked).

| Kind | Answers | Shipped: grounded-correct | Keyword-only: grounded-correct | Shipped: right source | Keyword-only: right source |
|---|---|---|---|---|---|
| Task | 375 | **72%** | 60% | 81% | 68% |
| Here | 60 | **82%** | 98% | 100% | 100% |
| Follow-up | 50 | **44%** | 32% | 64% | 40% |
| Language, setting only | 40 | **95%** | 100% | 100% | 100% |
| Language, asked in it | 40 | **78%** | 0% | 93% | 0% |
| Changelog | 10 | **100%** | 100% | 100% | 100% |
| **All** | 625 | **73%** | 61% | 84% | 67% |

| Cost of one question | Requests | Tokens in | Tokens out | Time | Sections sent |
|---|---|---|---|---|---|
| Shipped switches | 2.00 | 6,043 | 198 | 4.90 s | 4.81 |
| Keyword-only | 1.00 | 1,683 | 148 | 3.61 s | 4.07 |
| **Added** | +1 | +4,360 | +50 | +1.29 s | +0.74 |

- False flags fall from 11% to 5%. Wrong answers with no flag fall from 27% to 20%. Missed flags on uncovered questions stay at 10%.
- A question asked in another language went from 0% to 78%: the keyword search finds no English section from non-English words, and the model's picks do.
- Batches 1 and 2 ran the first commit. Batch 3 ran with the review fixes, which change only what's-new questions with no guide hit, and the keyword-off mixes. The changelog kind scores 100% in both arms.

**The "here" regression (the Q69 risk).** Three of the 12 "here" questions account for the fall: `here-make-tool` (20% with the shipped switches), `here-memory-tab` (20%) and `here-ai-context` (40%). The open screen's section still leads, so the right source is 100%. The picks add sections that look like an answer:

- "what am I looking at here?" on the AI Context inspector: keyword-only sends the one screen section. The picks add `Test-Bench#ai-context` and a glossary section.
- "what is this panel showing me?" on the Memory tab: the picks add `How-to-Play#the-side-panel-tabs` and `How-to-Play#the-game-screen`.
- "how do I make a new one here?" on Tools: both arms send nearly the same five sections in another order, and the answer comes from the Prompts how-to.

This needs a ruling, not a fix inside this ticket. One option: send no pick request when a screen section leads and the question's own keyword search finds nothing above the floor.

**Rulings needed.**

1. **The "here" regression** above: ship as measured, or add a rule for questions asked over an open screen.
2. **The floor after a pick that gives nothing.** Q73 says the floor applies "only when keyword is the one source on". With AI picks on and a failed or empty pick, the build uses the keyword search with its floor, as if the source were off. Ticket 39 measured that case with no floor (12 of 955 replies). Confirm or reverse.
3. **A runtime download the cache check does not cover.** The embedding worker gets the ONNX runtime binary from `cdn.jsdelivr.net` (transformers.js 3.8.1 sets `wasmPaths` there, and nothing in `src` overrides it). It is in the browser's HTTP cache, not in the model cache, so a help question with Semantic on can fetch it again. Semantic Memory has the same fetch today. The model files themselves never download. UNVERIFIED at run time: traced in the library source, not observed in a browser. The fix is to bundle the runtime binary with the app.
4. **Run `npm run build:help-vectors` before each release.** A docs edit leaves the edited section out of the semantic ranking until the script runs. The release skill is the user's file, so this ticket did not edit it.

**Seen, not fixed.**

- **Reasoning models that do not honor reasoning off.** One live question on LM Studio (MeroMero 31B, already loaded) spent the 150-token pick cap and then the 800-token answer cap on reasoning text, with no content. The pick fell back as built; the empty answer is the existing help request. On such an endpoint the pick request adds wait time and gives nothing.
- **Local models.** The pick request holds about 4,500 tokens. A local model with a smaller window fails it and falls back. A slow local model adds the time to read 4,500 tokens to every question. Not measured.
- **The package grows by 1.0 MB** for the vectors of a source that ships off.
- Eight guide sections gave the same pick line as another section (`World Editor › Stats` and `World Editor: Stats`). The reader now takes an exact copy first, so each is reachable. Ticket 39's reader always took the first.
- transformers.js has no cache-only load in a browser (`local_files_only` throws there), so the build checks the cache, then loads. A test runs the real loader against a recording cache and fails when the key format or the file list changes.

**Tests.** 7 new test files; 351 tests in the help modules pass. Coverage: `helpSession.ts`, `helpPicks.ts`, `helpSemantic.ts`, `sectionVectors.ts`, `rankMerge.ts` and `guideSections.ts` are at 100% of lines (92.6% to 100% of branches). `embeddingWorkerClient.ts` is at 61.8%; its new functions are covered, and the rest is the download-progress and dispose code from before. 30 mutations each turned the expected test red, and each restore was checked: the switches, the pick failure catch, both Stop paths, the floor rule, the merge depth, the changelog and what's-new rules, the on-device check, the drift and model checks, the cache key format.

**Not covered by a test.**

- The semantic source with the real model in a real browser: the worker load from the cache, the embed call and the lazy load of the vectors file. The tests stop at the `Worker` boundary and at a stand-in embedder.
- The existing help tests answer the pick request with a reply that picks nothing (`src/test/helpFixtures.ts`), so they run on the keyword search. The merge, each source and each failure path have their own tests in `helpSession.sources.test.ts`.

**Gates.** typecheck exit 0 (22 s), lint exit 0 (21 s, 2 warnings in files this ticket does not touch), test exit 0 (16,496 passed, 3 skipped, 122 s), build exit 0 (23 s). `testing/` and `scripts/` are outside `tsconfig.json`, so the probe files and the script were checked with a scratch config: exit 0.
