# 04: Image endpoint header

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The image endpoint preset header renders from the shared component.

- Duplicate, Rename, Reset, Delete as icons, with the ⋯ menu below `md`. No Import or Export.
- Delete stays hidden while one preset remains. Every image preset is editable, so no built-in subset applies.

Spec: Q1, Q2, Q7, Q8; Implementation → Image endpoint header.

Recommended model rationale: a mechanical adoption on one header with no new behavior.

## Acceptance criteria

- [ ] Settings → AI Endpoints → Image shows the icon header at `md` and the ⋯ menu below.
- [ ] Delete is absent with one preset and present with two.
- [ ] Duplicate makes "<name> (copy)" and selects it.
- [ ] Changelog line under In Progress.
