# 04: Self Openings for Library and Custom Personas

Status: done
Base: 826df3ed
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [Openings Refresh](../spec.md) (stories 15–20; Q6, Q15, Q24)

## What to build

Self openings work for every persona source:

- A library entity with the Persona mark shows the Others | Self switch in the library editor. Its Self rows draw in any world the player plays it in.
- The world's Custom Persona entity shows the switch. Its Self rows draw under None, and under a library persona that has no Self rows. A library persona's own Self rows win over them.
- A persona's Self rows win over Library Additions' openings. Additions draw only when the persona step yields no rows.

## Acceptance criteria

- [ ] The new-game draw suite covers: library persona Self; a library persona without Self falls back to Custom Persona Self; None uses Custom Persona Self; Self beats Library Additions; Additions still win when no Self applies.
- [ ] The library editor and world entity editor suites cover the switch on library personas and on the Custom Persona entity.
- [ ] Four gates green; changelog In Progress entry.
