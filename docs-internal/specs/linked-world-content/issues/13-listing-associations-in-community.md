# 13: Listing associations in Community

Status: ready-for-agent
Blocked by: 04, 07
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: read-only presentation over server fields that ticket 04 returns, plus one not-found path in the browser.

## Parent

[spec.md](../spec.md) — Settled follow-up decisions (Unlisted, Relationships over time), Missing sources and offline use.

## What to build

Players see where content fits before they download it, and unlisted content stays invisible.

A component's community details show a **Compatible Worlds** list: its approved and community associations with the world author's review state, linked to each world. Declined associations are not shown. A world's community details name its required components, with **Not recommended by the world author** where the world author declined an add-on the player reaches by another path. Downloading a component offers its associated worlds without downloading them.

An unlisted listing opened by direct link by anyone but its author or staff renders the same not-found state as a missing listing. Author and staff open it normally and can download it standalone.

## Acceptance criteria

- [ ] A component's details list its approved and community worlds with review state; a declined world is absent.
- [ ] A world's details list its required components.
- [ ] Downloading a component with associations offers those worlds and installs only the component.
- [ ] A direct link to an unlisted listing shows not found for another player, and the full listing with a standalone download for its author and for staff.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 04 — Server: listing relationships and Unlisted.
- 07 — Manage Add-ons review.
