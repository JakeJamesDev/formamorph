# Demonstrated continuation: results

**The demonstration changes the outputs, but does not consistently establish its concise reasoning pattern.** Compared with no supplied reasoning pattern, five continuations use less reasoning and five use more. Narration becomes shorter and includes fewer unfetched entities. The strongest remaining counterexample is the first healer case, which reconstructs the candidate list and outlines the same action twice.

[Narration only](selection-example-outputs.md) · [Thinking only](selection-example-thinking.md) · [Prompts and exact demonstration](selection-example-prompt.md) · [Protocol](selection-example-protocol.md) · [Mention audit](selection-example-review.json) · [Stage measurements](selection-example-stages.json)

## What the model receives

All comparison documents and derived audits use these labels:

- **A — Original reasoning replayed:** the saved appearance-prerequisite run.
- **B — No prior reasoning:** the saved reasoning-omission run.
- **C — Demonstrated pattern:** new continuations with the same omission, plus an authored example from a separate story.

The example is a native user → assistant lookup → tool result → assistant narration sequence placed before the current player action. It selects an observatory archivist, Ysra, then applies her requirement for supervised access to an atlas. The post-result reasoning is one sentence connecting that new constraint to her response. It supplies no answer or entity from the test world.

Each actual first response is reused exactly. Consequently this measures continuation after retrieval, not first-call selection or behavior over later story turns. Quiet cases are unchanged controls because they have no continuation. Initial prompts, tool definitions, real results, model metadata, seeds, and caps remain fixed. The demonstration adds 212 server-reported input tokens to each first continuation.

The server does include the demonstration's reasoning in its input accounting: two one-token diagnostic requests differ only by retaining/removing the two example reasoning fields, yielding **1,276 versus 1,236 input tokens**. The 40-token difference verifies that the reasoning fields affect effective input; the exact rendered template was not inspected. These diagnostics are separate from the ten normal-cap behavioral trials. [Diagnostic requests and responses](selection-example-token-check.json)

## Results

| Metric | A: original reasoning | B: no prior reasoning | C: demonstration |
|---|---:|---:|---:|
| Completed narrations | 12/12 | 12/12 | 12/12 |
| Post-lookup reasoning tokens | 1,913 | 2,227 | 2,171 |
| Total reasoning including reused first responses | 3,526 | 3,840 | 3,784 |
| Every explicit entity covered | 6/12 | 7/12 | 9/12 |
| Every mention covered, conservative collectives | 6/12 | 7/12 | 8/12 |
| Duplicate lookups | 1 | 0 | 0 |
| Complete narration drafts in thinking | 1 | 0 | 0 |
| Mean narration words | 174.6 | 187.4 | 148.3 |

The ten action-required cases retain their selected entries by construction. C makes no additional calls. Coverage improves by leaving out unfetched background references, not by learning broader retrieval. Against B, post-lookup reasoning decreases 2.5% and narration length decreases 20.9%; reasoning remains 13.5% higher than A. These small samples do not isolate an effect of example wording, length, placement, or its short narration style.

## Qualitative reasoning review

| Case / seed | B → C reasoning tokens | What changed |
|---|---:|---|
| Greeting / 424243 | 220 → 302 | Still inventories world rules, character traits, player condition, and response plan. Adds a relevant inference about names near gloamwater, but does not follow the example's brief transition. |
| Odette / 424243 | 246 → 273 | Uses retrieved appearance and distrust appropriately, while retaining fact lists, player traits, a restated action, and a response outline. |
| Ferry / 424243 | 296 → 91 | A focused paragraph recognizes retrieval as complete, selects the raft's relevant properties, and proceeds to narration. A local improvement toward the demonstrated structure. |
| Healer / 424243 | 160 → 350 | Rebuilds the profession list despite having Mara's result, inventories facts, writes a five-step plan, then repeats approach/request under “Let's refine the action.” This is redundant reconstruction mixed with useful treatment details. |
| Cobbler / 424243 | 55 → 221 | The efficient B continuation becomes a longer state inventory and repeated action plan. Retrieved inspection behavior is still used. |
| Greeting / 424244 | 293 → 182 | More compact: connects the naming rule to the response, selects character facts, and proceeds. Still includes player/location recap. |
| Odette / 424244 | 374 → 235 | Uses appearance and distrust; cuts the broader inventory but retains lists and a three-part outline. |
| Ferry / 424244 | 159 → 126 | Retains a relevant entry summary and brief narration intention. A modest reduction, not wholesale adoption of the example. |
| Healer / 424244 | 216 → 151 | Uses the treatment method, but repeats noticing, finding, approaching, and asking as a plan. |
| Cobbler / 424244 | 208 → 240 | Recognizes retrieval as complete and uses inspection before price. Still lists location, player state, possible background characters, and five narration steps. |

