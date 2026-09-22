# Example reasoning style with narration fixed

**Reasoning examples show a structural influence in this batch.** With the demonstration's final narration unchanged, the expanded inventory-and-planning example increases the literal “Narration plan:” heading from 1/10 to 5/10 live continuations and broad inventories of unrelated entities from 1/10 to 4/10. This supports sensitivity to the example's reasoning, but does not establish reliable control or a general preference.

[Narration only](selection-expanded-example-outputs.md) · [Thinking only](selection-expanded-example-thinking.md) · [Exact prompts and both examples](selection-expanded-example-prompt.md) · [Protocol](selection-expanded-example-protocol.md) · [Mention audit](selection-expanded-example-review.json) · [Reasoning stages](selection-expanded-example-stages.json)

## Comparison

- **A — Concise example reasoning:** saved demonstration run.
- **B — Expanded example reasoning:** new continuations, with only the demonstration's two reasoning fields expanded.

The demonstration user request, entity summary, tool call, full entry, and final narration are identical. Its expanded reasoning inventories the available facts, identifies the target, and lays out a narration plan. It adds no new story facts. Both variants retain real tool results and omit the real scene's earlier reasoning. Example placement, first-response replay, model metadata, seeds, and limits remain fixed.

The initial scene response is reused exactly; two quiet cases have no continuation and remain unchanged controls. This is ten new continuations, not twelve independent reruns. The experiment varies reasoning style and length together; it does not isolate either component or demonstrate multi-turn persistence.

## Results

| Measure | A: concise reasoning | B: expanded reasoning |
|---|---:|---:|
| Live continuations completed | 10/10 | 10/10 |
| Post-lookup reasoning tokens | 2,171 | 2,359 |
| Literal “Narration plan:” heading | 1/10 | 5/10 |
| Broad non-target entity inventories | 1/10 | 4/10 |
| Every explicit entity covered, all cases | 9/12 | 9/12 |
| Every mention covered, conservative collectives | 8/12 | 9/12 |
| Duplicate lookups | 0 | 0 |
| Complete narration drafts in thinking | 0 | 0 |
| Mean narration words, all cases | 148.3 | 129.9 |
| Authored-habit departures flagged | 0 | 1 |

Post-lookup reasoning rises **8.7%**, with six increases and four decreases. Narration becomes **12.4% shorter**, despite identical demonstration narration. Longer example reasoning therefore does not simply produce longer text in both channels. No completion reaches a truncation failure.

The expanded example adds **265 server-reported prompt tokens** to every first continuation. The complete requests are equal after removing reasoning fields; the token difference therefore comes from those changed fields. Required retrieval and professional selection are fixed by the reused first responses and are not new evidence of model performance.

“Broad inventory” means the generated post-lookup reasoning enumerates at least three listed entities outside the action-required target(s). This is an exploratory content classification, not a pre-registered statistical endpoint. A has the first healer case; B has the first cobbler, second ferry, second healer, and second cobbler. The exact heading count is a literal-text measurement. Both indicate structure, not correctness or useful work by themselves.

## What the continuations actually do

| Case / seed | A → B reasoning tokens | Interpretation |
|---|---:|---|
| Greeting / 424243 | 302 → 260 | Both use character traits and the naming rule. B still restates intended reactions under separate response/narration outlines; shorter does not mean repetition disappeared. |
| Odette / 424243 | 273 → 136 | B keeps relevant appearance and distrust, then directly connects them to observing her and a guarded reply. A productive simplification despite the more verbose example. |
| Ferry / 424243 | 91 → 202 | A's focused paragraph becomes retrieved-fact bullets, location/player recap, and a four-step “Narration plan.” Retrieved facts are still used, but structure expands. |
| Healer / 424243 | 350 → 173 | B drops the full candidate inventory and second outline. It selects the treatment facts and gives one scene sequence. This improves on A's redundant reconstruction. |
| Cobbler / 424243 | 221 → 330 | B lists all professions, outlines the action, lists Iven and player details, then outlines the action again under “Narration plan.” This is a clear increase in redundant preparation. |
| Greeting / 424244 | 182 → 247 | B inventories both characters, applies the naming rule, and adds a five-step plan that repeats the decision not to reveal names. |
| Odette / 424244 | 235 → 219 | Both select scar/bead and distrust. B's outline is slightly more compact; no strong qualitative difference. |
| Ferry / 424244 | 126 → 220 | B adds a list of unrelated people and player/location/lore recap before its plan. This is broader inventory without helping answer capacity/construction. |
| Healer / 424244 | 151 → 320 | B rebuilds the profession inventory, lists Mara's returned facts and player stats, then plans the approach/treatment. Some new-fact application is useful; reselecting the already fetched healer is redundant. |
| Cobbler / 424244 | 240 → 252 | Both use inspection-before-price and plan the approach. B explicitly inventories all nearby professions; the overall token difference is small. |

