# 02: Hover Cards For Code Names

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The tracer slice: card model, renderer and pointer trigger on every code surface. Opus at high: a new CodeMirror layer that must work inside dialogs and full screen.

## What to build

Hovering a name in any code editor (stat code, Tool scripts, the template dialog) shows a card: the Signature line with an access badge, and the Description. The card stays open while the pointer is on it. Escape closes the card and stops there. With no card open, Escape still closes full screen.

A pure analysis function returns the card model for a position, through ticket 01's resolver. One renderer draws it with the app's popover tokens on the existing tooltip host, so it stays clickable and unclipped inside dialogs. A surface entry gains an access field (writable, read-only, writable after this run), derived from the executor's own writable-field lists. `value`, `min`, `max` and `regen` are writable on every route. Read-only code previews show no cards.

Spec: Q1, Q17, Q19 (mock Standard preset); Implementation Decisions: Card model, Access badge, Card rendering, Escape.

## Acceptance criteria

- [ ] Hover opens a card on stat code, Tool script and template dialog names; read-only previews show none
- [ ] Signature shows kind, path and type; the badge reads Writable, Read-Only or Writable After This Run (T02-1)
- [ ] Access derives from the executor's writable-field lists; a test fails if the two disagree
- [ ] A member the resolved entry doesn't have gets no card: `const n = stats.HP.value; n.toFixed` shows nothing, although the resolver's stat-like heuristic (kept for completion) resolves it (T01-2)
- [ ] Escape closes an open card without leaving full screen; a second Escape leaves
- [ ] Cards work inside a dialog (pointer events, no clipping) in both themes
- [ ] Changelog fragment; four gates green

## Blocked by

- 01
