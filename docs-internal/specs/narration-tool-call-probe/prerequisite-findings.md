# Explicit retrieval prerequisite findings

## Outcome

The explicit rule produced a stronger retrieval result in this sample: **8/8** trials requiring new lore fetched all case-required entries, versus **3/8** with the prior preparation wording. Completed narrations with full lore available for both required and substantively portrayed entities increased from **7/12 to 10/12**.

Delivery stayed at **11/12**. The remaining failures were separate: one correctly retrieved the missing lore but exhausted the cap while drafting; another retrieved the ferry, then introduced Bram into the narration without retrieving his entry. The rule is a better candidate for retrieval, not a complete workflow fix or proof of broad reliability. Application prompts remain unchanged.

## Controlled comparison

The [protocol](prerequisite-protocol.md) changes exactly one sentence in the preparation-goal variant:

> Before portraying any listed person or object, call request_info for its full entry unless that full entry is already in context.

The six scenarios and seeds 424243/424244 match the cached preparation-goal batch. All fresh baseline requests matched cached requests exactly; all candidates matched after restoring only that sentence. Loaded-model metadata matched. Ordinary narration, tool schema/description, thinking, sampling fields, and generation limits were unchanged.

| Metric | Prior preparation wording | Explicit prerequisite |
|---|---:|---:|
| Trials requiring new lore that retrieved all required entries | 3/8 | 8/8 |
| Completed narration | 11/12 | 11/12 |
| Completion with required and portrayed full lore available | 7/12 | 10/12 |
| Lookup calls / matched calls | 3/3 | 10/10 |
| Unnecessary lookups in four control trials | 0 | 0 |
| Repeated lookup of already-returned lore | 0 | 0 |
| Response-cap failures | 1 | 1 |
| Silent observation delivered without NPC interaction | 2/2 | 2/2 |
| Single paragraph among delivered narrations | 8/11 | 8/11 |
| Unintroduced names among delivered narrations | 0/11 | 0/11 |

The 8/8 retrieval metric includes the mixed-cache trial that later failed to deliver narration. It measures required-entry retrieval, not successful completion or coverage of every subsequently added character. All ten calls parsed correctly and matched entries. No infrastructure failures or replacement trials occurred.

Delivery gained greeting/424244 and lost mixed-cache/424243. Full-lore completion gained four pairs (both greetings, Odette/424243, ferry/424244) and lost one (mixed-cache/424243).

| Scenario | Prior full-lore completion | Explicit-prerequisite full-lore completion |
|---|---:|---:|
| Greeting | 0/2 | 2/2 |
| Inspect and question Odette | 1/2 | 2/2 |
| Inspect the ferry | 0/2 | 1/2 |
| Silent observation | 2/2 | 2/2 |
| Bram already retrieved | 2/2 | 2/2 |
| Bram cached, Odette missing | 2/2 | 1/2 |

## What the traces show

- **The rule changed the initial retrieval decision.** Both greetings fetched Bram and Odette. Both inspections fetched Odette. Both ferry inspections fetched the object. Both mixed-cache trials fetched only Odette, reusing Bram's returned description.
- **The negative controls held.** Both silent observations avoided NPC interaction and made no calls. Both cached-Bram scenes used the supplied sleeve and jewelry facts without fetching Bram again.
- **Scene expansion remains a gap.** Ferry/424243 fetched only the ferry. Its final response then added the ferryman's appearance and dialogue, including which arm was missing, without obtaining his entry. The initial reasoning even considered retrieving Bram, but the model did not do so. Correctly guessed details do not count as full-lore availability.
- **Drafting remains a separate bottleneck.** Mixed-cache/424243 obtained all needed lore, then repeatedly drafted and revised until the 1,024-token cap. Cached-bram/424244 also produced multiple drafts, but completed. Other successful responses sometimes drafted prose inside reasoning.
- **Narration quality is not guaranteed by retrieval.** Three delivered responses used multiple paragraphs. Odette/424244 declined to answer the preparation question; distrust is established, so that is not automatically a canon error. Mixed-cache/424244 included awkward imagery of Odette looking toward her own hair bead. Several greetings paraphrased or incompletely rendered the player's question.

Every delivered narration and the failed final trace was read. The [trial review](prerequisite-review.csv) separates required-entry availability, missing portrayed lore, and delivery. Incidental background references were not treated as substantive portrayals. All retrieved entries in delivered narrations were used; unused-retrieval scoring excludes the failed trial.

## Interpretation and remaining work

This supports retaining the explicit prerequisite as the leading retrieval candidate. Five additional missing-lore trials retrieved their required entries, with no new unnecessary calls in the four controls. The sentence both removes discretion around whether lore is needed and explicitly names `request_info`; this experiment cannot isolate those effects.

The remaining retrieval gap is a character added after the initial lookup. A future check should preserve this rule and focus on fetching entries for newly introduced participants before narration. Repeated drafting should be investigated separately. Neither gap justifies declaring the current sample a reliable production solution.

These are two seeds on six related scenes in one world and one local model. The cached baseline controls recorded requests and model metadata, not unrecorded sampler changes or run-order effects. No cross-model or tool-free gameplay claim follows.

## Cost and evidence

- Model: `g4-meromero-v2-31b-i1`, thinking enabled; ordinary output with `request_info` only. Limits: 1,024 response tokens, four rounds, four lookups, 180 seconds per request.
- Candidate batch: **268.605 seconds** (4 min 29 sec); summed trial time **268.561 seconds**, versus **251.262 seconds** for the cached baseline. More lookup rounds contribute to the difference; this is not an equivalent-work latency benchmark.
- Candidate: **28,004 prompt tokens**, **8,424 completion tokens**, including **6,512 reported reasoning tokens**. Baseline: **20,078 prompt tokens**, **7,977 completion tokens**, including **6,430 reasoning tokens**.
- Full repository gates ran after inference. No retries or budget increases.
- [Raw evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-prerequisite-batch-2026-09-22T14-50-27-899Z.json), SHA-256 `f19f679a9667bbccb786e4937ebf1346e73f0cf9641f1ed3aad68db2aa225e1b`.

## Harness verification

Focused tests: **41 passed in 4.608 seconds**. Shared probe coverage: **96.68% statements/lines, 87.11% branches, 100% functions**. The new test verifies that restoring the changed sentence restores the entire baseline request, including tools, cached history, and all other prompt text. Disabling the replacement caused the intended assertion to fail (**2.256 seconds**); source was restored afterward. Offline preparation and the live batch exercise the CLI separately from those coverage percentages.

Final checks all exited successfully: harness typecheck **2.306 seconds**, application typecheck **14.830 seconds**, lint **13.571 seconds**, full suite **12,546 passed / 3 skipped in 86.349 seconds**, and build **16.871 seconds**. Lint retained the existing Fast Refresh warning; build retained the bundle-size warning. The code graph update completed successfully in **72.847 seconds**. Export shapes, application defaults, and version were untouched.
