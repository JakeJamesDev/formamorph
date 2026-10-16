# 08: Filter Glyph On The Chip

Status: done
Blocked by: 02
Recommended model: Claude Haiku 5.5 (`claude-haiku-5-5`)
Reasoning effort: medium

Rationale: a small addition to the chip face with an existing tooltip component.

Parent: [Chip Options spec](../spec.md)

## What to build

A placed Entities or Persona chip with an Only With pick shows a filter glyph after its label.

- The label text does not change. The glyph is the only sign.
- The glyph's tooltip reads the picks: "Only With Stats", "Only With Traits", or "Only With Stats or Traits".
- The glyph shows on every surface that renders a placed chip face.

Rulings: Q14, Q15, Q27.

## Acceptance criteria

- [ ] A chip with an Only With id shows the glyph; a chip without one does not.
- [ ] The tooltip names the picks with "or".
- [ ] The chip's accessible name still includes its label.
