# 07: Staff Review Shows Derived Labels and Bulk-Rejects

Status: done
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Mentions queue in the Admin Panel lets staff clear large batches fast and judge each row by what the player saw.

- **No-change mark:** a row that changes no label shows a "no label change" mark.
- **Bulk reject:** one action rejects every pending row that changes no labels. It first asks for confirmation and shows the count.
- **Row detail:** derived labels appear in a separate list from the player's own corrections. Each quote fix shows the speaker the player saw and the rule that picked it.
- **Older rows:** rows without the new fields show as they do today.

## Acceptance criteria

- [x] A row that changes no label shows the mark. A row with a mention correction does not. (`MentionsTab.test.tsx`: marks a row that changes no label; DOM read on the dev route)
- [x] The bulk reject asks first and shows the count, then clears those rows from the queue. (test: asks with the count first, rejects only the no-change rows; cancel rejects nothing)
- [x] Derived labels show in their own list on the row detail. (test: lists derived labels apart from the corrections)
- [x] Each quote correction shows the speaker the player saw and the rule. (test: shows each quote fix with the speaker the player saw and the rule)
- [ ] Frames of the queue and of a row detail, in light and dark themes at desktop width:
  - `.scratch/frames/queue-light.png`
  - `.scratch/frames/queue-dark.png`
  - `.scratch/frames/detail-light.png`
  - `.scratch/frames/detail-dark.png`

## Landed

**Not verified**
- The frames: the Browser pane is about 800 px wide, so each frame clips the right edge of the panel. Light is the `light` class on the graphite theme.
- The bulk reject against the real server: tests and the dev stub serve the route, FormamorphServer was not run.

**For you**
- Open Admin Panel → Moderation → Mentions (`#dev?modal=adminPanel&tab=moderation&subtab=mentions&fixture=review`): judge the "No label change" mark, the **Reject N With No Label Change** button and its dialog, the "From quote fixes" list, and the rule wording in the quote lines.
- No changelog entry: staff tools get none.
