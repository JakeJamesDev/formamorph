# Ordinary narration findings

## Outcome

Removing `write` simplified the delivery contract, but did not resolve missing-lore retrieval or repeated drafting. **11/12** ordinary narrations completed. The prior Experimental batch also produced **11/12** finished narrations if its two plain-prose responses are counted alongside its nine valid `write` calls.

There was **one correct lookup**, in the second mixed-cache trial. It retrieved Odette while reusing Bram's supplied description. The other seven trials requiring a new lookup made none. Completed narration with required and substantively portrayed full lore available increased from **3/12 to 5/12** under each arm's delivery contract; counting finished prose in the old arm raises its comparison to **4/12**.

This supports testing the planned explicit retrieval contract next. It does not establish that ordinary output improves generation reliability. No prompt text or production behavior changed, and variant B was not run.

## Controls and measurements

The [protocol](plain-output-protocol.md) uses the same six scenarios and seeds 424243/424244 as the saved Experimental batch. All twelve cached requests matched fresh preparation. Each new request differed only by removal of the `write` tool; system and user messages were identical. The loaded MeroMero metadata matched. Thinking, lookup description, tool choice, token cap, and request/lookup limits were unchanged.

| Metric | Experimental with `write` | Experimental with ordinary output |
|---|---:|---:|
| Successful delivery under the arm's contract | 9/12 | 11/12 |
| Finished narration in either output form | 11/12 | 11/12 |
| Successful delivery with required and portrayed full lore available | 3/12 | 5/12 |
| Finished narration with full lore, allowing either output form | 4/12 | 5/12 |
| Lookup calls | 0 | 1 |
| Trials requiring new lore that retrieved all required entries | 0/8 | 1/8 |
| Response-cap failures | 1 | 1 |
| Silent observation without NPC speech, including plain prose | 2/2 | 2/2 |
| Silent observation delivered under the arm's contract | 1/2 | 2/2 |
| Single paragraph among contract-successful narrations | 8/9 | 9/11 |
| Unintroduced names among contract-successful narrations | 1/9 | 0/11 |

Using each arm's contract, ordinary output gained three pairs and lost one. Allowing completed narration in either output form, it gained one and lost one: ferry/424244 recovered while Odette/424243 newly exhausted the cap. This distinction prevents acceptance of ordinary prose from being misreported as a model-quality gain.

All calls had valid arguments. There were no unmatched or redundant lookups, calls to the removed `write` function, tool syntax masquerading as narration, or infrastructure failures. No trial was replaced. These are small-sample observations, not guarantees.

## What the traces establish

- **The model can use the remaining tool.** In mixed-cache/424244 it identified Odette's summary as incomplete, requested her entry, and used the authored green glass hair bead in its final narration. Bram's cached description was reused without another lookup.
- **The model often decides a summary is sufficient.** Odette/424243 considered requesting her description but continued from the summary instead. Ferry/424244 explicitly treated the summary as enough for construction details, then portrayed both the ferry and ferryman without full lore.
- **Repeated drafting remains.** Odette/424243 revised the scene repeatedly until it exhausted the 1,024-token cap. Environment/424244 and cached-bram/424244 also drafted prose inside reasoning before emitting similar final prose.
- **Restraint held.** Both environment trials stayed focused on silent observation, with no NPC dialogue or interaction.
- **Story issues remain separate from tool delivery.** Greeting/424243 and cached-bram/424243 used two paragraphs despite the single-paragraph request. Unretrieved Odette portrayals invented scar and hair details; mixed-cache/424243 added a scarred hand. Greeting/424244 had Odette wait for fading light despite the ferryman's refusal to cross after dark.

Every submitted narration and the failed response trace was reviewed. The [trial table](plain-output-review.csv) records delivery, full-lore availability, paragraph counts, time, and manual notes. Lore availability is not a comprehensive canon-fidelity score.

## Next experiment

Keep ordinary narration and test variant B's explicit retrieval contract against these saved trials. State that listings are summaries, and require the full entry for each listed person or object portrayed unless it was already returned. Leave the conditional-dialogue wording and generation limits unchanged. The objective is to change the decision to retrieve, rather than add more anti-drafting instructions or increase the cap.

## Evidence and cost

- Model: `g4-meromero-v2-31b-i1`, thinking enabled; 1,024 response tokens, four rounds, four lookups, 180 seconds per request.
- New batch: **206.617 seconds** (3 min 27 sec); summed trial time **206.575 seconds**, versus **234.878 seconds** for the cached batch. Full tests and mutation checks ran outside inference.
- New batch: **17,407 prompt tokens**, **6,602 completion tokens**. Cached batch: **16,230 prompt tokens**, **7,439 completion tokens**. Timing is observational; order and unrecorded server defaults are not controlled by a cached comparison.
- [Raw evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-plain-batch-2026-09-22T14-13-49-935Z.json), SHA-256 `095842c29d58ae167610ab57edb7719addfd3d751fe7b64b9d93f5d24c0da074`.
- This is one local model, one world, and two seeds per scene. No cloud or tool-free gameplay quality claim follows.

## Harness verification

Focused tests: **39 passed in 4.620 seconds**. Shared probe coverage: **96.61% statements/lines, 87.30% branches, 100% functions**. Tests cover lookup followed by ordinary output, unchanged request fields, cap exhaustion, missing finish reason, empty prose, and calls to unadvertised `write`.

Mutation checks caught accepting incomplete output (**2.183 seconds**) and retaining the removed tool (**2.196 seconds**); source was restored afterward. The CLI was exercised through offline preparation and the live batch and is not included in those coverage percentages.

Repository checks: typecheck exit 0 (**14.745 seconds**), harness-specific typecheck exit 0 (**2.252 seconds**), lint 0 errors (**13.589 seconds**, existing Fast Refresh warning), full tests **12,544 passed / 3 skipped**, exit 0 (**87.058 seconds**), build exit 0 (**17.006 seconds**, bundle-size warnings). Changelog copy reviewed. No application prompt, export shape, version, or default changed.
