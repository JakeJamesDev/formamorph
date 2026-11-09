# 04: Colors for Stats and Traits

Status: ready-for-human
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Color math in OKLab plus a per-material apply path inside VRMViewer. Needs care with the viewer's existing tint code.

## What to build

Stats blend skin, eye and hair colors, and traits set them (Q5, Q10).

- Build on what landed: the resolver `avatarLook` and its `holders` map (add color channels to it, spec "Trait editor"), the shared slider picker hook and row, the trait Stats-tab section, and the overlap warning (01–03).
- Stats and stat-link overrides gain `colorBindings` (`{ channel, color }`). Traits gain `colorPins` (`{ channel, color }`), with no link override (Q20).
- **This ticket owns the color plan.** For each channel the resolver returns either "none" or a set color (the player's pick or the winning trait pin) plus `(target, t)` blend steps in authored order (group, then `order`), `t` clamped to [0, 1].
- VRMViewer applies the plan per material. "None" resets to the model's own colors. The start is the set color, or that material's own median when none is set. The blend runs in OKLab. Separate materials in one channel stay apart.
- Non-VRM entity models skip color bindings and pins (Q19).
- The stat editor gets a Colors list below the Change By rows. The trait editor's look section (ticket 03) gets color rows. Both mark a channel the known model lacks, and the trait overlap warning covers colors.
- Update the stat, trait and Avatars docs pages. Add a changelog fragment.

⚠️ Export shape: world `.json` gains `colorBindings` and `colorPins`; save stat copies carry `colorBindings`. Name it in the landing message.

## Acceptance criteria

- [x] The plan is "none" when nothing applies, and the model keeps its own colors. `avatarLook.test.ts` "is none on every channel when nothing applies"; the viewer resets a null plan.
- [x] A stat at half its range gives one blend step with `t` 0.5; past the max, `t` is 1. "gives a stat at half its range one step at 0.5" and "stops a stat past its max at the target"; removing the clamp turns the second red.
- [x] Two stats on one channel give two steps in authored order. "orders two stats on one channel by the authored order" and the GameViewer test on stat-tree order; dropping the sort turns both red.
- [x] A trait pin sets the start color, and stats blend on from it. "starts from a trait pin in place of the player's color" and the GameViewer color test.
- [x] A non-VRM entity ignores color bindings without errors. `GamePanels.entityMorphs.test.tsx` "ignores a color binding on a non-VRM model"; resolver test for a model with no channels.
- [x] A color binding edited in the world shows in a loaded save. `GameplayContext.bindingRefresh.test.tsx` "shows a color binding the author added after the save was made".
- [x] Frames on a model with separate face and body skin materials at `t` 0, 0.5 and 1: `.scratch/frames/skin-blend-0.png`, `-50.png`, `-100.png` (Playwright, app light). Aki (Face_00_SKIN and Body_00_SKIN), skin toward #6b4630 and hair toward #b5522a.

For you: check that the halfway skin and hair colors look natural, not muddy (frames above, then in play).

## Landed

**Not verified**
- Nothing unticked. The face and body skin blend apart as specified. The body skin frame shows the known median bug: Aki's body skin turns pale yellow, not tan, because the tights share its texture and set its median (#4c3c3b). Ticket 06, "Material Color From the Skin Cluster", fixes it, and the player's Skin Color picker with it.

**For you**
- For you: check that the halfway skin and hair colors look natural, not muddy (frames above, then in play). Frames: `.scratch/avatar-look-bindings-04/frames/skin-blend-0.png`, `skin-blend-50.png`, `skin-blend-100.png`.
- An owned stat's or trait's Colors rows read "Not on this model" whenever the owner has a 3D model, though in play the entity's Avatar takes the colors. The editor checks the 3D model, as ticket 01 set up for sliders.
