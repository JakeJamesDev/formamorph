# 04: Drop cut thoughts

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: failure-path wiring across the tool loop and the turn pipeline; the edge on 02 is file overlap in the tool loop.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

A round that ends with `finish_reason: length` before any answer text and with no tool call has a cut thought. The request fails through the existing request-failure path instead of returning an empty success. Its reasoning is not carried into a later round or request. A round whose thought finishes still runs its tool calls as today.

## Acceptance criteria

- [ ] Tool-loop test: a reasoning-only round ending on `length` fails through the existing failure path.
- [ ] That reasoning is absent from every later request body.
- [ ] A tool round whose thought finishes still runs its tool call.
- [ ] Each guard test fails when its bug is put back.
- [ ] Changelog line in 🚧 In Progress.
- [ ] Four gates green.
