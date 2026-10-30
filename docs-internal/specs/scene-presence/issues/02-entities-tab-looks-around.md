# 02: Entities Tab Looks Around

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Entities tab lists **Look Around**: everyone here the player would see if they looked around. People in scene come first and quiet ones after. Strangers show by their label. Clicking a met person opens the full popup as today. Clicking a stranger opens a reduced popup with the label, the image and the Stranger Description only.

## Acceptance criteria

- [ ] Through the GamePanels harness, the tab lists In Scene entities first, then the quiet Look Around entities.
- [ ] A stranger row shows its label, never the true name. A stranger with no label is not listed.
- [ ] A stranger's popup shows the label, image and Stranger Description, and no name, description or stats.
- [ ] A met person's popup is unchanged.
- [ ] The Entities tab no longer reads the live scene list directly.
- [ ] Frames `.scratch/frames/entities-look-around-light.png` and `.scratch/frames/entities-look-around-dark.png` at 1400 px wide show a quiet group and a stranger row.

For you: play a few turns in Emberwatch and check that the quiet group in the Entities tab feels right.
