# Retrieve before planning: results

**The ordering sentence reduces thinking before retrieval, but worsens coverage of entities introduced in narration.** All ten required-retrieval cases and all four professional-selection cases still succeed. This is a useful timing result, not an overall prompt improvement.

[Narration only](selection-retrieve-first-outputs.md) · [Thinking only](selection-retrieve-first-thinking.md) · [Exact prompts](selection-retrieve-first-prompt.md) · [Mention audit](selection-retrieve-first-review.json) · [Per-request reasoning measurements](selection-retrieve-first-stages.json) · [Protocol](selection-retrieve-first-protocol.md)

## Isolated change

Replace the inclusion description's first Use when sentence with:

> Once you identify an entity to include, retrieve its full entry before planning its portrayal, unless already loaded for this response.

Everything else remains fixed, including Purpose, the scope of inclusion, Input, Output, minimal system prompt, expanded fixture, actions, seeds, and model settings. The direct comparison uses the twelve saved inclusion responses; only the twelve new candidates were run. The original control is included below as a secondary reference.

## Thinking before and after retrieval

These totals use the same ten cases requiring new entity information. All three arms retrieve their required entries on the first request and narrate on the second, so no missing lookup is miscounted as efficient retrieval. Counts come from reported reasoning-token usage, not estimates from text length.

| Reasoning tokens | Original control | Inclusion baseline | Retrieve before planning |
|---|---:|---:|---:|
| Before receiving entity information | 1,291 | 1,953 | **1,139** |
| After receiving entity information | 2,370 | 2,061 | **1,861** |
| Total for these ten cases | 3,661 | 4,014 | **3,000** |

Pre-lookup reasoning falls **41.7%** against the direct baseline and 11.8% against the original control. Seven paired cases decrease; three increase. Post-lookup reasoning falls 9.7% against the direct baseline. The effect is not just shifting work into the later request.

The first Odette case falls from 222 to 41 pre-lookup tokens; the first ferry inspection from 321 to 51; the second greeting from 312 to 48. Their traces identify the target and request its details without the earlier extended sufficiency debate. Other cases still outline parts of the narration before calling, particularly the first cobbler case, which rises from 96 to 207 tokens.

Quiet observations are excluded from this matched ten-case timing measure. The candidate makes no calls in either: the first uses 302 reasoning tokens and avoids entity mentions; the second uses 297 and introduces four unfetched entities. The latter explicitly treats generic background references as possible from summaries, despite the tool description. Both traces remain in the artifacts.

## Retrieval and narration coverage

| Metric | Inclusion baseline | Retrieve before planning |
|---|---:|---:|
| Required retrieval | 10/10 | 10/10 |
| Correct professional selection and retrieval | 4/4 | 4/4 |
| Completed narrations | 12/12 | 12/12 |
| Every explicit entity reference covered | 10/12 | **6/12** |
| Every mention covered, conservative collectives | 9/12 | **5/12** |
| Explicit character references covered | 10/11 | 10/17 |
| Object references covered | 3/4 | 2/7 |
| Lookup calls | 13 | 12 |
| Retrieved entries unused in narration | 0 | 0 |
| Total reasoning, all twelve cases | 4,736 | 3,599 |
| Mean narration words | 190.9 | 168.7 |

All candidate calls are valid and return matches. References are unique entities per narration; repeated mentions do not inflate the count. The extra conservative failure is the second healer scene's ambiguous “small group.” Explicit-only scoring excludes that collective. The candidate still misses six cases without any collective-reference interpretation:

- Both greetings mention the unfetched ferry.
- The first cobbler scene mentions the unfetched healer, basketmaker, and ferry.
- The second Odette scene adds a glance at the unfetched ferry.
- The second quiet observation describes the unfetched cobbler, healer, basketmaker, and ferry.
- The second cobbler scene scans past the unfetched ferryman and eel-smoker.

The first quiet observation improves by omitting the unfetched cobbler. That gain is outweighed by new background references elsewhere. Reduced planning before the first call does not demonstrate reliable selection of everything that will appear later.

## Factual review and interpretation

One loaded-entry portrayal departs from an authored habit: the second Odette response counts the eels once, again, then explicitly a third time, while her entry says she counts everything twice. This is flagged separately as an authored-habit departure, rather than an immutable physical contradiction. No direct contradiction of a fixed physical entity fact was found. As before, neither fact retrieval nor valid calls guarantee faithful narration.

The user's timing observation is supported by the measured split: the ordering sentence can move these cases toward a shorter identify-and-fetch sequence. The same run does not solve prospective coverage. These are separate outcomes to preserve in further decisions; this small single-model sample does not establish that faster retrieval causes the coverage regression.

## Evidence and checks

- [Raw candidate and embedded cached baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-retrieve-first-batch-2026-09-23T04-11-20-893Z.json). Model `g4-meromero-v2-31b-i1`, seeds 424243/424244, thinking enabled, unchanged 1,024-token cap and transport. No retries, truncations, or cap increases.
- Twelve live candidates took **244.649 seconds (4 minutes 5 seconds)**. Cached baseline timing is historical, not part of that duration. Tokens provide the stage-work comparison; request wall times also include inference overhead.
- Complete cached request equality and loaded-model metadata checks pass. Actual initial requests match preparation. Artifacts preserve all 24 narration texts and 45 thinking responses separately.
- Forcing the wrong cached arm fails the intended request guard in 15.765 seconds; source restored byte-for-byte.
- Focused fixture tests: 2 passed in 5.102 seconds. Fixture coverage: 100% statements, branches, functions, and lines. CLI preparation/live paths are directly exercised and not included in that coverage percentage.
- Application typecheck: exit 0 in 16.161 seconds. Harness typecheck: exit 0 in 2.718 seconds. Lint: exit 0 in 15.620 seconds, existing Fast Refresh warning.
- Full suite: **12,557 passed, three skipped, exit 0 in 101.121 seconds**. Build: exit 0 in 17.803 seconds, existing bundle-size warning. Graph refresh: exit 0 in 138.749 seconds.
- Changelog updated. Production prompts, defaults, shared fixture, exports, and version remain unchanged.
