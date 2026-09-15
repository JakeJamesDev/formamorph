# 02: Reasoning Budget Reaches LM Studio

Status: in-progress
Base: 64da340d
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Reasoning Capability and Budget](../spec.md)

**What to build:** A player on an LM Studio endpoint with a reasoning model gets the Reasoning Budget slider on every prompt's Options tab, and each request carries the token cap beside the effort level. A switched-off prompt, a Global prompt under a switched-off Output row, and Inline narration send a zero cap. The built-in engine keeps its budget as is.

**Rationale for the model:** the routing is a bounded change on two seams plus a UI condition and a live check. Sonnet at medium effort is enough.

## Acceptance criteria

- [ ] When LM Studio's native model list answers, the record marks budget yes for a reasoning model and never for a non-reasoning one.
- [ ] The request builder sends the token budget field to any target whose record says budget yes and reasons yes, and the effort level beside it where the record lists accepted levels. A non-reasoning record gets neither field.
- [ ] A resolved choice of none sends a zero budget on a budget-capable target. Request-spec tests cover switched-off, Global-under-off, and Inline narration.
- [ ] The prompt Options control shows the budget slider on any target whose record says budget yes, and the effort dropdown otherwise. The Output row keeps the effort dropdown.
- [ ] The AI Context viewer's per-request endpoint line shows the resolved effort and the budget tokens sent, with a test. (Corrected from "Request Anatomy": that view draws prompt text and chips only. See Comments.)
- [ ] Live check against LM Studio through the real app, using the existing dev route: two budgets, the reasoning token counts from the response usage recorded in the changelog entry.
- [ ] Typecheck, lint, tests, and build pass; report test wall time; prove the new request-spec guards fail when the routing is reverted. Update the code graph. Changelog In Progress entry under the existing Native Reasoning group, 👤 bucket.

## Scope notes

LM Studio only. No budget on Ollama or cloud. No budget message. Field names stay as the desktop engine already uses.

## Comments

**2026-09-15 — intent verified with the spec session.** Two acceptance criteria read two ways. The spec session answered both.

**The prompt Options control on a budget-capable target.** The budget slider only, exactly as the built-in engine shows today. The effort still goes out beside the budget, from the prompt's stored or default level. The Output row keeps its effort dropdown, so the effort always has one visible control, the global one. Reason: LM Studio's effort ladder is effectively on and off, so the budget is the precise per-prompt lever, and keeping effort on the wire preserves the switch for a model whose default is thinking-off, where a budget alone may not start the thinking. Two controls per prompt, and dropping the effort, are both ruled out.

**Where the budget-beside-effort readout goes.** The AI Context viewer's per-request endpoint line at `src/views/GameViewer.tsx:4838`, which renders `Preset . model` from `DebugEndpointInfo`. That record gains the resolved effort and the budget tokens sent. "Request Anatomy" in the original bullet was an error in the spec: `RequestAnatomyView` and `anatomyPreview` draw prompt text and chips, never request parameters. The spec session is correcting its own user stories 19 and 20.
