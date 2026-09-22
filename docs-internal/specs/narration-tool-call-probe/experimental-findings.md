# Experimental prompt findings

## Outcome

**Experimental did not improve the overall tool workflow.** Native narration delivery stayed at 9/12, while completed narrations with required and portrayed full lore available fell from 9/12 to 3/12. Experimental made no lookup calls in any trial.

Silent observation improved in these two samples: both Experimental responses avoided NPC speech, although one returned plain prose instead of calling `write`. Repeated drafting remains visible, including a ferry response that produced several revisions and exhausted the response cap.

The application presets were not changed during this run. Keep Experimental opt-in; this evidence does not support promoting it over Default.

## Paired results

The comparison uses the [fixed protocol](experimental-protocol.md): six existing scenes at seeds 424243 and 424244, with the information-focused lookup description in both arms. Default results are cached from the earlier expanded batch. All twelve cached initial requests matched fresh preparation exactly, and loaded-model metadata matched. Only the system and user prompt messages differ between arms.

| Metric | Default adapted for tools | Experimental |
|---|---:|---:|
| Native `write` completion | 9/12 | 9/12 |
| Completion with required and portrayed full lore available | 9/12 | 3/12 |
| Lookup calls | 17 | 0 |
| Response-cap failures | 2 | 1 |
| Finished plain prose instead of `write` | 1 | 2 |
| Invalid tool arguments | 0 | 0 |
| Single paragraph among submitted narrations | 8/9 | 8/9 |
| Unintroduced names in submitted narration | 0/9 | 1/9 |
| Silent observation responses without NPC speech, including plain prose | 1/2 | 2/2 |
| Silent observation delivered through `write` without NPC speech | 0/2 | 1/2 |

Experimental alone completed three pairs, Default alone completed three, and both completed six. There is no completion-rate gain. The three grounded Experimental completions were the two already-cached Bram scenes and one observation scene requiring no entity description. No missing entry was retrieved. Zero unmatched or redundant lookups is not a retrieval success when no lookups occur.

| Scenario | Default completion | Experimental completion | Experimental completion with full lore |
|---|---:|---:|---:|
| Greeting | 2/2 | 1/2 | 0/2 |
| Inspect and question Odette | 2/2 | 2/2 | 0/2 |
| Inspect the ferry | 1/2 | 1/2 | 0/2 |
| Silent environment observation | 1/2 | 1/2 | 1/2 |
| Bram already retrieved | 2/2 | 2/2 | 2/2 |
| Bram cached, Odette missing | 1/2 | 2/2 | 0/2 |

## What the responses show

- **Summaries were treated as enough information.** Both Odette inspections invented hair and scar details without retrieving her full entry. Neither used the authored green glass bead. Both mixed-cache responses used Bram's supplied description but portrayed Odette from her summary.
- **The observation conflict eased.** Experimental kept both observations silent. Default added ferryman dialogue in one; its other observation stayed silent but still elaborated both NPCs and bypassed `write`.
- **Repeated drafting persists.** Experimental ferry/424244 repeatedly revised complete prose inside reasoning and reached the 1,024-token cap. Mixed-cache/424243 also drafted and revised before submitting. Odette/424243, Odette/424244, and mixed-cache/424244 composed substantial narration in reasoning before repeating it through `write`. The direct-composition instruction is not a reliable guard.
- **Other output issues remain.** Ferry/424243 used Bram's name before introduction. Mixed-cache/424244 returned three paragraphs and described the ferryman as being there for the crossing rather than clearly introducing his work. Several responses paraphrased the player's speech despite the prompt requesting their words.

Full-lore availability is a prerequisite metric, not proof of faithful narration. All submitted outputs and failed final responses were read; the [trial table](experimental-review.csv) preserves the mechanical outcomes. Incidental NPC silhouettes in the failed environment response are not counted as substantive portrayals. Failed prose is considered for restraint diagnosis only and remains a delivery failure.

## Interpretation and next step

The new prompt changes several instructions together, so this run cannot identify which sentence caused retrieval to disappear. A plausible explanation is that the conditional tool instructions and emphasis on using descriptions already in context let the model treat summaries as sufficient. The trace supports that interpretation, but does not prove causation.

The next focused change should separate the tool-enabled contract from the ordinary narration fallback. When tools are actually supplied, identify the listings explicitly as summaries, require missing full entries before portrayal, and make `write` the sole output path. Preserve the conditional dialogue wording. Test that retrieval change before adding more anti-drafting instructions or increasing the cap.

## Cost and limits

- Model: `g4-meromero-v2-31b-i1`, thinking enabled, automatic tool choice, unchanged 1,024-token cap.
- New model batch: **235.137 seconds** (3 min 55 sec); summed trial time **234.878 seconds**. Matching cached Default trials totaled **340.245 seconds**. Experimental's lower time includes skipping every retrieval, so it is not an equivalent-work speed improvement.
- Default: 35,137 prompt tokens and 10,484 completion tokens. Experimental: 16,230 prompt tokens and 7,439 completion tokens.
- No infrastructure failures, replacement trials, or cap increases. Full repository gates ran after inference.
- This is one model, one world, and two seeds per scene. Cached baselines do not control for unrecorded server sampler changes or run-order effects. This does not establish behavior on cloud models or the tool-free gameplay path.
- [Raw evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-batch-2026-09-22T13-50-49-667Z.json), SHA-256 `f4fbe1a30da85ec8385564d9c2954fdd9659ac717bac58827f019a271d9105b4`. Requests, model metadata, cached comparisons, and every new response are preserved locally.

## Harness verification

The existing probe now selects Experimental's real narration templates while retaining summary-only entity rendering. Offline preparation verifies all twelve cached comparisons and non-prompt controls. The new regression test runs cached lore → missing-lore lookup → `write` through the real loop; disabling Experimental selection made its prompt assertion fail. Source was restored afterward.

Focused tests: **34 passed in 4.525 seconds**. Shared probe coverage: **96.54% statements/lines, 87.22% branches, 100% functions**. Mutation check: expected failure in **2.146 seconds**. The CLI is exercised through offline preparation and the live batch, not included in those coverage percentages.

Repository checks: typecheck exit 0 (**14.931 seconds**), harness-specific typecheck exit 0 (**2.321 seconds**), lint 0 errors (**13.635 seconds**, existing Fast Refresh warning), full tests **12,539 passed / 3 skipped**, exit 0 (**86.969 seconds**), build exit 0 (**16.884 seconds**, bundle-size warnings). Changelog copy reviewed. No production prompt, version, export shape, or application default changed in this follow-up.
