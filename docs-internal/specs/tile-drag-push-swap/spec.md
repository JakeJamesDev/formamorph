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

## Prototype

`prototype.html` (needs the dev server on 5180). Left board runs the shipped sim; right board runs the proposal. Controls: rest delay, live vs release preview, push distance.

## Open Questions

- **Push distance.** One carried span blocks when the target tile is bigger than the carried one. Push-until-clear blocks when the row has no slack at the edge. Should a bigger target swap instead?
- **Grouping gesture.** Shipped drag-to-group arms on a rest over an immovable tile. The new design uses the same rest to push or swap, so grouping needs a new trigger.
- **Rest delay and preview mode.** Values to feel out in the prototype.
