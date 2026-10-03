# 22: Docs lookup function

Status: done
Status note: Built and probed on MeroMero. Three decisions wait for the user: whether lookup mode stays, how many hits its prompt holds, and the contents list. The test gate needs one clean run after the stat-code-entities sessions commit.
Base: 15319e49
Blocked by: 20 — Ask a question
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

On an endpoint and model known to support function calls, the AI chooses which docs sections to read. The answer is better on questions where keyword search picks the wrong section, and a follow-up can fetch a new section.

- **Lookup mode.** The request offers one docs lookup function. The prompt carries the contents list (pages and section headings). The model calls the function with section ids, or with search words, and gets the section text back. It can call more than once, within a call limit and the existing round cap.
- **Mode choice.** The session picks lookup mode or retrieval mode before the request, from the endpoint's known capability. It uses the same capability gate as Tools. It never sends a second request because the first failed (ADR-0008).
- **Not a Tool (Q30).** The docs lookup is outside the Tool catalog. It never shows in the Tools tab, no preset enables it, and the Output → Tools switch does not affect it. It runs through the existing tool loop with its own executor.
- **Sources.** The sections the function returned are the answer's sources.
- **Bad calls.** An unknown section id returns a short result that lists valid ids near it. A model that calls nothing still gets an answer path: the prompt carries the section mapped to the question's best search hit.

**Records.** Write a new ADR, on the next free number: the docs lookup is an app-internal function call, capability-gated, outside the Tool catalog. Add three terms to the internal glossary: Formaquestion, Docs Index, Surface.

Report probe numbers for lookup mode against retrieval mode, same questions, same batch. If lookup mode is not better on the default cloud model, say so; the user decides whether it stays.

Recommended model rationale: a function-call loop with model-dependent behavior and an ADR boundary to hold.

## Acceptance criteria

