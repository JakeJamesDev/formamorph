# 06: Mascot tab two-column layout

Status: done
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

- [x] Frames approved by the user are in the ticket's Answer.
- [x] Component tests: the preview composition for no selection, a selected layer, and a clicked overlay; the transition rows and Play render on the preview widget; the warning and pick rows still render.
- [x] Mobile stacks the preview above the controls.
- [x] The four gates are green.

## Answer

Built in `FormaquestionMascotTab.tsx`. The selection and its transitions are pure in `src/lib/formaquestion/mascotSelection.ts`, with unit tests.

| Part | What it does |
|---|---|
| Layout | At `lg` and wider: a 22rem preview column and the controls, each its own scroller. Under `lg`: the preview first, the whole tab one scroller (Q31, refined to `lg`). |
| Preview widget | The mascot with the Mask box, the Head View beside it, a caption naming what is shown, the hint, and the transition mode with Play and its tuning rows. The head-drag line and the slider hints sit behind ⓘ; the Play hint is its tooltip. This compact label, ⓘ and `ValueSlider` row is the new pattern the frames ask approval for. |
| Selection | Expansion is selection (Q32). A layer row selects it; a second click collapses. An overlay row or a collapsed row's thumbnail selects that overlay; a second click returns to the layer. A removed or moved overlay keeps the selection on the same image. |
| Rows | The layer and overlay lists take `min-w-0`, so a name truncates and Remove stays in the column. |
| Tab picker | Below `sm`, a dropdown replaces the Formaquestion Settings tab strip, as in Settings. Asked for by the user at the frame review. |
| Play | Each Play runs the transition one way: to the Thinking look, then back to the selection's look. A new selection drops the Thinking look. Asked for at the review. |
| Phone header | The sheet's title bar is 56px, so its 48px buttons stop covering its border. Asked for at the review. |
| Phone dialogs | Settings and AI Context slide over the sheet; the shielded layer sinks under dialogs and goes inert while covered, and rises after the dialog's exit. Replaces the instant hide that flashed the bare menu. Asked for at the review. |

**Why `lg`, not `md`** (measured with Playwright, default rig):

| Viewport | Controls column | Layer rows |
|---|---|---|
| 1600×900, two columns | 458px | Fit; names 46–80px before truncation |
| 800×900, two columns (md) | 358px | Names 0–5px; rows overflowed by up to 30px |
| 900×900, stacked (lg split) | 834px | Fit |
| 390×844, stacked | 326px | Fit |

The preview widget is 542px tall at `lg`. At 1600×900 its column has 678px. At 1366×768 the column is 574px of content in 559px, so it scrolls 15px by itself; Q35 allows that and never a clipped row.

### Frames

Captured with Playwright from the `formaquestionSettings` dev route, the help window hidden. Copied to the main checkout at landing:

- `.scratch/mascot-tab-layout/frames/desktop-dark.png` · `desktop-light.png`: 1600×900, Idle.
- `.scratch/mascot-tab-layout/frames/desktop-dark-overlay.png`: Happy's first overlay selected.
- `.scratch/mascot-tab-layout/frames/desktop-dark-scrolled.png`: Happy selected, the controls scrolled under the pinned preview.
- `.scratch/mascot-tab-layout/frames/desktop-dark-1366.png`: 1366×768.
- `.scratch/mascot-tab-layout/frames/tablet-dark-stacked.png`: 900×900, stacked and scrolled.
- `.scratch/mascot-tab-layout/frames/mobile-dark.png` · `mobile-light-scrolled.png`: 390×844.

Approval: the user approved the layout on 2026-10-04 after the review changes above.
