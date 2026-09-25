# Rescore: involved entities only

**Under the involved-entity rule, every lookup description from the selection series scores 12/12.** The coverage gaps in the earlier findings were almost all background mentions. The retrieve-first description keeps full involved coverage with the least reasoning, so it is the best candidate so far.

## Rule

An entity is **involved** when it speaks, acts toward or reacts to the player, or the player interacts with it. An involved entity needs its full entry. A background mention (scanned past, heard, used as scenery) may come from its summary. The author keeps summaries useful.

The earlier findings scored "every mentioned entity fetched". This rescore changes only the rule. No model calls were made.

## Method

- All 15 saved batches with a mention audit: 360 narrations, 218 audited mentions of an unfetched entity.
- 10 mentions were entities the action required. These count as involved misses automatically.
- The other 208 were read in context and labeled:
  - **Involved:** 0.
  - **Gray:** 13. The entity watches the player ("watches you from his post", "observes your scrutiny"), or it gets physical detail its summary lacks. One gives Bram the wrong missing arm.
  - **Background:** 195.
- Gray is scored twice: once as fine, once as a miss.

## Results

"Involved" = completed with every required entity loaded and no involved miss.

| Batch | Arm | Completed | Old rule: every mention | **Involved** | Involved, gray = miss | Unneeded lookups |
|---|---|---:|---:|---:|---:|---:|
| mention-tool | previous (summary label) | 12/12 | 4 | **7** | 6 | 0 |
| mention-tool | candidate | 11/12 | 5 | **10** | 10 | 0 |
| entity-definition | candidate | 12/12 | 5 | **12** | 12 | 0 |
| no-example | candidate | 12/12 | 5 | **11** | 11 | 0 |
| section-definitions | candidate | 12/12 | 8 | **12** | 11 | 0 |
| entity-header | candidate | 12/12 | 5 | **12** | 11 | 0 |
| entity-tool | candidate | 12/12 | 6 | **12** | 11 | 5 |
| entity-full | candidate | 12/12 | 3 | **12** | 10 | 2 |
| selection-scope | A / B | 12 / 12 | 10 / 7 | **12 / 12** | 12 / 12 | 1 / 0 |
| selection-include | A / B | 12 / 12 | 10 / 10 | **12 / 12** | 12 / 12 | 1 / 1 |
| selection-retrieve-first | A (include) / **B (retrieve first)** | 12 / 12 | 10 / 6 | **12 / 12** | 12 / 12 | 1 / 0 |
| selection-appearance | A / B | 12 / 12 | 6 / 6 | **12 / 12** | 12 / 12 | 0 / 0 |
| selection-replay | A / B | 12 / 12 | 6 / 7 | **12 / 12** | 12 / 12 | 0 / 0 |
| selection-example | A / B / C | 12 each | 6 / 7 / 9 | **12 each** | 12 each | 0 |
| selection-expanded-example | A / B | 12 / 12 | 9 / 9 | **12 / 12** | 12 / 12 | 0 |
| selection-chain | A / B | 6 / 6 | 4 / 4 | **6 / 6** | 6 / 6 | 0 |

The prefill control from [prefill-order-findings.md](prefill-order-findings.md) agrees: 24/24 involved, 1 unneeded lookup.

## What changes

- **Retrieve-first is no longer a regression.** Its drop from 10/12 to 6/12 was all background mentions. On the involved rule it matches the inclusion description at 12/12, with 24% less reasoning (3,599 against 4,736 tokens) and no unneeded lookups.
- **Real involved misses stop after the mention-tool step.** Before it, required entities went unfetched: 7/12 for the summary-label baseline. From the selection series on, none do.
- **The gray cases come from the older fixture only.** All 13 are in batches before the selection series. The wrong-arm case shows the risk the author owns: a background portrayal can invent detail when a summary is thin.
- Evidence limits stay: one model (MeroMero), one fixture, 2 seeds.

## Recommendation

Use the retrieve-first description as the `get_entity` description:

> Purpose: Retrieve the full authored information needed to narrate an entity. Summaries help you choose which entities to include.
> Use when: Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response. This applies to direct and indirect references, including background appearances. Leave unrelated entities unfetched.

Its "including background appearances" clause asks for more than the new rule needs. Removing it is a separate wording test.
