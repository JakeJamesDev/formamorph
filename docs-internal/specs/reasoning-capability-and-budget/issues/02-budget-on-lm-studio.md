# 02: Reasoning Budget Reaches LM Studio

Status: ready-for-human
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

**2026-09-15 — done, ready for human.** Committed as 4f643663 (amended after review; unpushed).

The two-axis review found one real gap and one real regression risk, both fixed in the amend.

**The capture site had no guard.** Only the pure seam was tested, so deleting the wire body at the AI Context capture site left every test green. `toDebugEndpoint` now takes the body as a required argument typed `Pick<AiRequestBody, 'reasoning_effort' | 'thinking_budget_tokens'>`, so dropping it is a type error. No test can reach that wiring, and a compile error is the stronger guard.

**The bundled engine could have started receiving an effort hint.** The engine shares the active endpoint's capability record. Once a probe fills in that endpoint's levels, the old unconditional effort spread would have put `reasoning_effort` on the engine's wire body, which it ignores. That breaks parent-spec user story 16. The builder now excludes the engine by name, with a test that fails when the guard is removed.

Also folded in: the budget gate reuses `reasoningRuledOut` rather than re-expressing half of it inline; the chip moved out of the GameViewer monolith into `src/components/game/ReasoningChip.tsx` with its formatter beside it, so it has render tests; and the debug shape now carries `ReasoningEffortField` rather than a bare string.

**Gate state at handover.** Lint 0 errors and 0 warnings; build succeeds; this unit's five test files pass 139 tests in 4.05s. The full suite reads 622 of 625 files passing, and the unfiltered typecheck reports errors, but every failure is in `src/lib/reasoningCapability.test.ts`, `reasoningCatalog.*` and `reasoningObservation.*` — tickets 03, 04 and 05, all mid-edit in the shared tree while this unit finished. At commit time, before those sessions started, all four gates were green: typecheck 0, lint 0, 10161 tests passing in 70.27s, build succeeded.

**Two items for the human.**

The AI Context export shape changed. `DebugEndpointInfo` gained optional `reasoningEffort` and `budgetTokens`, and the viewer exports that structure as JSON for bug reports. It is not a world or save export, so no version bump is implied.

The effort hint is still gated on the `reasoningEngaged` aggregate. With every prompt switched off and the Output row at Model Default, a budget-capable target receives a zero budget and no `reasoning_effort: none` beside it. The zero budget already stops the thinking, so this is harmless, but it is an inconsistency worth knowing about.
