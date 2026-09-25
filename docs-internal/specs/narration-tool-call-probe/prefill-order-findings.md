# Reasoning prefill and entity order: results

**Prefilling the thinking channel breaks tool delivery on MeroMero.** The model often selects the right entity inside its thought, but it then writes the call without closing the thought channel. LM Studio does not parse a call inside reasoning, so the trial ends with no lookup and no narration. The control, with no prefill, is perfect in both entity orders.

**Entity order has no measurable effect on the control.** It fetches exactly the involved entities in 23 of 24 trials, whichever end of the list they sit at.

## Setup

- Model `g4-meromero-v2-31b-i1` on LM Studio, thinking on, seeds 424243 and 424244, 1,024-token cap.
- Selection fixture: 7 entities at the landing. Six cases, each with the entities the action *involves*: greeting (Bram, Odette), odette (Odette), ferry (Rope Ferry), environment (none), healer (Mara), cobbler (Iven).
- Scoring follows the involved-entity rule: an involved entity needs a lookup; a background mention from its summary is fine. A lookup of an entity the action does not involve counts as unneeded.
- Tool description: the saved inclusion description, the same in every arm.
- Arms differ only by the first request's final assistant message, `<|channel>thought\n` + opener. This is Gemma 4's thought token from the model's `chat_template.jinja`.

| Arm | Opener |
|---|---|
| control | none |
| question | Before planning the scene, which entities does this action involve, and which of their full entries do I need? |
| intent | First, I will identify the entities this action involves and retrieve their full entries before planning the scene. |

- Order: forward is Bram, Odette, Rope Ferry, Mara, Iven, Nessa, Corin. Reversed is the same list backward.
- 72 live trials. The saved control batch could not be reused: the static header frame changed blank lines in the frozen prompt snapshot.

## Results

| Arm / order | Completed | Involved entities fetched | Unneeded lookups | Reasoning tokens before first call |
|---|---:|---:|---:|---:|
| control / forward | **12/12** | **12/12** | 0 | 1,899 |
| control / reversed | **12/12** | **12/12** | 1 | 1,811 |
| question / forward | 2/12 | 3/12 | 0 | 3,933 |
| question / reversed | 3/12 | 3/12 | 2 | 1,791 |
| intent / forward | 4/12 | 5/12 | 10 | 2,400 |
| intent / reversed | 4/12 | 3/12 | 11 | 5,054 |

"Involved entities fetched" counts entries (12 in total across the six cases and two seeds).

### Failure modes in the 48 prefill trials

| Failure | Trials |
|---|---:|
| Call written inside the unclosed thought, so no call is parsed | 22 |
| Narration written inside the unclosed thought | 4 |
| Narration inside the thought hit the output cap | 6 |
| Four lookups spent on unneeded entities (budget exhausted) | 3 |

### Selection inside the thought

The calls the model wrote inside its thought were parsed from the reasoning text and scored as if delivered:

| Arm / order | Exact involved set chosen |
|---|---:|
| question / forward | 8/12 |
| question / reversed | 6/12 |
| intent / forward | 7/12 |
| intent / reversed | 3/12 |

Even when delivery is ignored, the prefill does not beat the control's 23/24. The **intent** opener over-fetches heavily: 16 and 26 unneeded entities, often every nearby character.

## Entity order

- **Control:** no effect. Every involved entity was fetched in both orders, and the one unneeded lookup (Rope Ferry in a reversed quiet scene) is one trial.
- **Prefill arms:** unneeded lookups lean toward Bram and Odette in both orders. Nessa and Corin, never involved, were fetched twice when first in the list and never when last. That is a small position signal on 24 trials per order, not a reliable effect.

## Interpretation

- The thought-channel prefill is mechanically possible on LM Studio, but on this model it removes the habit of closing the channel before a call. The call syntax is right; its placement is wrong.
- An app-side parser that reads Gemma call syntax out of reasoning would recover 22 trials. That is model-specific and was not tested.
- The control already selects correctly. On this fixture, the model's own reasoning is not the weak point that a prefill needs to fix.

## Evidence

- [Batch transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/prefill-order-batch-2026-09-25T01-04-18-999Z.json) (local, gitignored)
- Runner: `testing/baseline/harness/narration-prefill.cli.ts`. Batch wall time about 29 minutes.
