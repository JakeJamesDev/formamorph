# Spec: Tile Drag Push / Swap (Android Home Layout)

Status: exploring (prototype only)

## Problem Statement

The shipped cell simulation reflows the board under the hand on every cell of travel. Tiles dodge the instant the carried footprint sweeps them, so a long drag leaves a trail of moves the player did not intend.

## Proposal

Mirror an Android home screen:

| Gesture | Result |
|---|---|
| Rest on a spot in the **same row or column** as the pickup | Tiles between pickup and target **push** toward the hole |
| Rest on a spot in a **different row and column** | Tiles under the target **swap** into the hole, offsets intact |
| Rest on an open spot | Nothing else moves |
| Push or swap would leave the board or land on a bystander | **Blocked**; release snaps the tile home |

Nothing moves until the hand has rested. Every preview is computed from the pre-drag board, so leaving a spot undoes it.

### Folder vs move

The pointer picks the target tile, and the footprint snaps to that target: equal sizes take the target's exact cells; a bigger carried tile must contain the target; a smaller one sits inside it. Within that range the anchor nearest the pickup home wins, skipping placements that would block. The grab offset only matters in open space, where the footprint follows the pointer's cell minus the grabbed cell.

A line runs from the pickup home's center to the target's center. A plane perpendicular to it cuts the target so the far slice covers a set share of the target's extent along the line (default 50%). Pointer in the far slice after the rest = push or swap. Pointer anywhere else on the target = folder, shown as a ring on the target. A folder tile as the target means add to folder; folders never nest.

## Prototype

`prototype.html` (needs the dev server on 5180). Left board runs the shipped sim; right board runs the proposal. Controls: rest delay, live vs release preview, push distance, move-slice share, and a line-and-plane guide overlay. Folders are simulated as a highlight only.

## Open Questions

- **Push distance.** One carried span blocks when the target tile is bigger than the carried one. Push-until-clear blocks when the row has no slack at the edge. Should a bigger target swap instead?
- **Slice share.** 50% by default; the slider is there to feel out touch targets.
- **Rest delay and preview mode.** Values to feel out in the prototype.
