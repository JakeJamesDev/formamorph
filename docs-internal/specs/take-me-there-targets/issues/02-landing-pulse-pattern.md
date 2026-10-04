# 02: Landing Pulse Pattern

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), ruling Q3.

## What to build

A Design System entry, **Landing Pulse**: one ring pulse on a settings row or control that points the eye after a Take Me There landing. It defines the ring tokens, the duration, that it runs once and stops, the reduced-motion fallback (the ring draws without animation), and where it is used. The dev-router showcase gets a frame that triggers the pulse on a sample row. The pattern is a proposal until the user approves it in the showcase; ticket 03 adopts it only after that approval.

## Acceptance criteria

- [ ] A new pattern section in the Design System doc with Composition, Production mapping, State reference and Writing review, in the doc's existing shape
- [ ] The showcase frame renders the pulse on demand on a sample row, in both themes
- [ ] Reduced motion shows the ring without the animation
- [ ] The pulse class leaves the row after the animation ends
- [ ] The user has approved the pattern in the showcase; the ticket records the approval under Comments