The example is neither uniformly ignored nor reliably copied. The sharper ferry continuation is encouraging; the longer healer and cobbler continuations prevent treating it as an established reasoning pattern.

## Narration, coverage, and contamination

Neither returned narration nor newly generated thinking contains Ysra, archivist, observatory, atlas, indigo, or supervision wording. Manual review found no clear transfer of the example's access restriction into this world. Shorter narration may reflect the example's short answer, but no length-matched control isolates that influence.

The first greeting still describes the unfetched ferry. The second greeting avoids a physical ferry reference; statements about running the rope/crossing are occupational activities under the existing audit rules. The second Odette response no longer adds the ferry. The second cobbler introduces an ambiguous “small crowd,” so it passes explicit coverage but fails conservative collective coverage. The two quiet failures are reused unchanged.

No direct contradiction of a fixed authored entity fact was found. Two prose issues remain: “meeting your eyes with a scarred cheek” in the first greeting, and wording that makes the two-person capacity sound like a balancing requirement in the second ferry scene. The second healer helps without explicitly narrating the requested verbal ask. These remain separate from retrieval correctness and token efficiency.

## Interpretation

This is evidence that supplying an example can shape the response, especially its length and included details. It is not yet evidence that the specific desired reasoning sequence has become stable. The measured result is mixed and does not settle the broader pattern-conditioning hypothesis.

No multi-turn persistence claim is supported: the demonstration appears anew in each isolated continuation. The next design choice belongs to review of this example and its results, rather than automatically adding more examples or instructions.

## Evidence and checks

- [Raw two-arm continuation batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-example-batch-2026-09-23T05-45-09-595Z.json): **10 live continuations in 114.414 seconds (1 minute 54 seconds)**. In this raw file only, A is the direct no-reasoning baseline and B is the new demonstration arm; the linked three-way documents normalize labels to A/B/C above.
- Same `g4-meromero-v2-31b-i1` metadata, seeds 424243/424244, thinking enabled, and 1,024-token behavioral cap. No retries. First requests are identical; removing the example and normalizing IDs recovers the exact cached first continuation.
- Comparison artifacts preserve 36 narrations and 67 reasoning responses, including cached controls. Demonstration text is labeled authored example content, not presented as model-generated evidence.
- Focused suite: **55 passed in 5.250 seconds**. Shared probe coverage: 97.05% statements/lines, 89.58% branches, 100% functions. Example module: 100% throughout. CLI paths are exercised directly, outside coverage measurement.
- Disabling demonstration insertion fails its new test in **2.270 seconds**; byte-for-byte restoration verified. The test also checks that examples do not repeat across follow-ups, their reasoning survives real-history omission, and tool-result correlations remain valid.
- App typecheck: exit 0, 17.319 seconds; harness typecheck: exit 0, 2.149 seconds; lint: exit 0, 15.587 seconds, existing Fast Refresh warning.
- Full suite: **12,560 passed, three skipped, exit 0 in 88.909 seconds**. Build: exit 0 in 22.487 seconds, existing bundle-size warning. Changelog updated. Production prompts, export shapes, defaults, and version remain unchanged.
- Code graph refreshed, exit 0 in 89.110 seconds.
