# 07: Mention Hover Cards

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A resolved mention in narration links to its entity and opens a small card.

- **Links:** mention links go through the renderer's remark-plugin and component props, as stable references. They stay subtle, so narration still reads as prose.
- **Opening:** hover opens the card on desktop, and tap opens it on touch devices.
- **Content:** the card reads from the Player View only.
  - Met entities show under their true name.
  - Unmet strangers show under the label the player saw.
  - No hidden or AI-only content appears.
- **Design approval:** a hover card is a new visual pattern. Build it as a design-system entry with a dev-router showcase, and get the user's approval before it ships.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] Resolved mentions render as links, and unresolved text is unchanged.
- [ ] The card for an unmet stranger never shows its true name or hidden content. The test runs through the Player View.
- [ ] Tapping opens the card on touch devices, and keyboard focus opens it too.
- [ ] Frames: `.scratch/frames/mention-card-light.png`, `mention-card-dark.png` and `mention-card-mobile.png`.

For you: approve the card design.
