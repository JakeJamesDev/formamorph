# Entity definition: results

> Interpretation caveat: both arms retain a tool-description example, “the ferryman,” that appears in the fixture. The definition comparison holds it constant, but does not establish behavior without that cue. See the [example-removal control](no-example-protocol.md).

**The diagnostic found a vocabulary mismatch. Adding the definition improved the action-required retrieval result in this batch, without increasing aggregate thinking. It did not improve coverage of every incidental mention.**

[Diagnostic answers](entity-diagnostic-answers.md) · [Narration comparison](entity-definition-outputs.md) · [Narration thinking](entity-definition-thinking.md) · [Exact candidate prompt](entity-definition-prompt.md) · [Mention audit](entity-definition-review.csv) · [Protocol](entity-definition-protocol.md)

## Vocabulary diagnostic

Both independent answers correctly include Bram, Odette, and Rope Ferry, but also include **gloamwater**, which is supplied as foreground lore rather than an Entity record. One answer's general definition includes places; neither explicitly lists Sedge Landing. Both complete without calling a tool. The diagnostic takes 26.783 seconds across two seeds.

The schema describes Entity as a character or object and permits a free-text type; GameLocation is separate. The diagnostic therefore demonstrates an explanation-level mismatch. It does not establish that this mismatch caused the earlier missed calls, or that adding the definition completely repairs the model's understanding.

## Definition-only narration probe

The only addition, immediately below the entity-list heading, is:

> An entity is a character, creature, or object listed in the entity summaries.

The baseline is the latest mention-triggered tool description, not the earlier summary-label experiment. The tool, minimal narrator instruction, summary labels, cached fixtures, model settings, and response limits remain unchanged. Diagnostic answers are never included in the narration requests.

| Metric | Without definition | With definition |
|---|---:|---:|
| Cases retrieving all action-required new lore | 7/8 | 8/8 |
| Those cases also completing narration | 6/8 | 8/8 |
| Action-required individual entries fetched | 9/10 | 10/10 |
| New lookup calls | 9 | 10 |
| Completed narrations | 11/12 | 12/12 |
| Completed with every mentioned entity loaded | 5/12 | 5/12 |
| Reasoning tokens, all requests | 4,743 | 4,268 |
| Average words in completed narrations | 190.1 | 176.2 |
| Batch duration | 274.505 s | 253.813 s |

Reasoning fell by about 10% despite the extra lookup. This is an observed batch total, not proof that definitions always reduce thinking. The baseline average uses eleven completed narrations and the candidate uses twelve. All ten candidate calls fetched action-required, uncached entries; neither cached-Bram control repeated his lookup. Both direct ferry inspections now fetch Rope Ferry.

## Why the strict mention score stayed flat

- **New successes:** the first ferry inspection retrieves its entry, and the first quiet observation omits the listed entities entirely. Neither passed the mention contract in the baseline.
- **New misses:** the first greeting now adds a raft reference without fetching it; the first cached-Bram narration does likewise. Those baseline outputs did not mention the ferry.
- **Persistent misses:** both mixed-cache greetings and the second greeting refer to the ferry without loading it. The second quiet scene mentions the ferry, and the second cached-Bram scene adds both Odette and the ferry without their entries.

The definition helps distinguish categories in some recorded thinking: the second quiet case lists the three entities separately from location and lore. But the first quiet case still reasons in terms of direct interaction, and the second cached-Bram case plans to mention Odette without retrieving her. Correct categorization does not guarantee the model applies the tool rule to every detail it later writes.

The definition also does not enforce world consistency by itself. The first quiet narration gives the water a sound before describing its absolute silence. That is a separate observed continuity issue, not a retrieval failure or a reason to discard the case.

The audit uses the same rules as the previous experiment: explicit names and indirect references in narration or dialogue count, including raft/ferry references. Crossing as an activity or loose mooring rope alone does not identify the ferry object. Mentions in thinking alone do not count. Cached entries remain available by explicit test design; the intended app design still uses per-turn lookup.

## Evidence and checks

- Model: `g4-meromero-v2-31b-i1`; loaded metadata matched the baseline. [Raw diagnostic](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-diagnostic-batch-2026-09-22T19-24-36-931Z.json), [raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-entity-definition-batch-2026-09-22T19-26-11-325Z.json), and [raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-mention-tool-batch-2026-09-22T19-12-21-871Z.json).
- Offline comparison verifies complete request equality after reversing only the definition insertion or diagnostic question substitution. Actual candidate initial requests match prepared requests. No retries or cap increases. All paired narration text is preserved, including the baseline's partial response; thinking is separate.
- Focused tests: 45 passed in 5.186 seconds. Shared probe coverage: 96.83% statements/lines, 87.37% branches, 100% functions. Disabling the definition insertion failed its new guard in 2.203 seconds; source restoration was verified.
- Application typecheck passed in 14.788 seconds; harness typecheck in 2.244 seconds; lint in 16.474 seconds, with the existing Fast Refresh warning.
- Full suite: **12,550 passed, three skipped, exit 0 in 94.200 seconds**. This also clears the prior probe's outstanding gate. Build passed in 17.568 seconds with the existing bundle-size warning. Graph refresh completed in 109.608 seconds.
- Changelog updated. Application prompts, export shape, defaults, and version remain untouched. This is a one-model, one-world diagnostic; 8/8 on these actions is not a production reliability estimate.
