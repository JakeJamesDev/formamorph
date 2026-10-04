# 04: Take Me There button

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

An answer whose top source has a route gets a Take Me There button, and a click opens that surface.

- The button sits beside the Sources expander in the answer's footer row, in the minimal and the full chrome. It renders only when the top source section carries a route; a route on a later source does not count.
- A click sends the navigation request with that id. On desktop the window stays where it is. On mobile the sheet closes.
- The trace carries the chosen route per answer, so AI Context names it.
- The label is "Take Me There", in the help voice. The button appears once the answer is done.

- A Formaquestion surface (the window's own tabs, its Settings tabs, Compare, AI Context) is consumed by the window itself: it switches its tab or opens its own Settings, and sends no app-level request (Q30).

Spec: Q18, Q23, Q24, Q30; Implementation → Help session and window.

Recommended model rationale: component work across two chromes, the mobile sheet and the trace, on top of a fresh seam.

## Acceptance criteria

- [ ] The button renders only when the top source has a route; absent for a routeless top source even when a later source has one.
- [ ] A click sends the request with that id; on mobile the sheet closes; on desktop the window stays.
- [ ] AI Context shows the route for the answer.
- [ ] Each guard proven by reinstating the old behavior.
- [ ] The four gates are green.
