# Remove the fixture-specific example: results

**Without the example, seven of eight action-required retrieval cases succeeded, versus eight with it. All twelve narrations completed. The every-mention score remained five of twelve.** The missed required lookup is the first Rope Ferry inspection; the character retrieval cases continue to fetch their required entries.

[Narration comparison](no-example-outputs.md) · [Thinking separately](no-example-thinking.md) · [Exact corrected request](no-example-prompt.md) · [Mention audit](no-example-review.csv) · [Protocol](no-example-protocol.md)

Only one phrase in the tool description changes:

- With fixture example: `including indirect references such as “the ferryman.”`
- Without fixture example: `whether by name or indirect reference.`

The single Entity definition, summary labels, minimal narrator prompt, cached cases, model, seeds, schema, and caps remain unchanged. No other section definitions were added. Historical outputs retain their original wording, with interpretation caveats added to the earlier findings.

## Measurements

| Metric | With fixture example | Without fixture example |
|---|---:|---:|
| Action-required retrieval cases fulfilled | 8/8 | 7/8 |
| Those cases also completing narration | 8/8 | 7/8 |
| Action-required individual entries fetched | 10/10 | 9/10 |
| New lookup calls | 10 | 9 |
| Completed narrations | 12/12 | 12/12 |
| Completed with every mentioned entity loaded | 5/12 | 5/12 |
| Reasoning tokens, all requests | 4,268 | 4,001 |
| Average narration words | 176.2 | 181.3 |
| Batch time | 253.813 s | 247.987 s |

Both greeting cases fetch Bram and Odette; both Odette inspections fetch her; both mixed-cache cases fetch Odette without repeating Bram. The second ferry inspection fetches Rope Ferry. All nine new calls target required, uncached entries. No retries or cap increases.

## Interpretation

The cue's removal did not eliminate the observed retrieval behavior. It also did not fix background mentions: both greetings mention the raft/ferry without its entry, both quiet scenes mention entities without lookup, the second cached-Bram response mentions the ferry, and the second mixed-cache response does likewise.

The strict score stays flat through different outcomes: the first cached-Bram and mixed-cache responses now omit explicit ferry references and pass, while the first ferry inspection and quiet observation fail. Mention scoring uses the prior distinction between explicit entity references and merely pulling rope or discussing crossings as activities. The per-case audit preserves those decisions.

This is a small same-world comparison, not evidence that the example had no effect or that either wording generalizes. The concrete example was inappropriate for this fixture regardless of its measured effect. Future comparisons should use the corrected wording as their baseline. Broader reliability remains unproven.

## Evidence and checks

- [Raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-no-example-batch-2026-09-22T19-39-09-124Z.json) and [raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-definition-batch-2026-09-22T19-26-11-325Z.json). Model: `g4-meromero-v2-31b-i1`; loaded metadata matched.
- Offline checks reconstructed all twelve baseline requests and proved complete equality after restoring only the changed tool description. Actual candidate initial requests match prepared requests. Review documents preserve all 24 narration texts and 39 thinking responses verbatim.
- Application typecheck passed in 14.951 seconds; harness typecheck in 2.262 seconds; lint in 13.645 seconds with the existing Fast Refresh warning.
- Full suite: **12,550 passed, three skipped, exit 0 in 91.434 seconds**. Build passed in 17.597 seconds with the existing bundle-size warning. Graph refresh completed in 114.875 seconds.
- Changelog updated. Application prompts, export shapes, defaults, version, and cross-turn retention behavior remain unchanged.
