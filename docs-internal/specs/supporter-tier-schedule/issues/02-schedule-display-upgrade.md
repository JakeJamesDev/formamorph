# 02: Client: Tier schedule display and upgrade prompt

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extend one pure rule, one mark component and one button state, using existing test prior art.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

Everyone sees a listing's full schedule on the card and in the details window: each tier's opening date and the public date, under the tier display names (Q2). A listing with no tier rows still reads as today. A Supporter whose tier hasn't opened sees an upgrade state that opens the same Patreon page as today's Patreon state (Q7). Once their tier opens, the normal Supporter download state shows. A Supporter who downgrades below the open tier keeps their Supporter Copy, and a full lapse still removes it (Q1). This ticket owns the client's schedule type and its parsing of the catalog and entitlement payloads. Ticket 03 imports it.

## Acceptance criteria

- [ ] The listing-action rule returns the upgrade state for a qualifying account below the open tier, the Patreon state for a non-qualifying account, and the download state once the tier opens.
- [ ] The button's upgrade state opens the Patreon page.
- [ ] The schedule mark shows each tier's date and the public date. A listing with only a public date reads as today's mark.
- [ ] The sync test: an account that downgrades below the open tier keeps its Supporter Copy, and a full lapse removes it.
- [ ] Copy passes the Writing Guide (`copy-sweep` skill).
- [ ] Frames of the card and details window with a three-stage schedule, light and dark, at 1280 wide: `.scratch/frames/schedule-card-light.png`, `.scratch/frames/schedule-card-dark.png`, `.scratch/frames/schedule-details-light.png`, `.scratch/frames/schedule-details-dark.png`.
- [ ] A changelog fragment in `docs-internal/changelog.d/`.

For you: the upgrade prompt's wording on a Supporter-only card in Community Creations.
