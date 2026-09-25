# Reasoning kept between tool rounds: results

**LM Studio accepts the model's own reasoning on the assistant message between tool rounds, renders it into the prompt, and the loop completes on MeroMero.** Both arms complete 12/12 with every involved entity fetched and no unneeded lookup. The kept arm spends 21% less reasoning after the lookup than the control, which re-plans from the tool result alone.

**Ruling for the request layer: keep the reasoning.** Echo the reasoning field back on the assistant message exactly as the server returned it, under the same field name. LM Studio honors both `reasoning_content` and `reasoning`.

## Setup

- Model `g4-meromero-v2-31b-i1` on LM Studio, thinking on, seeds 424243 and 424244, 1,024-token cap, two parallel slots.
- Selection fixture: 7 entities at the landing. Six cases with the entities the action involves: greeting (Bram, Odette), odette (Odette), ferry (Rope Ferry), environment (none), healer (Mara), cobbler (Iven).
- Tool description: the saved retrieve-first description, the `get_entity` candidate from [involved-rescore-findings.md](involved-rescore-findings.md).
- Scoring follows the involved-entity rule. A lookup counts for the entity it matched, so an alias lookup counts for its entity.
- Arms share every first request byte for byte. They differ only from the first continuation on.

| Arm | Assistant message between rounds |
|---|---|
| control | `{ role, content, tool_calls }` |
| kept | `{ role, content, reasoning_content, tool_calls }`, the server's own message echoed verbatim |

The kept shape is what the harness has sent since the thinking-on batches, so the earlier 12/12 results were already kept-reasoning runs. This batch is the first paired measurement.

- 24 live trials, wall time about 10 minutes, then 30 field checks.

## Results

| Arm | Completed | Involved entities fetched | Unneeded lookups | First-round reasoning | Reasoning after the lookup |
|---|---:|---:|---:|---:|---:|
| control | **12/12** | **12/12** | 0 | 1,813 | 2,402 |
| kept | **12/12** | **12/12** | 0 | 1,933 | 1,908 |

"Involved entities fetched" counts entries (12 across the six cases and two seeds). Every trial finished with `stop`. No lookup missed, matched nothing, or repeated an entity.

Per case, reasoning after the lookup (control → kept): greeting 260 → 152 and 355 → 124, odette 214 → 238 and 244 → 211, ferry 172 → 147 and 109 → 0, healer 258 → 154 and 243 → 297, cobbler 186 → 327 and 361 → 258. The saving is not uniform. Two kept trials reason more than their control; the ferry at seed 424244 wrote its narration with no reasoning at all.

## The field on the wire

Each kept continuation was re-sent at one output token in three shapes. Server-reported prompt tokens:

| Case / seed | Reasoning chars | `reasoning_content` as sent | Field removed | Renamed to `reasoning` |
|---|---:|---:|---:|---:|
| greeting / 424243 | 383 | 1,182 | 1,085 | 1,182 |
| odette / 424243 | 579 | 1,135 | 978 | 1,135 |
| ferry / 424243 | 297 | 1,044 | 960 | 1,044 |
| healer / 424243 | 844 | 1,207 | 981 | 1,207 |
| cobbler / 424243 | 687 | 1,177 | 989 | 1,177 |
| greeting / 424244 | 202 | 1,143 | 1,085 | 1,143 |
| odette / 424244 | 755 | 1,193 | 978 | 1,193 |
| ferry / 424244 | 231 | 1,022 | 960 | 1,022 |
| healer / 424244 | 530 | 1,129 | 981 | 1,129 |
| cobbler / 424244 | 348 | 1,099 | 989 | 1,099 |

- All 30 requests returned HTTP 200. No rejection, no warning field in any body.
- Removing the field drops the prompt by 58 to 226 tokens, in step with the reasoning length. The field is rendered into the prompt, not dropped.
- Renaming it to `reasoning` gives the same count as `reasoning_content` in all 10 cases. LM Studio reads either name.
- How the template places the text (as a closed thought channel or as plain text) was not inspected. The token delta shows only that it is present.

## Seeds pin the decision, not the wording

All 12 first requests were identical across arms. The tool calls matched in 12 of 12 pairs. The reasoning text matched in only 2 of 12, and the environment narration differed in both seeds. On this server configuration, a pinned seed reproduces the model's selection but not its exact output. Paired comparisons on this fixture should read the calls and the coverage, not the token counts, as the repeatable signal.

## Interpretation

- The open question in the Tool Creator spec is answered on this model and server: the field is accepted, rendered, and the loop completes.
- Keeping the reasoning is cheaper after the lookup on average and costs nothing in completion or coverage. The control's extra reasoning is re-planning it already did.
- Evidence limits: one model, one server, one fixture, two seeds, non-streaming requests. The prefill study shows this model's thought channel breaks when text is *prefilled* into the first round; echoing the model's own closed reasoning back is a different operation and did not break here.

## Evidence

- [Batch transcript](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/reasoning-rounds-batch-2026-09-25T13-43-46-727Z.json) (local, gitignored)
- Runner: `testing/baseline/harness/narration-reasoning-rounds.cli.ts`. `--score <batch>` prints the tables above from the transcript.
- Scoring: `testing/baseline/harness/narration-selection-score.ts`.
