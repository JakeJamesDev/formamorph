# 03: World Editor Scripts Tab

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a SortableTree adapter with a refused cross-group drop, and a second editing surface over the same objects.

## What to build

The World Editor gets a top-level **Scripts** tab. Its tree shows the five timings as groups and every script in the world as a row under its timing, in run order, labeled by name or by owner and timing (Q18, Q6). Drag reorders rows within a timing and writes `order`; a drop into another timing is refused (Q4, Q5). Clicking a row opens the same box the owner's editor shows, inline beside the tree, with a jump-to-owner link (Q25). The tab's Add Script creates a world-owned script in the picked timing. World scripts run with an empty `self` and `owner`.

Spec: Q4, Q5, Q18, Q25, stories 2, 3, 4.

## Acceptance criteria

- [ ] The tree lists every stat, trait and world script under its timing in the order the runner uses
- [ ] A drag within a timing changes `order` on the moved scripts and the runner follows it; a drag across timings snaps back
- [ ] Editing in the tab and in the owner's editor change the same script; a test edits in one and reads in the other
- [ ] Add Script in the tab adds a world script, and that script runs in its timing with `self` and `owner` empty
- [ ] Undo covers a reorder, an add and an edit from the tab
- [ ] Four gates green

## Blocked by

- 02
