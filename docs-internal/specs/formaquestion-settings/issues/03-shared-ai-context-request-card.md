# 03: Shared AI Context request card

Status: done
Base: 44724f1d
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

A prefactor with no behavior change. The game view draws each request of AI Context inline. That card becomes a shared component, so Formaquestion's AI Context (ticket 18) draws the same one.

- **The request record type** leaves the game view and becomes a shared type: the request kind, the messages, the response, the reasoning text, the tool rounds and the endpoint details. The fields that only the game uses (dictionary marks, stat diagnostics, the anatomy) stay optional.
- **The request card** becomes a component: the header with the endpoint chips, the request drawn as its Request Anatomy in plain mode, the Raw Input, Tool Rounds and reasoning sections, and the response.
- **The text highlight** of the game view's find bar goes in as a prop, so the card has no game import.

The game view keeps its turn grouping, its find bar and its recording. Only the card moves.

This ticket does not touch the help session, so it can start before Formaquestion ticket 46 reports.

Recommended model rationale: the game view is the largest file in the app, and the card reads many values from its closure.

## Acceptance criteria

- [ ] The record type and the card are exported from outside the game view, and the card imports nothing from it.
- [ ] The game view's AI Context looks and works as before: every section, the find bar highlight, the dictionary marks.
- [ ] The existing AI Context tests pass with no edit to an assertion.
- [ ] The card has a thin test with a record that has no game-only field.
- [ ] The four gates are green.
