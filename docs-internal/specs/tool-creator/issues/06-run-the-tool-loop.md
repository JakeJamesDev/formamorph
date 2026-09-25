# 06: Run the Tool Loop in the Request Layer

Status: ready-for-human
Status note: built in 0e87bb79 with the closing review folded in; game-view wiring and its tests are 09's
Base: d22793e4
Blocked by: 01 — Store Tools in Presets and the Catalog; 02 — Run a Tool Call in the Tool Runner; 04 — Detect Tool Support per Endpoint and Model; 05 — Probe Reasoning Kept Between Tool Rounds
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

A request that offers Tools completes a full loop below the Turn Pipeline. The pipeline's request adapter gains optional Tools and a caller-supplied tool executor; the runner never sees them, so ADR-0001's two seams stand.

When the endpoint and model support tools, the request layer sends `tools` and `tool_choice: "auto"`. It collects streamed `tool_calls` across chunks, runs each through the executor, appends the assistant message and the `tool` results, and sends the next round. Several calls in one response are handled together. Only the final round's content becomes the reply; content streamed in a non-final round is dropped and never reaches the reveal. Outgoing call IDs are remapped to nine-character alphanumeric IDs where the template needs them, and each result is matched to its call. The assistant message between rounds follows ticket 05's ruling.

Limits: calls per request per Tool (the Tool's own limit or the global default) plus a hard cap on rounds per request; requests in the same turn share no counter. On a limit, a malformed call or an unknown Tool, one more round goes out without Tools so the model finishes in prose. Stop aborts the round and any running script. When support is unknown or false, the prompt text goes unchanged with no tools.

Tool rounds are silent requests: captured in AI Context only with Show Silent Requests on, each round with its call, arguments, result and reasoning.

Model rationale: Fable at high effort for streaming state across chunks, correlation, abort handling and the ADR-0001 seam constraint, where a subtle bug strands a turn.

## Acceptance criteria

- [x] The adapter type takes optional Tools and an executor; the runner's tests pass without either.
- [x] Calls split across chunks are reassembled; two calls in one response produce two results and one next round.
- [x] Non-final content never appears in the reply; the final round's content does.
- [x] Per-request limits and the round cap each trigger the finish-in-prose round; malformed and unknown calls do too, with a readable tool result.
- [x] Stop aborts mid-round; no further round is sent.
- [x] Unknown or unsupported capability sends no `tools` field and unchanged prompt text.
- [x] Silent capture records each round only with Show Silent Requests on.
- [x] Tests drive a scripted transport with real Tool Handlers and the Sedge Landing fixture; each guard proven by reinstating its bug.
- [x] Four gates green.

## Comments

- **2026-09-25, implementation.** Rulings from the spec session: the caller-side adapter arguments (the game view's `AiCallArgs`) gain optional `tools` and `executeTool`; `TurnRequestAdapter`, `TurnRequestContext` and the runner stay untouched. Hold-and-flush is confirmed: a round that offers Tools holds its content deltas and flushes them when it ends without calls; the finish-in-prose round streams live. Notes for ticket 09:
  - The loop is `streamAiToolLoop(spec, options)` in `src/lib/aiRequest/toolLoop.ts`. It takes `execute`, `callLimit` (default `DEFAULT_TOOL_CALL_LIMIT`), `roundCap` (default `DEFAULT_TOOL_ROUND_CAP`, 6) and `captureRounds`. Without Tools on the wire it is the plain stream.
  - `buildAiRequestSpec` takes `call.tools`; it writes `tools` and `tool_choice` and sets `spec.tools` only where `toolsSupported(target.reasoning)`. Unknown or false sends none.
  - `makeAIRequest` routes through the loop when `executeTool` is present and records each captured round on the debug request as `toolRounds` (messages, content, reasoning, calls with id, arguments, result and failure). Rendering them in AI Context is 09's.
  - The stream's `done` result now carries `toolCalls` and `reasoningField`. The loop's `done` carries every round's reasoning joined; each round's own reasoning is in its capture.
  - Stop: the loop checks the signal after each stream and after each call and sends no further round. A Script handler runs synchronously on the main thread, so a Stop press cannot interrupt it mid-evaluation; the sandbox's one-second deadline bounds it, and the loop then stops. Interrupting a script mid-run needs the sandbox in a worker, which is outside this ticket.
  - Guards proven red: 22 mutations (hold-and-flush off, each prose trigger dropped, cap off by one, reasoning field not echoed, capture unconditional, limit off by one, ids not remapped, abort after a call ignored, held content never flushed, null content, response debug per round, reasoning not joined, prose-round calls honored, index folding ignored, reasoning field unrecorded, tool frame not a first token, capability gate off, required list empty, blank description sent, caller messages shared). Each failed at least one test and was restored.
  - Closing review (Base d22793e4): the game-view wiring (`tools` sent only with an executor, `captureRounds` from **Show Silent Requests**, `toolRounds` on the captured request) has no test yet; nothing supplies `tools` or `executeTool` until 09, whose Playwright spec covers the wire end to end.

