# Preparation-goal findings

## Outcome

The revised preparation block produced a modest retrieval improvement in this fixed sample: **7/12** narrations completed with required and substantively portrayed full lore available, versus **5/12** with the original Experimental preparation. Correct missing-lore retrieval increased from **1/8 to 3/8** relevant trials. Delivery stayed at **11/12**.

This is not a reliable solution yet. Both greeting trials and both ferry inspections still skipped lookup, as did one Odette inspection. Repeated drafting remains, one response still exhausted the cap, and reported reasoning tokens increased. The candidate remains in the standalone probe; application prompts were not edited.

## Controlled comparison

The [protocol](preparation-goal-protocol.md) replaces only the Preparation section with the approved candidate. All twelve initial baseline requests matched their saved ordinary-output counterparts, and all candidate requests matched outside that section. Loaded-model metadata matched. The six scenes, seeds 424243/424244, `request_info` schema/description, ordinary output, thinking, token cap, and loop limits were unchanged.

| Metric | Original preparation | Goal-focused preparation |
|---|---:|---:|
| Completed narration | 11/12 | 11/12 |
| Completion with required and portrayed full lore available | 5/12 | 7/12 |
| Missing-lore trials retrieving all required entries | 1/8 | 3/8 |
| Lookup calls / matched calls | 1/1 | 3/3 |
| Response-cap failures | 1 | 1 |
| Silent observation delivered without NPC interaction | 2/2 | 2/2 |
| Single paragraph among delivered narrations | 9/11 | 8/11 |
| Unintroduced names among delivered narrations | 0/11 | 0/11 |
| Reported reasoning tokens | 4,930 | 6,430 |

There were no invalid calls, unmatched queries, redundant lookups, or infrastructure failures. No trials were replaced. The candidate gained one delivery pair (Odette/424243) and lost one (greeting/424244). It gained two full-lore completion pairs without losing any: mixed-cache/424243 and Odette/424244.

| Scenario | Original full-lore completion | Candidate full-lore completion |
|---|---:|---:|
| Greeting | 0/2 | 0/2 |
| Inspect and question Odette | 0/2 | 1/2 |
| Inspect the ferry | 0/2 | 0/2 |
| Silent observation | 2/2 | 2/2 |
| Bram already retrieved | 2/2 | 2/2 |
| Bram cached, Odette missing | 1/2 | 2/2 |

## What changed in the responses

- **Successful retrieval expanded beyond cached-history cases.** Odette/424244 requested her full entry before narration despite having no prior tool result. Its final prose used her authored right-cheek burn scar and green glass hair bead. Both mixed-cache trials fetched Odette and reused Bram's supplied entry.
- **The model still exercised discretion over whether lore was needed.** Greeting/424243 decided summaries were enough for a brief first meeting. Ferry/424243 made the same decision, and ferry/424244 explicitly extrapolated construction from the summary. These traces directly undermine the assumption that the new wording establishes a mandatory retrieval prerequisite.
- **Reasoning did not become reliably shorter or more purposeful.** Greeting/424244 repeatedly planned and drafted until the cap. Odette/424243 and environment/424243 produced multiple full-prose drafts or repeated polished versions inside reasoning before answering.
- **Restraint held, but formatting and story issues remain.** Both observations stayed silent. Greeting/424243 used three paragraphs; both mixed-cache outputs used two. Unretrieved descriptions invented details. Greeting/424243 discounted the player's firepit reference rather than fetching the description that could resolve it. Mixed-cache/424244 had awkward grammar and extended Odette's counting habit to the distance between people.

Every delivered narration and failed final trace was read. The [trial review](preparation-goal-review.csv) records outcomes and annotations. Full-lore availability is not a comprehensive fidelity score; incidental background references were not treated as substantive portrayals requiring extra entries.

## Interpretation

The result supports further testing of the preparation block, but not a general claim that reasoning instructions improve MeroMero. Only two paired lore outcomes improved. All samples share one world and one model, and the replacement changes retrieval wording as well as reasoning guidance while removing the old direct-composition instruction.

The unresolved ambiguity is **“needed entry.”** The candidate leaves the model to decide whether it can write from a summary. A next experiment should make the prerequisite explicit: before portraying any listed person or object, obtain its full entry unless already returned. That would test whether a concrete retrieval rule works better than asking the model to determine which facts it needs. It should remain separate from attempts to reduce drafting or change the token cap.

## Cost and evidence

- Model: `g4-meromero-v2-31b-i1`, thinking enabled. Request and lookup limits unchanged.
- Candidate batch: **251.524 seconds** (4 min 12 sec); summed trial time **251.262 seconds**, versus **206.575 seconds** for the cached baseline. The extra tool rounds contribute to this difference; these are not equivalent-work latency measurements.
- Candidate: **20,078 prompt tokens**, **7,977 completion tokens**, including **6,430 reported reasoning tokens**. Baseline: **17,407 prompt tokens**, **6,602 completion tokens**, including **4,930 reasoning tokens**.
- Full repository gates ran after inference. A cached comparison cannot control unrecorded sampler changes or run-order effects.
- [Raw evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-preparation-goal-batch-2026-09-22T14-29-29-834Z.json), SHA-256 `de7205541a48517cb88c8826bcddd35c93450a0a012514c5fa9e8b6d8f8106b7`.

## Harness verification

Focused tests: **40 passed in 4.624 seconds**. Shared probe coverage: **96.67% statements/lines, 86.97% branches, 100% functions**. The new test verifies the candidate text, unchanged messages/tools/cached lore outside Preparation, and withholding of unavailable descriptions. Disabling the replacement caused the intended assertion to fail (**2.166 seconds**); source was restored afterward. Offline preparation and the live batch exercise the CLI separately from those coverage percentages.

Repository checks: typecheck exit 0 (**14.770 seconds**), harness-specific typecheck exit 0 (**2.266 seconds**), lint 0 errors (**13.608 seconds**, existing Fast Refresh warning), full tests **12,545 passed / 3 skipped**, exit 0 (**86.545 seconds**), build exit 0 (**17.139 seconds**, bundle-size warnings). Changelog copy reviewed. No application prompt, export shape, version, or default changed.
