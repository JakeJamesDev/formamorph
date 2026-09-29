# 07: Test Bench Persona Preview

Status: done
Base: 207679e4
Blocked by: 04; 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 59, 60; Q18)

## What to build

The Test Bench's opening view gets a persona picker beside its start picker: None, the world's personas, and the Custom Persona case. Its pool preview draws through the same pool rule as play, so Self rows and location rows show exactly when play would draw them.

## Acceptance criteria

- [x] The opening lens suite covers a persona pick that replaces the pool with Self rows, None with a Custom Persona entity, and location rows at the picked start.
- [x] The Bench reads the shared pool rule; no second copy of it.
- [x] Four gates green; changelog In Progress entry.
