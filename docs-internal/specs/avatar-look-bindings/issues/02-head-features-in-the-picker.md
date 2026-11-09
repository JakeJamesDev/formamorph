# 02: Head Features in the Picker

Status: ready-for-human
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

- [x] On a model with head keys, the stat picker shows Body Sliders and Head Features under the model's heading. Group headings "Aurelia · Body Sliders" and "Aurelia · Head Features" read on the preview (frame); test `splits a world stat model into Body Sliders and Head Features`.
- [x] Expression and lip-sync keys don't appear. The picker reads the existing morph catalog, which hides them; the preview lists only Ear Shape, Tusks, Cat Ears and Fox Tail under Head Features.
- [ ] An owned stat's picker splits its owner's model the same way. Per the spec session's ruling, a non-VRM entity model lists Body Sliders only (test `lists an entity model under Body Sliders only`).
- [ ] A stat bound to Ear Shape moves the ears in play.
- [ ] Frame: the open picker on the world stats editor, `.scratch/frames/picker-head-features.png`, light and dark, 1280 wide.

## Landed

**Not verified**
- A stat bound to Ear Shape moves the ears in play. The picker change only lists the key. The viewer already applies a bound name to every mesh that carries it, but I did not run a game.
- Frame in light mode. Only the dark frame exists: `.scratch/avatar-look-bindings-02/frames/picker-head-features-dark.jpg`. A class swap did not repaint the pane, so I stopped.
- An owned stat on a VRM entity model. The owner picker reads every entity model through the non-VRM loader, so it never shows Head Features. No test covers a VRM owner.
- The 1280-wide frame is a 1280-wide viewport scaled by the pane to 800 pixels.

**For you**
- Open the stats editor with a model that has head keys and check the group headings read well: `.scratch/avatar-look-bindings-02/frames/picker-head-features-dark.jpg`.
- Decide whether the field label "Body Sliders" should now read "Sliders", since the list holds Head Features too.
