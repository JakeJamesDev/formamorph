# Prior reasoning replay: results

**Omitting prior reasoning removes two specific failure patterns, but does not generally reduce repeated planning.** The duplicate Iven lookup and full narration draft disappear. Eight of ten continuations use more reasoning, and aggregate post-lookup reasoning increases 16.4%.

[Narration only](selection-replay-outputs.md) · [Thinking only](selection-replay-thinking.md) · [Prompts](selection-replay-prompt.md) · [Protocol](selection-replay-protocol.md) · [Mention audit](selection-replay-review.json) · [Stage measurements](selection-replay-stages.json)

## Controlled comparison

A reuses the saved appearance-prerequisite batch. B reuses exactly the same first responses, then omits assistant `reasoning_content` and `reasoning` from subsequent requests. It preserves tool calls, correlation IDs, returned entries, assistant content, prompts, seeds, model metadata, and limits. New thinking remains enabled. The two quiet cases have no continuation and are unchanged cached controls.

All ten first-continuation requests equal the saved request after removing only those fields. Server-reported prompt tokens decrease in all ten cases, by 64–158 tokens. This establishes a change to effective input; the exact rendered server template was not inspected. The experiment tests omission of reasoning context, not an isolated sentence or copying mechanism.

## Quantitative results

| Measure | A: reasoning replayed | B: prior reasoning omitted |
|---|---:|---:|
| Completed narrations | 12/12 | 12/12 |
| Required retrieval | 10/10 | 10/10 |
| Correct professional selection | 4/4 | 4/4 |
| Every explicit entity covered | 6/12 | 7/12 |
| Every mention covered, conservative collectives | 6/12 | 7/12 |
| Duplicate lookups | 1 | 0 |
| Unused retrieved entries | 0 | 0 |
| Pre-lookup reasoning, reused | 1,187 | 1,187 |
| Post-lookup reasoning | 1,913 | 2,227 |
| Total reasoning including reused responses | 3,526 | 3,840 |
| Complete narration drafted in thinking | 1/12 | 0/12 |
| Mean narration words | 174.6 | 187.4 |

Required retrieval and selection are held fixed by replaying first responses; they are not new evidence that omission preserves initial selection. All new continuations completed without extra calls. Mention coverage improves through different narration choices, not additional retrieval. Both quiet failures are unchanged; coverage among the ten live continuation cases is 6/10 to 7/10.

## What the reasoning does

The following reviews concern visible reasoning and returned narration, not a complete account of the model's internal computation. Repeated text can establish overhead, but absence of a fact from reasoning does not establish that the model ignored it.

| Case / seed | Post-lookup tokens A → B | Qualitative change |
|---|---:|---|
| Greeting / 424243 | 182 → 220 | Both apply the naming rule and personality information. B still restates the action and outlines expected responses; omission does not eliminate the inventory/plan pattern. |
| Odette / 424243 | 145 → 246 | Both connect scar/bead to the requested observation and distrust to her response. B adds a broader state inventory and repeats the same scene sequence in prose and a numbered plan. Useful refinement plus more redundancy. |
| Ferry / 424243 | 213 → 296 | B applies the retrieved construction and capacity, then describes them again in its intended narration and again in a plan. New facts are used, but the repeated outline grows. |
| Healer / 424243 | 104 → 160 | A mostly repeats the approach/request plan. B explicitly incorporates boiled water, linen, clasp, and birthmark. The extra reasoning is partly useful integration, not merely wasted tokens. A already uses retrieved facts in final narration despite not naming them in its thinking. |
| Cobbler / 424243 | 310 → 55 | A treats the lookup as pending and fetches Iven twice. B goes directly from the supplied entry to slow speech and inspection before price. Clear local improvement in completed-work recognition. |
| Greeting / 424244 | 192 → 293 | B integrates personalities and naming constraints, but repeats the slow approach and quiet tone in several forms. More reasoning is not a cleaner continuation. |
| Odette / 424244 | 158 → 374 | B inventories all entity names, player appearance, stats, location, lore, action, and tone before planning. It uses new character facts but broadens reconstruction substantially. Narration also adds the unfetched ferry. |
| Ferry / 424244 | 99 → 159 | Both recognize that retrieval is complete. B restates the entry as a list and then repeats construction/capacity as its output intention. No substantive improvement identified. |
| Healer / 424244 | 131 → 216 | B again identifies Mara and inventories tone/state/lore, while applying her treatment method. Longer with both productive integration and a repeated setup. |
| Cobbler / 424244 | 379 → 208 | A drafts the full final narration verbatim. B omits the draft, but still repeats the entire profession inventory from its first response even though that reasoning was not replayed. It then uses Iven's retrieved details correctly. |

The last cobbler is particularly informative: rebuilding the inventory without seeing the previous inventory shows that replay is not necessary for this pattern. The task/context can elicit similar structure independently. That does not rule out replay reinforcing other patterns or effects over longer histories.

## Narration and coverage

All live continuations portray their fetched target and no direct contradiction of a fixed authored entity fact was found. The two healer continuations and first cobbler stop introducing unfetched background characters. Both greetings and the second Odette response include the unfetched ferry or its guide rope. The first greeting loses a previous pass; second Odette also loses a pass. The second greeting remains a failure under the existing indirect-reference rule for ferry apparatus.

The second healer candidate narrates approaching and presenting the hand in silence rather than explicitly asking for help, despite the player's action. This is a small action-fidelity concern distinct from lore accuracy. The earlier awkward self-observation of Mara's temple is absent. Subjective prose quality remains for reader review.

## Interpretation

The result does not support stripping prior reasoning as a general repetition fix. It improves two salient cases while making most continuations longer, often by reconstructing state and intent. A small paired sample cannot establish whether those improvements generalize.

Do not infer a multi-turn result: this experiment changes tool continuations within one player turn. It does not test accumulation across story turns. No production behavior or prompt has changed.

## Evidence and checks

- [Raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-replay-batch-2026-09-23T05-32-42-732Z.json): **10 live continuation requests in 143.022 seconds (2 minutes 23 seconds)**. Cached first-response usage remains in aggregate token totals, but its latency is not part of this run. Offline validation overlapped inference; compare reasoning content and tokens rather than wall time against the earlier full run.
- Same `g4-meromero-v2-31b-i1` loaded metadata, seeds 424243/424244, thinking enabled, 1,024-token cap, and existing limits. No retries. Complete first-request and first-continuation equality guards pass.
- Documents preserve 24 narrations and 45 reasoning responses across both arms, including reused responses. Original reasoning is retained in response evidence while omitted from B's outgoing follow-ups.
- Focused suite: **54 passed in 5.446 seconds**. Probe coverage: 97.04% statements/lines, 89.45% branches, 100% functions; fixture 100% throughout. CLI preparation and live execution are exercised directly, outside that coverage percentage.
- Disabling omission causes the new preservation test to fail, **2.232 seconds**; original source restored byte-for-byte. The first test run failed because its expected normalized assistant message omitted `role`; that expectation was corrected without weakening reasoning/result preservation checks.
- Application typecheck: exit 0, 18.516 seconds; harness typecheck: exit 0, 2.185 seconds; lint: exit 0, 16.315 seconds, existing Fast Refresh warning.
- Full suite: **12,559 passed, three skipped, exit 0 in 91.336 seconds**. Build: exit 0 in 22.132 seconds, existing bundle-size warning. Changelog updated. Production prompts, export shapes, defaults, and version remain unchanged.
- Code graph refreshed, exit 0 in 128.902 seconds.
