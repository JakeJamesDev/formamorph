# 02: ScrollArea for the History list

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a one-component swap with a known-good recipe; the live wheel check is the only real risk.

Parent: [History Row Labels spec](../spec.md)

## What to build

The History popover's list scrolls in the shared ScrollArea, with the arrowless 10px thumb from the Design System. The list stays capped at half the screen height. The current row still scrolls into view when the list opens.

- Replace the native scroll box with ScrollArea, with the height cap on the ScrollArea itself.
- Remove the file's `scroll-guard: allow popover-list` comment and the stale comment claiming a ScrollArea cannot resolve a max height.
- The popover stays unportaled, so the editor dialog's wheel lock does not intercept it.

This ticket and ticket 03 both edit the History controls component. Ticket 03 rebases over this one.

## Acceptance criteria

- [ ] The scroll guard test passes with no allow comment in the History controls file.
- [ ] Guard bites: putting the native box back without the comment fails the scroll guard.
- [ ] Live check through `verify-ui` on the `history=open` dev route, with enough Steps to overflow: the viewport stops at the cap, wheel scrolling moves it inside the editor dialog, the shared thumb shows, and no native scroller remains in the popover.
- [ ] The existing History popover tests pass.
- [ ] Four gates green.
