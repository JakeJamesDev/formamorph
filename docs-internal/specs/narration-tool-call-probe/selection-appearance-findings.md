# Appearance prerequisite: results

**The shorter description preserves required retrieval but does not improve coverage or lookup timing over the latest baseline.** All twelve narrations complete; six include an explicit entity whose full entry was never fetched. One candidate retrieves the same character twice.

[Narration only](selection-appearance-outputs.md) · [Thinking only](selection-appearance-thinking.md) · [Complete prompts and player actions](selection-appearance-prompt.md) · [Protocol](selection-appearance-protocol.md) · [Mention audit](selection-appearance-review.json) · [Reasoning stages](selection-appearance-stages.json)

## Change tested

The minimal narrator role, section definitions, entity summary labels, tool name, parameter, and Input/Output documentation remain fixed. The candidate replaces Purpose and Use when with:

> Purpose: Retrieve an entity's full authored entry. Entity summaries identify candidates for the story.
>
> Use when: Before an entity appears in your upcoming narration, retrieve its full entry for this response. This includes named, indirect, and background appearances.

The baseline is the saved retrieve-before-planning candidate. This is a combined description revision: it removes planning instructions, the explicit already-loaded exception, and the unrelated-entity sentence. It does not isolate the word “appears” or prompt length.

## Measurements

| Metric | Baseline: retrieve before planning | Candidate: appearance prerequisite |
|---|---:|---:|
| Required retrieval | 10/10 | 10/10 |
| Correct professional selection and retrieval | 4/4 | 4/4 |
| Completed narrations | 12/12 | 12/12 |
| Every explicit entity reference covered | 6/12 | 6/12 |
| Every mention covered, conservative collectives | 5/12 | 6/12 |
| Explicit character references covered | 10/17 | 10/18 |
| Object references covered | 2/7 | 2/4 |
| Lookup calls | 12 | 13 |
| Redundant same-entity lookups | 0 | 1 |
| Retrieved entries unused in narration | 0 | 0 |
| Reasoning before first lookup, ten required cases | 1,139 | 1,187 |
| Reasoning after first lookup, ten required cases | 1,861 | 1,913 |
| Reasoning across all twelve cases | 3,599 | 3,526 |
| Initial greeting request prompt tokens | 877 | 856 |
| Mean narration words | 168.7 | 174.6 |

Prompt tokens are server-reported for the same first greeting request, including system, user, tools, and template. Reasoning tokens are server-reported usage. The candidate is 21 prompt tokens shorter, with total reasoning down 2.0%, but pre-lookup reasoning up 4.2% and post-lookup reasoning up 2.8%. Five required cases reduce pre-lookup reasoning and five increase it. Quiet-case reasoning falls from 599 to 426, accounting for the small aggregate reduction.

Post-lookup totals include an additional request in the first cobbler case: Iven is fetched twice. Both calls return his full entry. The intervening trace treats retrieval as still pending despite the preceding result. Removing the already-loaded exception is a plausible contributor, not an isolated causal finding.

Drafting also persists: the second cobbler response writes its complete narration inside the recorded thinking before returning it as narration. The shorter tool description does not eliminate that behavior.

## Remaining failures

The six explicit-coverage failures are:

- First quiet observation: unfetched ferry.
- First healer scene: unfetched ferryman and courier.
- First cobbler scene: unfetched ferryman and eel-smoker.
- Second greeting: unfetched ferry.
- Second quiet observation: unfetched basketmaker and cobbler.
- Second healer scene: unfetched cobbler and basketmaker.

The first quiet trace explicitly reasons that no retrieval is necessary because the player is not interacting with anyone, while planning background ferry details. The second quiet trace also treats the action as environmental observation, then narration introduces named people through their sounds. The interaction-versus-background distinction persists despite explicit background wording.

Strict collective coverage improves by one case without improving explicit coverage; it is not evidence of broader retrieval. Neither quiet candidate calls tools, and both introduce unfetched entities. All retrieved entries are used, but the repeated Iven lookup is unnecessary work.

No direct contradiction of a fixed authored entity fact was found in candidate narration. The first healer response has a prose error: Mara's eyes appear to catch her own temple birthmark. Retrieval does not guarantee coherent prose. Subjective engagement remains for the reader to assess in the separate narration comparison.

## Interpretation

This candidate is not an observed improvement over the latest baseline. It keeps successful action-required retrieval and compact reasoning but leaves background coverage unchanged and adds one redundant call. The earlier inclusion description reached 10/12 explicit coverage in this same fixture; neither the latest baseline nor this candidate matches that result. Small paired samples do not establish a universal wording preference.

Keep this as a reviewed experimental candidate. The application prompt remains unchanged. Further wording changes should follow review of these outputs and the user's next hypothesis, rather than automatically stacking more instructions.

## Evidence and validation

- [Raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-appearance-batch-2026-09-23T04-36-30-432Z.json): twelve live candidates took **240.634 seconds (4 minutes 1 second)**. The twelve baselines were reused, not rerun. Local inference overlapped offline checks, so timing is descriptive; token counts are the work comparison.
- Model `g4-meromero-v2-31b-i1`; seeds 424243/424244; thinking enabled; unchanged 1,024-token cap and transport. No retries or cap increases. This is a local experiment, not cross-model release validation.
- Full cached request equality, loaded-model metadata, and actual-versus-prepared request checks pass. The documents preserve all 24 narrations and 45 recorded thinking responses.
- Wrong cached-arm mutation rejected in **14.017 seconds**; byte-for-byte restoration verified.
- Focused tests: **2 passed in 4.593 seconds**, fixture coverage 100% statements, branches, functions, and lines. CLI preparation/live paths are exercised directly, not included in that coverage percentage.
- Application typecheck: exit 0 in 15.172 seconds. Harness typecheck: exit 0 in 2.290 seconds. Lint: exit 0 in 13.900 seconds, with the existing Fast Refresh warning.
- Initial full suite: 12,554 passed, three skipped, three child-process permission failures (`spawnSync node EPERM`), exit 1 in **94.603 seconds**. A rerun outside the sandbox is recorded below.
- Full suite outside sandbox: **12,557 passed, three skipped, exit 0 in 90.702 seconds**. Build: exit 0 in 17.240 seconds, existing bundle-size warning.
- Changelog updated; code graph refreshed, exit 0 in 75.643 seconds. Production prompts, export shapes, defaults, and version remain unchanged.
