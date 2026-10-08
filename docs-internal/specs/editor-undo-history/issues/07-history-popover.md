# 07: History popover, desktop and mobile

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: UI against a settled prototype and an existing popover pattern; the list and the pill are the work, with a Design System entry.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The History view (Q12, Q15, Q16, Q20). The prototype is on branch `prototype/editor-history-bar` at `ba8acd8c`; desktop takes variant B, mobile takes variant A's header.

- Desktop: the split pill at the head of the app bar's end slot gains its third face, a chevron that opens the popover. The three faces are joined; the chevron carries a "History" tip and reads pressed while open.
- Mobile: one History icon in the header, between the mode select and the Bench. Its popover head holds Undo and Redo.
- The popover is not portaled, like the Bench popover, so it works inside the in-game host. It lists the fixed World opened head, every Step with its label, the Saved marker, and the dimmed future, with the current Step marked. Rows use the menu row style; the list scrolls inside the popover.
- Clicking any row jumps there through the hook. Note from ticket 02: `jump` writes against the recorder's last-seen world, so a write in the same handler before a jump is overwritten for shared slices. A row click must not write anything else in its handler.
- Dev route: `#dev?modal=worldEditor&history=open` opens the popover. The route registry lists it.
- The split pill is a new visual pattern. The Design System gets a pattern entry and the showcase a reference.

## Acceptance criteria

- [ ] Desktop pill: three joined faces, chevron opens the list, tips on all three.
- [ ] Mobile at 390px: one History icon; the popover head holds Undo and Redo; the header does not wrap.
- [ ] The list shows World opened, labels, the current row marked, undone rows dimmed, the Saved marker after the saved Step.
- [ ] Clicking a past row undoes to it; clicking a dimmed row redoes to it; clicking World opened restores the loaded baseline.
- [ ] A long list scrolls inside the popover.
- [ ] The dev route opens the popover and the route-drift test lists it.
- [ ] Design System pattern entry and showcase reference exist and the showcase test covers the reference.
- [ ] Both themes checked with static frames through the dev route.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