The strongest evidence is the increased use of a demonstrated heading and broader inventories with narration held fixed. The counterexamples matter: first Odette and first healer become more focused, so this is influence rather than a deterministic template. The token increase alone would be weaker evidence than these structural changes.

## Narration and fidelity

Explicit coverage stays 9/12: the first greeting still includes the unfetched boat/ferry, and both quiet failures are unchanged. Conservative coverage rises because the second cobbler no longer introduces a “small crowd.” No new retrieval occurs. Avoiding an ambiguous crowd is a narration choice, not proof of improved retrieval judgment.

The second greeting explicitly has Odette count a third time after counting and doing it again, departing from her authored habit of counting twice. This is a habit departure, not an immutable physical contradiction. No direct contradiction of a fixed physical entity fact was found. The first healer and second cobbler substitute showing/gesturing for the player's explicit verbal request; action fidelity is separate from entity retrieval.

Neither new narration nor new thinking contains Ysra, archivist, observatory, atlas, indigo, or supervision wording. Manual review found no clear transfer of the example's access restriction. The recognizable transfer is organizational structure, not story content.

## Interpretation

This weakens the idea that reasoning is simply insensitive to examples while narration is the only channel that follows patterns. Reasoning structure does respond in this sample, though much less consistently than a strict output format would require. It does not establish that a compact example will reliably suppress inventories, that more verbose examples always increase reasoning, or that this effect persists through later story turns.

Keep the conclusion narrow: changing only demonstrated reasoning changes subsequent reasoning and narration. The most useful next hypothesis should target the demonstrated structure itself, rather than assuming that shorter reasoning text alone teaches useful continuation. No further variant was run automatically.

## Evidence and checks

- [Raw paired batch](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/selection-expanded-example-batch-2026-09-23T05-57-03-770Z.json): **10 live continuations in 113.470 seconds (1 minute 53 seconds)**. Cached initial-response token counts remain in evidence; their historical latency is not included in the new run. Offline checks overlapped inference, so wall time is descriptive.
- Same loaded `g4-meromero-v2-31b-i1` metadata, seeds 424243/424244, thinking enabled, and 1,024-token cap. No retries or cap increases. Full initial and normalized continuation request equality checks pass.
- Both demonstrations are byte-equivalent outside their reasoning fields after JSON serialization. Artifacts preserve 24 narrations and 44 reasoning responses, including reused controls, with exact examples separate from generated thinking.
- Focused suite: **57 passed in 5.088 seconds**. Example module coverage: 100% statements, branches, functions, and lines. Shared probe coverage: 97.05% statements/lines, 89.58% branches, 100% functions. CLI paths are exercised directly, outside measured coverage.
- Changing demonstration narration makes the new boundary test fail in **2.284 seconds**; exact source restoration verified. Both reasoning styles also pass the real-loop example insertion, history omission, and call/result correlation checks.
- App typecheck: exit 0, 17.468 seconds; harness typecheck: exit 0, 2.184 seconds; lint: exit 0, 15.950 seconds, existing Fast Refresh warning.
- Initial full suite: **12,561 passed, three skipped, one failed, exit 1 in 89.495 seconds**. The unchanged quote-color test `edits the active mode only` observed a popover still open. The suite was rerun without changing the test or application code; its outcome is recorded below.
- Unchanged full-suite rerun: **12,562 passed, three skipped, exit 0 in 90.859 seconds**. The quote-color failure did not reproduce; its cause remains uninvestigated outside this probe's scope.
- Build: exit 0 in 19.964 seconds, existing bundle-size warning. Code graph refreshed, exit 0 in 153.104 seconds. Changelog updated. Production prompts, defaults, version, and export shapes remain unchanged.
