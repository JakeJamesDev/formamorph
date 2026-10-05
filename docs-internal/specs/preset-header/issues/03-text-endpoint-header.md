# 03: Text endpoint editor header

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

The text endpoint editor's header renders from the shared component in both modals.

- Select mode (Settings): Duplicate, Rename, Reset, Delete as icons, with the ⋯ menu below `md`. No Import or Export.
- Heading mode (Formaquestion Endpoint tab): the heading plus the same icons. The Add button becomes the Duplicate icon and keeps its behavior of copying the preset and moving the Answer route to the copy.
- The engine preset and the built-in presets keep Duplicate only.

Spec: Q1, Q2, Q7, Q8; Implementation → Text endpoint editor.

Recommended model rationale: one editor with two header modes adopting a finished component.

## Acceptance criteria

- [ ] Settings → AI Endpoints → Text shows the icon header at `md` and the ⋯ menu below.
- [ ] The Formaquestion Endpoint tab shows the heading with the icons, and Duplicate moves the Answer route to the copy.
- [ ] No Import or Export appears on either.
- [ ] Both endpoint tests pass on behavior.
- [ ] Changelog line under In Progress.
