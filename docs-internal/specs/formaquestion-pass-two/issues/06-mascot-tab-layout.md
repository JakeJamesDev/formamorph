# 06: Mascot tab two-column layout

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mascot tab becomes a two-column editor with a pinned live preview.

- The preview column is fixed; the controls column scrolls. Under the mobile breakpoint the preview sits above the controls.
- The preview widget holds the composed mascot, the Mask box, the transition mode with its tuning rows and Play, and the Head View thumbnail. The transition rows leave the bottom of the tab.
- The preview follows the selection: nothing selected shows the Idle composition; a selected layer row shows the base plus its overlays; a clicked overlay shows the base plus that overlay alone. The selection is tab state.
- This is a new visual pattern: build it on the tab's dev route, post static frames at a realistic viewport in both themes, and get the user's approval before the ticket closes.

Spec: Q14, Q15; Implementation → Mascot tab.

Recommended model rationale: a layout rewrite of a dense tab with a selection model and an approval loop.

## Acceptance criteria

- [ ] Frames approved by the user are in the ticket's Answer.
- [ ] Component tests: the preview composition for no selection, a selected layer, and a clicked overlay; the transition rows and Play render on the preview widget; the warning and pick rows still render.
- [ ] Mobile stacks the preview above the controls.
- [ ] The four gates are green.
