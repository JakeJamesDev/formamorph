# 06: Run the Tool Loop in the Request Layer

Status: ready-for-agent
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

- [ ] The adapter type takes optional Tools and an executor; the runner's tests pass without either.
- [ ] Calls split across chunks are reassembled; two calls in one response produce two results and one next round.
- [ ] Non-final content never appears in the reply; the final round's content does.
- [ ] Per-request limits and the round cap each trigger the finish-in-prose round; malformed and unknown calls do too, with a readable tool result.
- [ ] Stop aborts mid-round; no further round is sent.
- [ ] Unknown or unsupported capability sends no `tools` field and unchanged prompt text.
- [ ] Silent capture records each round only with Show Silent Requests on.
- [ ] Tests drive a scripted transport with real Tool Handlers and the Sedge Landing fixture; each guard proven by reinstating its bug.
- [ ] Four gates green.
