# Combined entity tool changes

The combined package completes every narration and retrieves all action-required entries, but it covers fewer of the entities actually mentioned: **3/12 versus 8/12**. It is not an improvement on the full retrieval contract in this batch.

[Narration only](entity-full-outputs.md) · [Thinking only](entity-full-thinking.md) · [Exact candidate prompt](entity-full-prompt.md) · [Mention audit](entity-full-review.csv) · [Protocol](entity-full-protocol.md)

## What changed

The candidate combines `Entities in the Current Location`, `get_entity(name)`, and a labeled description with Purpose, Use when, Input, and Output. Output describes the actual matches array and the empty result. The minimal narrator instructions and section definitions remain unchanged. No world-specific examples were added.

## Results

| Metric | Saved baseline | Combined changes |
|---|---:|---:|
| Cases fetching all action-required new lore | 8/8 | 8/8 |
| Action-required individual entries fetched | 10/10 | 10/10 |
| Completed narrations | 12/12 | 12/12 |
| Every mentioned entity loaded | 8/12 | 3/12 |
| Invalid tool calls | 0 | 0 |
| New lookup calls | 10 | 12 |
| Reasoning tokens, all requests | 3,507 | 3,258 |
| Average narration words | 172.0 | 178.3 |
| Batch duration | 230.874 s | 236.232 s |

Thinking fell 7.1%. All twelve lookup calls use the correct function and parameter, return matches, and complete normally. Two extra lookups fetch both people during the second quiet-observation scene. No cached-Bram lookup is repeated.

## What still fails

Eight outputs mention the ferry without retrieving it. The other failing output refers collectively to nearby people without retrieving either character. Excluding that ambiguous collective would raise coverage to 4/12, still below the baseline. Both ferry inspections and the second Odette interaction pass.

The first Odette response retrieves her entry, then places her between the player and the ferry. The second quiet observation retrieves both people, then positions the man beside the unfetched ferry. These are valid calls followed by incomplete coverage, not syntax failures.

The recorded thinking explicitly selects Odette for lookup before describing her appearance. My interpretation is that retrieval remains focused on the requested interaction, while background references enter during narration. The trace supports that interpretation, but does not prove the model's internal cause. Full traces and prose are preserved for review.

Mention scoring includes names, indirect references, and dialogue. A raft, boat, ferry, or expressly identified part counts; crossing as an activity and unattached rope alone do not. A summary does not satisfy the full-entry requirement. See the audit for each case's counted mentions and available entries.

## Limits and next decision

This is a combined package on one world and one model, with two seeds per scenario. It does not isolate documentation formatting, Output information, header wording, or parameter naming. These results do not establish that docstring descriptions are generally worse. A format-only comparison would keep all information equivalent in both arms.

Keep the production prompts unchanged. The remaining behavior to address is retrieval for entities introduced while composing the scene. The current run provides no reason to add more syntax guidance.

## Evidence and validation

- Model: `g4-meromero-v2-31b-i1`, matching loaded metadata; thinking enabled, same seeds and limits, no retries or cap increases. [Raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-full-batch-2026-09-22T20-20-39-880Z.json) · [Raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-section-definitions-batch-2026-09-22T19-48-05-005Z.json).
- Complete request equality passes after reversing the intended changes; all actual requests match preparation. Documents preserve 24 narration texts and 41 thinking responses verbatim.
- Removing the candidate parameter rename triggers the intended preparation guard (30.036 seconds); source restored byte-for-byte. The first mutation attempt was blocked before subprocess execution by the sandbox and restored the source too.
- Focused suite: 50 passed in 5.008 seconds; shared probe coverage 97% statements/lines, 88.64% branches, 100% functions. CLI preparation and live branches are exercised directly, not included in that coverage percentage.
- Application typecheck: exit 0 in 15.089 seconds. Harness typecheck: exit 0 in 2.212 seconds. Lint: exit 0 in 14.148 seconds, existing Fast Refresh warning.
- Full suite: 12,555 passed, three skipped, exit 0 in 97.185 seconds. Build: exit 0 in 18.300 seconds, existing bundle-size warning. Graph refresh: exit 0 in 139.232 seconds.
- Changelog updated. Application prompts, defaults, exports, version, and cached fixture behavior remain unchanged. This is experimental evidence, not cross-model release validation.
