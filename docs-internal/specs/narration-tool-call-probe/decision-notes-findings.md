# Decision notes preparation findings

## Outcome

**Mixed result: delivery improved, but drafting and total reasoning cost did not improve consistently.** All twelve trials delivered narration, versus eleven with the retrieval-prerequisite baseline. Repeated prose drafting fell from two trials to one. However, any prose drafting inside reasoning increased from five trials to six, and total reasoning tokens increased from 6,512 to 6,876.

The new preparation wording also produced two unnecessary lookups in one silent-observation control and two narrations that contradicted the supplied sound lore. Retain this as an experimental variant, not an established improvement. Application prompts remain unchanged.

## Controlled comparison

The [protocol](decision-notes-protocol.md) replaces preparation with brief decision notes, an explicit completion condition, and a handoff to composing final narration. The exact retrieval rule is preserved. The entire fresh baseline request matched each saved request; candidate requests matched outside preparation. Loaded-model metadata matched before inference.

The comparison uses the same six scenarios and seeds 424243/424244 on `g4-meromero-v2-31b-i1`, with thinking enabled, ordinary narration, `request_info` only, automatic tool choice, and the unchanged 1,024-token response cap. Tool descriptions, schemas, world, actions, caches, sampler fields, four-round/four-lookup limits, and 180-second timeout were preserved. No retry or replacement trial occurred.

| Metric | Retrieval-prerequisite baseline | Decision notes |
|---|---:|---:|
| Trials with repeated prose drafts inside reasoning | 2/12 | 1/12 |
| Trials with any prose draft inside reasoning | 5/12 | 6/12 |
| Completed narration | 11/12 | 12/12 |
| Required new lore retrieved | 8/8 | 8/8 |
| Completed with required and portrayed full lore available | 10/12 | 11/12 |
| Lookup calls / matched calls | 10/10 | 12/12 |
| Unnecessary calls across four controls | 0 | 2 in one trial |
| Redundant retrieval of already-returned entries | 0 | 0 |
| Silent observations without NPC interaction | 2/2 | 2/2 |
| Single paragraph among delivered narrations | 8/11 | 8/12 |
| Unintroduced entity names in delivered narrations | 0 | 0 |
| Cap failures | 1 | 0 |
| Reasoning tokens | 6,512 | 6,876 |
| Completion tokens, including reasoning | 8,424 | 8,841 |
| Prompt tokens | 28,004 | 30,733 |
| Batch time | 268.605 s | 282.595 s |

Repeated drafting means composing scene prose and then rewriting it or producing another prose version within reasoning, before the final answer. A scene outline is not a prose draft. Copying a single draft into final narration is counted as drafting, not repeated drafting. Every reasoning response and delivered narration in both arms was read under this definition; the [paired review](decision-notes-review.csv) records the classifications.

Full-lore completion measures available entries, not canonical or good prose. The candidate's second environment trial describes the ferry's lean and mooring-line material without retrieving it. That full descriptive sentence counts as substantive object portrayal, unlike an incidental reference to a moored or listing raft. Excluding this borderline background portrayal would raise candidate full-lore completion to 12/12; it would not remove the unnecessary calls, sound contradictions, or continued drafting.

## What changed in the failures

- **Mixed-cache/424243 completed.** The baseline repeatedly drafted until the cap. The candidate produced one prose draft and delivered narration. However, it described the player's voice carrying clearly across gloamwater, whose supplied lore says sound does not carry over it.
- **Cached-Bram/424244 still redrafted.** The candidate produced two prose versions before delivery. It also described the ferryman's voice carrying over the water, contradicting the same lore. The baseline produced more revisions but completed too.
- **Environment/424243 over-retrieved.** It fetched both NPC descriptions in case it needed them, then used neither. The final scene correctly preserved silent observation. This is a retrieval-cost regression, not an interaction violation.
- **Environment/424244 expanded the portrayal.** It added ferry construction detail without retrieving the ferry. The baseline's missing-entry failure was instead ferry/424243 adding Bram. The risk moved rather than disappearing.
- **Formatting remains uneven.** Four candidate responses had two paragraphs. Greetings often paraphrased the player's speech or kept NPCs evasive; some of this behavior was already present in the baseline. Neither the preparation contract nor successful retrieval guarantees action fidelity or narrative quality.

The traces sometimes adopted decision headings and outlines, but often retained long recaps, constraint checks, and prose drafting. This is partial adherence to the new preparation format. It does not establish that a positive handoff instruction reliably reduces reasoning or eliminates drafting.

## Recommendation and limits

Keep the explicit retrieval prerequisite as the leading retrieval rule. Do not promote the decision-notes variant as a general improvement on this evidence. If another experiment is authorized, the previously proposed single prohibition on drafting during preparation is now a reasonable isolated next test; it has not been added or run here.

This is a diagnostic comparison on one local model, one world, and two seeds per scenario. The cached baseline verifies requests and exposed model metadata, not unrecorded sampler changes or run-order effects. More tool work and longer reasoning both affect elapsed time, so this is not an equivalent-work speed benchmark. No cross-model or production-readiness claim follows.

## Evidence and verification

- Candidate batch: **282.595 seconds (4 min 43 sec)**; summed trial time **282.547 seconds**. Baseline summed trial time: **268.561 seconds**.
- [Raw candidate evidence](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-decision-notes-batch-2026-09-22T15-09-02-877Z.json), SHA-256 `716d823f0a85c864ba63a49a3c5196b1632a093975e42c05a47238079ecaf1fc`.
- [Baseline findings](prerequisite-findings.md) and [protocol/reproduction command](decision-notes-protocol.md).
- Focused suite: **42 passed in 4.558 seconds**. Shared probe coverage: **96.73% statements/lines, 87.24% branches, 100% functions**. The CLI was exercised through offline preparation and live inference, outside those coverage percentages.
- Disabling the decision-notes replacement made the new control test fail at its intended assertion in **2.193 seconds**. Source was restored and verified afterward.
- All twelve actual initial requests matched their prepared candidates. Review-row totals were checked against the report.
- Harness typecheck passed in **2.278 seconds**, application typecheck in **14.858 seconds**, and lint in **13.503 seconds** (zero errors; existing Fast Refresh warning).
- The first full suite exited 1: **12,546 passed, one failed, three skipped in 86.618 seconds**. The unrelated `SettingsModal.quoteColor` test timed out waiting for Escape to close its popup. That unchanged file passed all three tests in isolation in **7.849 seconds**. No test, fixture, timeout, or assertion was changed to address it.
- The unchanged full-suite recheck exited 0: **12,547 passed, three skipped in 86.119 seconds**. Build passed in **16.891 seconds**, retaining the existing bundle-size warning. The intermittent popup failure remains an adjacent issue, not a fix delivered by this experiment.
- Changelog copy was reviewed; the sweep reported only notices outside the edited entry. Export shapes, application defaults, and version were untouched.
- The code graph update completed successfully in **72.994 seconds**.
