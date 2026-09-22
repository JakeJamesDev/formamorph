# Entity header and tool naming results

Both independent naming variants retain all action-required lookups and complete all twelve narrations. Neither improves the stricter requirement to load every entity actually mentioned. Keep these as experiments; the conditional parameter-name model run is deferred.

## Read the output

- **Header only:** [Narration](entity-header-outputs.md) · [Thinking](entity-header-thinking.md) · [Exact prompt](entity-header-prompt.md) · [Mention audit](entity-header-review.csv).
- **Tool name only:** [Narration](entity-tool-outputs.md) · [Thinking](entity-tool-thinking.md) · [Exact prompt](entity-tool-prompt.md) · [Mention audit](entity-tool-review.csv).
- [Protocol and later description-format comparison](entity-naming-protocol.md).

Each comparison places the saved section-definitions baseline before its candidate. Narration and thinking are separate, preserved verbatim. The two candidates are independent: the tool-name run retains the original header.

## Measurements

| Metric | Saved baseline | Entity header | `get_entity(term)` |
|---|---:|---:|---:|
| Cases fetching all action-required new lore | 8/8 | 8/8 | 8/8 |
| Action-required individual entries fetched | 10/10 | 10/10 | 10/10 |
| Completed narrations | 12/12 | 12/12 | 12/12 |
| Completed with every mentioned entity loaded | 8/12 | 5/12 | 6/12 |
| New lookup calls | 10 | 10 | 15 |
| Invalid tool calls | 0 | 0 | 0 |
| Reasoning tokens, all requests | 3,507 | 3,838 | 3,520 |
| Average narration words | 172.0 | 162.8 | 183.8 |
| Batch duration | 230.874 s | 224.872 s | 219.265 s |

The new header produces the same lookup count but adds unfetched background references. Its fifth case passes with cached Bram; its fourth case counts “others waiting” as referring collectively to the two people. Excluding that ambiguous collective raises coverage to 6/12, still below the baseline.

The renamed tool makes five additional lookups: the ferry in the first quiet observation, all three entities in the second quiet observation, and Odette in the second cached-Bram question. Those entries are used in the resulting narration. This is encouraging evidence of broader retrieval in this batch, but it does not satisfy the complete mention contract: six outputs still mention the unfetched ferry. Reasoning is essentially unchanged (+0.4%).

Scoring counts named and indirect mentions, including dialogue. Crossing as an activity or an unattached rope alone does not count as the ferry; a raft, boat, ferry, or its expressly identified parts does. An entry being present in a summary does not satisfy the full-entry requirement. These are twelve paired cases in one world on one model, not evidence of a general preference or statistically established regression.

## Decision

Do not automatically extend this run to `get_entity(name)`: required retrieval and completion held, but every-mention coverage did not meet the protocol's non-regression condition. The harness supports that variant and its dispatch is tested offline; no parameter-name model batch ran.

The proposed later description-format comparison should include **Output** in both arms, with equivalent content. Separate the effect of adding output information from the effect of formatting it as labeled documentation. No description-format run is included here.

## Evidence and checks

- Model: `g4-meromero-v2-31b-i1`, thinking enabled, matching loaded metadata, two fixed seeds per scenario, 1,024-token completion cap, no retries or cap increases.
- [Baseline raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-section-definitions-batch-2026-09-22T19-48-05-005Z.json), [header raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-header-batch-2026-09-22T20-05-49-662Z.json), [tool raw batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-tool-batch-2026-09-22T20-10-40-611Z.json).
- Reversing only the intended rename restores complete request equality. Actual initial requests match prepared requests. Each comparison preserves 24 narrations; header and tool comparisons preserve 40 and 43 thinking responses respectively.
- Focused tests: 50 passed in 5.055 seconds. Shared probe coverage: 97% statements/lines, 88.64% branches, 100% functions. Hardcoding the old dispatcher name fails both renamed-tool integration cases in 2.342 seconds; source restoration was verified.
- Application typecheck: exit 0 in 15.688 seconds. Harness typecheck: exit 0 in 2.275 seconds. Lint: exit 0 in 14.492 seconds, existing Fast Refresh warning.
- Full suite: 12,555 passed, three skipped, exit 0 in 92.912 seconds. Build: exit 0 in 17.225 seconds, existing bundle-size warning. Graph refresh: exit 0 in 110.410 seconds.
- Changelog updated. Application prompts, defaults, export shapes, and version are untouched. Cached fixtures remain unchanged as requested; per-turn lookup remains the intended application direction.
