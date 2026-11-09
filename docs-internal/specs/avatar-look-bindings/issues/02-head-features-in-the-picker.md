# 02: Head Features in the Picker

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Loader and picker plumbing on an existing pattern. Bounded scope.

## What to build

An author can bind a stat to a Head Features slider such as Ear Shape (Q8).

- **This ticket owns the shared slider picker** that the stat editor uses now and the trait editor uses in ticket 03. It keeps one group per model and splits each into **Body Sliders** and **Head Features**, from the morph catalog, with Customization's exclusions (expressions and lip-sync stay hidden).
- The morph-name cache stores the split, so world stats, owned stats and library models all get it.
- Ticket 01 removes the one-stat-per-slider exclusion. If 01 has not landed, keep the exclusion as it is; don't remove it here.
- Update the docs pages that list what the picker shows.

## Acceptance criteria

- [ ] On a model with head keys, the stat picker shows Body Sliders and Head Features under the model's heading.
- [ ] Expression and lip-sync keys don't appear.
- [ ] An owned stat's picker splits its owner's model the same way.
- [ ] A stat bound to Ear Shape moves the ears in play.
- [ ] Frame: the open picker on the world stats editor, `.scratch/frames/picker-head-features.png`, light and dark, 1280 wide.
