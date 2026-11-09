# 06: Material Color From the Skin Cluster

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Image analysis inside the viewer's tint path, which both the bindings and the player picker share. A wrong cluster breaks every tinted model.

## What to build

A tinted material keeps its real color (Q21). Today the viewer finds each material's color as the plain texture median and scales the material by target ÷ median. On a texture atlas where other parts outnumber the skin, the median is wrong. On Aki, the body skin atlas holds black tights, so its median is #4c3c3b. Blending skin toward tan then turns the real skin (#f9d4b9) pale yellow. The player's own Skin Color picker has the same bug.

- Find each material's color from its dominant color cluster, not the plain median, so baked-in clothing and shadows don't pull it. Choose the method from what the textures need (for example, the median of the largest lightness/hue cluster) and say in the landing message why it beats the others you tried.
- Both readers use it: the bindings' per-material blend (ticket 04) and Customization's seed and tint.
- Skin, eye and hair channels all use it. Don't change materials with a single flat color.
- Add a changelog fragment under Fixed (the player's Skin Color picker).

## Acceptance criteria

- [x] Aki's body skin blends toward tan as tan, not yellow: frames at `t` 0, 0.5 and 1, `.scratch/frames/aki-skin-blend-0.png`, `-50.png`, `-100.png` (Playwright, app light). Verified: Playwright frames toward #8d5524; neck and face match at each step. `aki-skin-blend-50-before.png` shows the old yellow neck. Body seed #4c3c3b → #fae4cf.
- [x] The player's Skin Color picker tints Aki's body and face to the same tone: `.scratch/frames/aki-skin-picker.png`. Verified: frame with pick #c68642; neck and face match.
- [x] Aurelia and Praline tint as they did for skin, eye and hair: before/after frames, `.scratch/frames/<model>-<channel>-before.png` and `-after.png`. Verified: pairs match by eye; seeds moved by at most one level (Aurelia skin #f0caba → #f0cabb, eye #58692b → #596a2b; Praline unchanged).
- [x] A unit test on a synthetic atlas (mostly black, some skin) returns the skin color; the plain median would not. `textureMedian.test.ts`, "returns the skin on an atlas where dark garments outnumber it" and its plain-median contrast.
- [x] Mutation: swap back to the plain median, and the atlas test fails. Verified: `dominantClusterRGB` returning `medianOpaqueRGB` failed the atlas test; scoring runs by count instead of light failed it too.

## Landed

**Not verified**
- Nothing unticked. Extras keep the plain median (Q1): the harness read Aki's Tops color as #fcf1e8, the plain median.

**For you**
- For you: compare the before/after frames for each bundled Avatar and judge whether the tints look right. Sheets: `.scratch/avatar-look-bindings-06/frames/aki-sheet.png` (old t=0.5, then t 0, 0.5, 1, picker), `aurelia-sheet.png` and `praline-sheet.png` (before/after pairs for skin, eye, hair).
- Aki's tights now darken with a tan body instead of turning orange-brown, since the body tint scales the whole atlas. Check that it reads well in play.
