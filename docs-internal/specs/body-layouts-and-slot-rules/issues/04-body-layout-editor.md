# 04: Body Layout Editor

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new visual pattern with pointer work, touch and a new pure module.

Before you build, get the user's approval of variant B and both outlines through the `design-system` flow. Reference: branch `prototype/paperdoll` at `422d61ba9`, `src/managers/paperdollPrototype/`. The prototype code is a reference, so rewrite it.

## What to build

Each Body gets a Backdrop and one Slot Box per capacity unit, edited inside the Body's expanded row in variant B's layout: doll on the left, slot rows on the right, wrapping when narrow (Q23, Q46).

This ticket owns the **Body Layout module**, which is pure: box sync to entries, stacking order, snap lines and clamps. It also owns the Body and BodyEntry schema from the spec. `parseBodies` fills an absent Backdrop, aspect or box with the new-Body defaults.

Behavior: Q1, Q2, Q5, Q6, Q13–Q19, Q23, Q29, Q31–Q34, Q47. The Backdrop select offers Humanoid, Quadruped and Plain; ticket 05 adds Custom Image. Edits go through the Bodies setter, so History and Auto Save work.

Snap to Others' choice is an app setting with a default in the settings defaults. Add a Design System reference and a `devRoutes` entry. Update CONTEXT.md (Body Layout, Backdrop, Slot Box) and the wiki's Equipment page.

⚠️ This changes the world export shape. Remind the user in the landing report.

## Acceptance criteria

- [ ] A new Body starts on Humanoid with a small center square per capacity unit.
- [ ] Raising capacity adds a center box, and lowering it drops the last.
- [ ] Dragging moves a box and corner handles resize it, clamped inside the Backdrop with a minimum size.
- [ ] Dragging the bottom edge changes the aspect, and boxes keep their fractions.
- [ ] Snap to Others aligns to box edges and centers and the vertical midline. Alt skips it for one drag. The toggle is remembered.
- [ ] Arrow keys move a selected box, and Shift + arrow keys resize it.
- [ ] A smaller box draws above a larger one, and equal areas follow entry then unit order.
- [ ] A selected large box leaves a small box inside it clickable, and the handles still take the pointer.
- [ ] Selecting a box selects its entry row, and the reverse.
- [ ] Boxes are labeled "Hand 1", "Hand 2", or "Head" at capacity 1.
- [ ] Duplicating a Body copies its Backdrop and boxes.
- [ ] A Playwright spec drives a real drag, a handle resize and a snap.
- [ ] Frames saved as `.scratch/frames/body-layout-editor-<theme>-<width>.png` in light and dark, at 1440 and 375 wide.

For you: Equipment Settings: does laying out a Humanoid feel good with mouse and with touch?
