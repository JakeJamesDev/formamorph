# 07: Route skips the lead

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Take Me There button shows for a routed answer when Use the Open Screen is on.

- Today the route comes from the first source. With Use the Open Screen on, the first source is the open screen's lead section, a page intro with no route line, so the button never renders.
- The route comes from the first source that is not the lead, as the follow-up topic rule already does. When the lead is the only source, it is the route's source.
- The done event carries the lead, so the window needs no new data.

Spec: Q18, Q36, Q37; Implementation → Help session and window.

Recommended model rationale: a one-line rule change with a precedent beside it and a focused test.

## Acceptance criteria

- [ ] With a routeless lead first and a routed hit second, the button renders for the hit's route.
- [ ] With the lead as the only source, its route (or none) decides.
- [ ] The guard bites: reinstating the first-source rule fails the test.
- [ ] A mounted-window test with Use the Open Screen on shows the button on an answer whose first hit has a route.
- [ ] The four gates are green.
