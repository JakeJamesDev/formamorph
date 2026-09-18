# 01: Narration Layout Setting and Chat Body

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

A **Narration Layout** player setting with the values Pages and Chat. Pages is the default and stays as it
is. With Chat selected, the narration panel shows the story as one virtualized list of turns: the player
action as a compact bubble on the right, the narration as a full-width block. The list opens at the latest
turn. This ticket is the tracer: it proves the setting, the body switch, and the list structure that every
later ticket builds on.

The list structure is fixed by the prototype (`prototype/chat-layout`, `4233a3d7`): turns in normal flow
between a top and a bottom spacer, `overflow-anchor: none` on the spacers, no height or padding change on an
ancestor of a turn, the virtualizer's own scroll correction off, `useFlushSync` off. One virtual item is one
turn.

## Acceptance criteria

- [ ] The setting has a type, an options list, and a default of Pages with the other settings defaults. It persists as the other enum display settings do. No world or save shape changes.
- [ ] An option switcher row in the Settings modal sets it, with copy per the settings copy rules. The design system showcase mirrors the control.
- [ ] With Pages, the middle panel renders exactly what it renders today. A GamePanels harness test guards this.
- [ ] With Chat, every staged turn shows as an action bubble and a narration block. The first turn shows no action bubble. No Pager shows.
- [ ] Committed narration renders in static mode and keys by content. Scene images show inline in their turn and hold their aspect box before they load.
- [ ] The list uses `@tanstack/react-virtual` with the flow-and-spacers structure above. A loaded game opens at the bottom and re-aims until the target holds.
- [ ] The action input, the progress bar, and the top-right options control are shared by both layouts.
- [ ] The harness has a stub for element measurement so that a Chat test mounts all staged turns in jsdom.
- [ ] The dev router opens the game view in Chat layout in one call. The drift-guard test stays green.
- [ ] Verified in the preview via the dev-router with static frames. Four gates green.
