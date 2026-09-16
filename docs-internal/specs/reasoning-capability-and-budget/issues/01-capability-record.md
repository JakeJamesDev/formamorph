# 01: Capability Record Replaces The Effort List

Status: ready-for-human
Base: 64da340d
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Reasoning Capability and Budget](../spec.md)

**What to build:** Every place that asks "does this model reason, which levels does it take, does it take a budget" reads one reasoning capability record on the endpoint target. Today's bare effort list becomes that record. A player sees no change: the same controls show and hide, the same fields go out, and a cached effort list from before the update loads without re-detecting.

**Rationale for the model:** the change fans across the request builder, the settings context, the settings UI, and Request Anatomy, with a cache migration. Opus for the cross-cutting edit; effort high to keep every reader consistent.

## Acceptance criteria

- [x] The endpoint target carries one record with: reasons (yes, no, unknown), accepted effort levels, budget support, and the source of each answer. The bare effort list is gone from the target.
- [x] The request builder reads only the record. With a record equivalent to today's list, every existing request-spec case produces the same wire body.
- [x] The settings context builds the record from the existing detectors without changing when they run. The bounded per-endpoint-and-model cache stores records.
- [x] A cache entry holding an older bare effort list loads as a record with those levels, reasons unknown, budget unknown. A test proves it.
- [x] The built-in engine's record is always budget yes; LM Studio's and every other endpoint's is budget unknown in this ticket.
- [x] The Native Reasoning controls show, hide, and list levels from the record exactly as they do today from the list.
- [x] Request Anatomy reads the record with no visible change.
- [x] Existing request-spec, settings routing, and settings pin tests pass unchanged in intent; fixtures move to the record shape.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the migration test fails when the migration is removed. Update the code graph. No changelog entry: no behavior changed.

## Scope notes

Expand step only. No new detection sources, no budget on LM Studio, no observation. No export-shape change.
