# 13: Mention Card Portrait

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The mention card shows the entity's portrait in place of the initial (spec Q51).

- **Look:** the user picked "Larger portrait" from a mock with real Emberwatch portraits: a 48×56 rounded crop, anchored to the top of the image. The initial stays as the fallback when there is no visible image. Mock: `.scratch/character-mentions-07/frames/mention-card-image-both.jpg` (bottom card in each panel).
- **Player View:** the Player View entity gains the image the player can see. The Player View module is shared with Formaquestion, so the new field must not change what Formaquestion reads or sends.
- **Visibility:** any entity with a Player View row shows its image, met or not, but only when the image's `requires` gate passes (Image Visibility Rules). A failed gate shows the initial.
- **Design System:** update the mention-card showcase entry.
- **Changelog:** fold into the hover-card entry if it is still unreleased.

## Acceptance criteria

- [ ] The card shows the portrait for a met entity and for a seen stranger, and the initial when there is no image.
- [ ] An image whose `requires` gate fails never reaches the card. The test runs through the Player View and is proved by reinstating the leak.
- [ ] Formaquestion's Player View output is unchanged.
- [ ] Frames: light, dark and mobile, with and without an image.
