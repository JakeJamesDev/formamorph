# 07: Hover Highlighting

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the renderer must report where each line and span came from, a new seam that has to stay honest as renderers change.

Parent: [Chip Options spec](../spec.md)

## What to build

Hovering or focusing a control in Chip Options lights the text it produces in the right pane and dims the rest.

- The renderers report origins: each output line names the control that produced it, and an owned stat line names the span of each Stat Detail piece inside it.
- Every control has a defined highlight. Only With lights the entities that pass; nothing else changes, since failing entities are not rendered. Include Traits lights the traits lines; Include Stats lights the stat lines. Content lights the description or summary lines. Header, Prepend and Append light their own lines. A Stat Detail piece lights only its own text inside the stat line. Scope and Format highlight nothing. The Stats chip's pieces light their spans in its lines; the Location and Dictionary axes highlight nothing.
- The map comes from the renderer's report, never from a parse of the rendered string.

Rulings: Q21.

## Acceptance criteria

- [ ] Each control lights what this ticket names, in every format.
- [ ] Hovering Range, Descriptor or Description lights only that piece's text.
- [ ] A test pins the origin report for a known scene, so a renderer change that breaks it fails.
- [ ] Keyboard focus lights the same as hover.
