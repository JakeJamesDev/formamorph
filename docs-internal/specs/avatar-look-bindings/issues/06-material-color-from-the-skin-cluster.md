# 06: Material Color From the Skin Cluster

Status: ready-for-agent
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

- [ ] Aki's body skin blends toward tan as tan, not yellow: frames at `t` 0, 0.5 and 1, `.scratch/frames/aki-skin-blend-0.png`, `-50.png`, `-100.png` (Playwright, app light).
- [ ] The player's Skin Color picker tints Aki's body and face to the same tone: `.scratch/frames/aki-skin-picker.png`.
- [ ] Aurelia and Praline tint as they did for skin, eye and hair: before/after frames, `.scratch/frames/<model>-<channel>-before.png` and `-after.png`.
- [ ] A unit test on a synthetic atlas (mostly black, some skin) returns the skin color; the plain median would not.
- [ ] Mutation: swap back to the plain median, and the atlas test fails.

For you: compare the before/after frames for each bundled Avatar and judge whether the tints look right.
