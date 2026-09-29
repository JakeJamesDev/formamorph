# 04: Drop cut thoughts

Status: ready-for-human
Base: 3eeb07ff
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: failure-path wiring across the tool loop and the turn pipeline; the edge on 02 is file overlap in the tool loop.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

A round that ends with `finish_reason: length` before any answer text and with no tool call has a cut thought. The request fails through the existing request-failure path instead of returning an empty success. Its reasoning is not carried into a later round or request. A round whose thought finishes still runs its tool calls as today.

## Acceptance criteria

- [x] Tool-loop test: a reasoning-only round ending on `length` fails through the existing failure path.
- [x] That reasoning is absent from every later request body.
- [x] A tool round whose thought finishes still runs its tool call.
- [x] Each guard test fails when its bug is put back.
- [x] Changelog line in 🚧 In Progress.
- [x] Four gates green.

## Notes

- A cut round throws `AiStreamError` of kind `cut-thought` from the tool loop, on the plain path and in every tool round. The Error Details carry the request, the model and the sent `max_tokens`.
- A round that ends on `length` with a call is not cut: its call runs as today. A round with answer text is not cut: it returns its text on `length` as today.
- Mutation proof: ignoring calls, ignoring answer text, no throw on the plain path, and carrying the cut reasoning into a retry round each fail their own test.
- Review fold-in: `cutThoughtFailure` sits beside `httpFailure` in `aiStream.ts` and shares its request lines; the cut-thought test also runs with an Answer Cap set.
- Open, not in scope: after a failed narration, the live reasoning block keeps the cut thought until the next narration starts. It reaches no request.
