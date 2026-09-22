# Retrieve before mentioning: results

> Interpretation caveat: the tested tool description contains “the ferryman,” a role in this fixture. The [example-removal control](no-example-protocol.md) tests that confound separately. These results do not establish fixture-independent behavior.

**The new tool description improved retrieval for the main participants, but did not reliably cover every mention.** Seven of eight cases needing new lore retrieved all action-required entries, compared with three before. One of those seven then ran out of output tokens, leaving six completed narrations with their action-required new lore.

[Narration comparison](mention-tool-outputs.md) · [Thinking separately](mention-tool-thinking.md) · [Exact request wording](mention-tool-prompt.md) · [Per-case mention audit](mention-tool-review.csv) · [Protocol](mention-tool-protocol.md)

Only the lookup tool description changed. Both arms retain the minimal narrator prompt and entity `summary` labels. The twelve saved summary-label trials are the baseline.

## Measurements

| Metric | Previous tool description | Mention-triggered description |
|---|---:|---:|
| Cases retrieving all action-required new lore | 3/8 | 7/8 |
| Those cases also completing narration | 3/8 | 6/8 |
| Action-required individual entries fetched | 4/10 | 9/10 |
| New lookup calls | 4 | 9 |
| Completed narrations | 12/12 | 11/12 |
| Completed with every mentioned entity loaded | 4/12 | 5/12 |
| Cached-Bram controls avoiding a repeat lookup | 2/2 | 2/2 |
| Reasoning tokens, all requests | 4,317 | 4,743 |
| Average words in completed narrations | 201.4 | 190.1 |
| Batch time | 264.636 s | 274.505 s |

The word averages use different completion counts; the candidate's partial narration is excluded from that average. Reasoning totals include tool rounds and the failed response. All nine new calls targeted required, uncached entries. No cap increases or model retries were used.

| Case | Run 1 new lookups | Run 2 new lookups |
|---|---|---|
| Greet both | Bram, Odette | Bram, Odette; narration cut off |
| Inspect Odette | Odette | Odette |
| Inspect ferry | None | Rope Ferry |
| Quiet observation | None | None |
| Ask Bram, entry supplied | None needed for Bram | None needed for Bram |
| Greet both, Bram supplied | Odette | Odette |

## Remaining failures

- **Incidental references escape retrieval.** Both mixed-cache narrations fetch Odette but subsequently mention the ferry without its entry. The second cached-Bram narration adds a “listing raft” without fetching it. These fail the new mention contract even though their main character information is available.
- **Quiet scenes still mention entities without fetching them.** The first candidate explicitly refers to the ferryman and woman. The second mentions both characters and the ferry. Its recorded planning treats background presence as sufficient reason to skip lookup, despite the tool's broader wording.
- **One direct inspection still skips lookup.** The first ferry case relies on the supplied short information and invents construction details. The second retrieves the full entry and uses its tar-black rope and two-person capacity.
- **Delivery regressed in one case.** The second greeting fetches both characters, then spends 745 tokens on thinking in its final request. That request reaches the unchanged 1,024-completion-token cap and stops mid-narration (`finish_reason: length`). The incomplete prose is retained and labeled in the comparison. Its thinking includes repeated dialogue alternatives; retrieval success does not make that trial an overall success.

The result supports a narrower conclusion than “any mention now works”: this wording prompted more lookups for directly involved entities in this batch. It did not establish the requested predictable boundary, and it does not establish cross-model reliability. No further prompt changes were made after observing these results.

## Mention scoring

The audit counts references in final narration and dialogue to Bram, Odette, and Rope Ferry, whether by name or description (ferryman, woman, eel-smoker, raft, boat). It also counts the baseline's collective “figures waiting nearby” as referring to the two listed people. Excluding that ambiguous collective reference would raise the baseline to 5/12, leaving no improvement on this strict metric. Discussion of crossing as an activity or pulling rope alone is not treated as an explicit reference to the ferry object.

Entries supplied in cached tool history count as available. Mentions in thinking alone do not count. The partial candidate output is inspected for missing entries but cannot count as a completed success. The two quiet cases are no longer scored as successful merely because they make no calls: their actual mentions determine whether retrieval was needed.

The user's intended app design remains **per-turn lookup without retaining prior-turn tool calls**. These fixtures retain their cached cases by explicit instruction; this probe does not implement or validate cross-turn retention.

## Evidence and verification

- [Raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-summary-label-batch-2026-09-22T18-52-46-286Z.json) and [raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-mention-tool-batch-2026-09-22T19-12-21-871Z.json). Model: `g4-meromero-v2-31b-i1`; loaded metadata matched.
- Offline validation checked all twelve cached requests and proved candidate equality after restoring only the original tool description. Review artifacts preserve all 24 returned narration texts, including the partial response, and all 34 thinking responses.
- Application typecheck passed in 14.985 seconds; harness typecheck passed in 2.235 seconds. Lint passed in 13.742 seconds with the existing Fast Refresh warning. Build passed in 17.555 seconds with the existing bundle-size warning.
- **Full test gate failed:** 12,548 passed, one failed, three skipped; exit 1 in 92.072 seconds. `SettingsModal.quoteColor.test.tsx:65` failed waiting for Escape to close the popup, the same unrelated failure observed in prior probe work. No application or popup-test code was changed, and the suite was not rerun for a green result.
- Graph refresh completed in 128.231 seconds. Changelog updated. Application prompts, export shapes, defaults, and version are unchanged. The model experiment is complete; the code change remains uncommitted because the full gate is red.
