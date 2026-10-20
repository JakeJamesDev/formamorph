# 08: Followers and Positions in Play

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Player-facing UI. The follower mark is a new visual pattern: get the user's approval before building it.

## What to build

The player sees who follows them in the entity panel, and the Map shows where each tracked entity they've met is right now. Entities they haven't met never show.

## Acceptance criteria

- [ ] The save gains the met set. An entity joins it the first time it is in the scene list with its name revealed; an alias-only stranger joins once named.
- [ ] The entity panel marks followers, in a style the user approved.
- [ ] The Map shows the live position of each tracked entity in the met set, and nothing for others.
- [ ] Verified with the verify-ui skill through a dev route, both themes.
- [ ] Save-shape reminder in the landing reply.