- [x] On a capable endpoint, the request offers the lookup function and the contents list, and the fetched sections become the sources
- [x] On an endpoint with no function-call support, the request offers no function and uses retrieval mode
- [x] In both modes, a failed request is not sent again
- [x] The lookup function is absent from the Tools tab, and the Output → Tools switch does not change the request; tests assert both
- [x] An unknown section id gets a helpful result and the answer still completes
- [x] The call limit and the round cap hold; a test drives a model that calls without end
- [x] The new ADR exists and the three glossary terms are added
- [x] Probe numbers for lookup against retrieval, same batch, are in the handover
- [ ] Four gates green (three are; the test gate is red only in other sessions' files, see Gates)

## Comments

**Built.** On an endpoint known to take function calls, the AI picks the docs sections it reads.

| File | Role |
|---|---|
| `src/lib/formaquestion/docsLookup.ts` | The function `read_guide`, its executor, the contents list. No Tool type, no handler |
| `src/lib/formaquestion/helpSession.ts` | `askHelp` picks lookup or retrieval mode before the request, from `toolsSupported` |
| `src/lib/formaquestion/helpPrompt.ts` | The lookup prompt and its user message. The answer rules are shared with the retrieval prompt |
| `src/lib/aiRequest/aiRequestSpec.ts`, `toolLoop.ts`, `src/lib/tools/toolSchema.ts` | `OfferedFunction`: the request layer and the loop take any offered function. No behavior change |
| `docs/adr/0009-docs-lookup-is-an-app-internal-function.md`, `CONTEXT.md` | The ADR, and the terms Formaquestion, Docs Index, Surface |
| `testing/baseline/harness/help-probe.cli.ts` | `--lookup` adds an arm that runs the app's own help session in lookup mode |

**Rulings from the spec session (2026-10-01).** Both are in the spec.

- Every section that reached the model is a source: fetched sections first, in fetch order, then the prompt's sections, no duplicates.
- No Tools setting affects the lookup. Its call limit is its own constant; the round cap is the loop's default.

**Picks made here.**

- 🔢 Call limit: 3 lookups per question (`DOCS_LOOKUP_CALL_LIMIT`). A question sends at most 5 requests, under the loop's cap of 6, so the limit binds first.
- 📏 The fetched text shares the 12,000-character docs budget with the section in the prompt. A section that does not fit is named in the result. The parts of a split section arrive from the first part or not at all.
- 📑 The contents list holds each page name and one `#anchor` line per section, not the heading text. The anchor has the heading's words, and a second column of headings doubles the list. The list is about 11,700 characters, about 3,900 tokens on MeroMero.
- 🤝 The function reads an id written loosely: other letter case, `Page: Heading`, a section name alone when one page has it, a page name alone, a list. Small models write ids this way.
- 🧹 The text a model writes before a call is dropped from the answer, as the tool loop does for Tools.

**The default cloud endpoint cannot run lookup mode.** It answers every `tool_choice` form (absent, `auto`, `required`, named) with HTTP 400: the server runs without a tool-call parser. Its capability record says no, so it gets retrieval mode with no failed request. The numbers below are from a local model.

**Probe numbers.** MeroMero v2 31B (`g4-meromero-v2-31b-i1`, Q4_K_M, LM Studio, context 8,192), 18 questions, 3 runs per arm, one batch of 162 question runs, the app's pins, 0 failed. Arms: retrieval mode, lookup mode, and the no-docs control.

| Questions | Arm | n | Keyed names | All names | Numbered steps | Declined | Invented names | Right section reached | Tokens in / out | Requests |
|---|---|---|---|---|---|---|---|---|---|---|
| Covered, all | retrieval | 48 | 70% | 63% | 75% | 25% | 0.00 | 63% | 1,696 / 96 | 1.0 |
| | lookup | 48 | 89% | 81% | 96% | 10% | 0.00 | 81% | 7,842 / 135 | 1.4 |
| | no docs | 48 | 13% | 2% | 100% | 0% | 1.00 | – | 104 / 81 | 1.0 |
| Covered, guide's words | retrieval | 24 | 100% | 100% | 100% | 0% | 0.00 | 100% | 1,416 / 122 | 1.0 |
| | lookup | 24 | 100% | 100% | 100% | 0% | 0.00 | 100% | 4,923 / 133 | 1.0 |
| Covered, player's words | retrieval | 24 | 40% | 25% | 50% | 50% | 0.00 | 25% | 1,976 / 69 | 1.0 |
| | lookup | 24 | 77% | 63% | 92% | 21% | 0.00 | 63% | 10,760 / 136 | 1.9 |
| Search missed the section | retrieval | 18 | 19% | 0% | 33% | 67% | 0.00 | 0% | 1,913 / 35 | 1.0 |
| | lookup | 18 | 78% | 67% | 89% | 28% | 0.00 | 67% | 12,573 / 130 | 2.2 |
| Search found the section | retrieval | 30 | 100% | 100% | 100% | 0% | 0.00 | 100% | 1,566 / 132 | 1.0 |
| | lookup | 30 | 95% | 90% | 100% | 0% | 0.00 | 90% | 5,003 / 138 | 1.0 |
| Not covered | retrieval | 6 | – | – | 0% | 100% | 0.00 | – | 1,428 / 9 | 1.0 |
| | lookup | 6 | – | – | 0% | 100% | 0.00 | – | 10,669 / 32 | 2.0 |

- ✅ **Lookup mode is better where keyword search fails.** In a player's words, complete answers go from 25% to 63%. Where the search missed the section, they go from 0% to 67%.
- 💸 **It costs 4.6 times the tokens in**, and 1.4 requests per question. A question with one call puts about 5,400 tokens in each request; the largest request in the batch held about 6,900, inside the 8,192 window.
- ⚠️ **One regression.** `quotes-player`: the search put the right section among its five hits, not first. Retrieval mode sent all five and answered. Lookup mode sent only the first, and the model called nothing: 0 of 3 complete.
- 🔍 **The model searches more than it reads the contents list.** Of 28 calls, 21 passed search words and 7 passed section ids. `group-player` failed 3 of 3: the model searched "folder", and the app's word is Group. Ticket 27 owns that vocabulary gap.
- 🚫 Lookup mode invented no control name, and it declined both uncovered questions in 6 of 6 runs.
- 📌 The "declined" share of lookup mode counts 2 answers that were complete and said "does not" in a detail line. They are not real declines.
- ⚠️ The probe adds `reasoning_effort: "none"` and turns streaming off, as every probe here does.

**For the user to decide.**

| Question | What the numbers say |
|---|---|
| Does lookup mode stay? | It cannot run on the default cloud model. On MeroMero it lifts player-worded answers from 25% to 63% complete, for 4.6 times the tokens |
| Should the lookup prompt hold every search hit, as retrieval mode does? | It removes the one regression. The ticket says "the best search hit", so this build sends one |
| Is the contents list worth 3,900 tokens? | The model used it in 7 of 28 calls. A lookup with search words only costs about 1,000 tokens per request |

**Guards bite.** 41 mutations, one at a time, each restored and checked. The first run found 7 that failed no test; each has a test now.

| Area | Mutations |
|---|---|
| Docs lookup | Later parts in the contents list; exact ids only; an ambiguous name takes the first match; page name alone; no near ids; near ids ignore the page; near ids unranked; budget ignored; left-out ids not named; held sections sent again; already-read ids not named; a section sent twice; bad arguments not a failure; `null` accepted; an empty call accepted; an id list ignored; quotes kept; a search that does not skip held sections; search limit ignored; no-match note missing; unknown-id note missing; call limit removed |
| Help session | Lookup mode everywhere; nowhere; on an unknown capability; every hit in the lookup prompt; budget ignores the prompt's section; prompt's section not held; retrieval prompt in lookup mode; no language on the lookup prompt; no contents list; function not offered; no executor; call-round text kept; sources with the prompt first, fetched only, prompt only |
| Lookup message | No question; no section |
| Tools switch | The switch gates the lookup, through the settings snapshot |

**Coverage**, lines and branches: `docsLookup.ts` and `helpPrompt.ts` 100%. `helpSession.ts` 100% of lines and 97.7% of branches (the finish reason of an empty answer when the server sent none, from ticket 20).

**Review fold-in.** The two reviewers found these.

| Finding | Fix |
|---|---|
| A split section could arrive with a later part and no first part, when only the later part fit the budget | The lookup returns sections in order up to the first that does not fit. Test first |
| The lookup prompt said "one guide section" when the search found none, and the message held an empty `<guide>` block | The prompt says "the guide sections that match", and the block is left out |
| The Tools switch test compared two requests that were equal by construction | It goes through the window's own hooks under the real settings provider, and fails when the switch gates the lookup |
| The id-reading test accepted either of two ids for every row | Each row names its id |
| The contents test read the index, not the lookup | It calls the lookup for every listed id |
| The round-cap assertion could not fail | The test states that the call limit binds under the cap; the tool loop's tests prove the cap |
| Comments said "Tools" for fields that hold any offered function | Reworded |
| The docs said the AI "also" gets the contents list | They say the request holds the contents list and only the best match |

Not changed: the loop's own error strings say "Tool" to the model (`Unknown Tool`, `The Tool failed`). They are the loop's text for every offered function.

**Gates** (2026-10-01, on the fold-in).

| Gate | Exit | Time |
|---|---|---|
| `npm run typecheck` | 0 | 19 s |
| `npm run lint` | 0 | 19 s |
| `npm run build` | 0 | 39 s |
| `npm run test` | 1 | 226 s |

The first commit's run was green: 15,947 tests, exit 0, 126 s. The fold-in run failed 26 tests in 5 files, with other sessions' suites on the machine. 21 are in `StatManager.test.tsx` and `personaReaders.test.ts`, which the stat-code-entities sessions have open edits behind. The other 5 (`Formaquestion.ask`, `PromptField.headers`, `MainMenu.entry`) ran for 18 to 54 seconds under load and pass alone: 148 of 148 in 26 s. Every test under `src/lib/formaquestion` and `src/lib/aiRequest` passes.
