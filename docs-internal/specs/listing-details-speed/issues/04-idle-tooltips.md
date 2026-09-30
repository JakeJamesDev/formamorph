# 04: Idle tooltips build nothing

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

App-wide change to a shared primitive, with a prototype decision and accessibility constraints.

## What to build

Spec Q10. A `Tip` that nobody hovers costs almost nothing to render. Prototype both approaches and measure them with the harness: one shared root through Base UI's `Tooltip.createHandle()`, and the real tooltip mounted on first hover or focus. Adopt the one that measures better, in `Tip`, so every surface gains it. Record both measurements and the choice.

## Acceptance criteria

- [ ] Both approaches are measured on the warm open; numbers and the choice are recorded under `## Comments`.
- [ ] An idle trigger mounts no tooltip root, store, or portal of its own.
- [ ] Every trigger has its accessible name from the first render.
- [ ] The popup opens on the first hover and on keyboard focus with no added delay, in the right position.
- [ ] The existing tooltip tests pass, and a new test fails when an idle trigger mounts a full root.
- [ ] Tooltips outside Community Creations are spot-checked in the preview.
