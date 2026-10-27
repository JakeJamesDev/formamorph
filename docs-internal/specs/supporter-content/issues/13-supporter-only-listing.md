# 13: Client: Supporter-only listing in Community Creations

Status: ready-for-agent
Blocked by: 08, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: button states and one staff toggle on top of existing controls and the module from ticket 11.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

On a Supporter-only listing, Download is replaced by Install for a Supporter, a Patreon button for a signed-in non-supporter, and Sign In when signed out (Q19). Everyone can still see, like and comment. Staff get a Supporter-only toggle in the staff listing controls from ticket 08.

## Acceptance criteria

- [ ] The button reads Install, Patreon or Sign In by sign-in state and qualification.
- [ ] Install installs through the Supporter content module and then shows the item as installed.
- [ ] Likes and comments work for non-supporters on a Supporter-only listing.
- [ ] Only staff see the Supporter-only toggle.
- [ ] Component tests cover each state.
- [ ] Frame `.scratch/frames/supporter-only-listing.png`, both themes, at 1440 and 390 wide.
- [ ] The Community Creations docs page covers Supporter-only listings.
