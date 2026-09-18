# 01: Narration Layout Setting and Chat Body

Status: ready-for-human
Base: 6f7bd1ec
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

- [x] The setting has a type, an options list, and a default of Pages with the other settings defaults. It persists as the other enum display settings do. No world or save shape changes.
- [x] An option switcher row in the Settings modal sets it, with copy per the settings copy rules. The design system showcase mirrors the control.
- [x] With Pages, the middle panel renders exactly what it renders today. A GamePanels harness test guards this.
- [x] With Chat, every staged turn shows as an action bubble and a narration block. The first turn shows no action bubble. No Pager shows.
- [x] Committed narration renders in static mode and keys by content. Scene images show inline in their turn and hold their aspect box before they load.
- [x] The list uses `@tanstack/react-virtual` with the flow-and-spacers structure above. A loaded game opens at the bottom and re-aims until the target holds.
- [x] The action input, the progress bar, and the top-right options control are shared by both layouts.
- [x] The harness has a stub for element measurement so that a Chat test mounts all staged turns in jsdom.
- [x] The dev router opens the game view in Chat layout in one call. The drift-guard test stays green.
- [x] Verified in the preview via the dev-router with static frames. Four gates green.

## Comments

- **Scene image controls are missing in Chat.** The existing scene image panel acts on the viewed page: its
  generate, delete, and job state all target the viewed turn. So Chat shows each image as a plain inline
  image with no pager, zoom, or delete. Where those controls go is the user's call (open gap in the spec).
- **Chat shows no choices yet.** The choices and the Continue the Story choice lived inside the Pages scroll
  area. Ticket 04 brings them back as bubbles. Until then, the player types every action in Chat.
- **No changelog entry here.** Ticket 08 ships the one In Progress entry for the whole feature.
- **The Re-generate button stays in Chat for now.** Only the Pager left the row under the narration.
  Re-generate (and Rollback, when a past page is viewed) still show there until ticket 05 moves them onto
  the bubbles.
- **For ticket 03:** a player who paged back in Pages and then switches to Chat keeps that user page. The
  panels show that past turn while Chat opens at the bottom. The barrier corrects this on the first scroll.
- **For ticket 08:** the virtualizer's own scroll correction is off in every browser. The fallback for
  browsers with no scroll anchoring is not built yet.
- Dev router: `__fmDev.goto('gameViewer', { fixture: 'whiteRoom', mode: 'chat' })` opens the game in Chat
  without saving the setting.
