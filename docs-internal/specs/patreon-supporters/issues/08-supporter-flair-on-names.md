# 08: Supporter Flair on Names

Status: ready-for-agent
Blocked by: 04, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Rulings Q2, Q4, Q6; A5; Implementation Decisions › Flair display)

Model rationale: two shared components and a sweep of the surfaces that bypass them. Approved patterns, moderate surface.

## What to build

A supporter's name shows its flair wherever other people see it: the badge, the tier name color, and the Profile Image ring. The badge tooltip states the tenure.

The shared username and Profile Image components read the author's `supporter` field. A surface that uses them gets the flair with no change of its own.

## Acceptance criteria

- [ ] The author type carries `supporter` as null or `{ tier, since }`. An old server that sends no field reads as null.
- [ ] The shared username component draws the tier badge and the tier name color from the approved patterns of ticket 07.
- [ ] The shared Profile Image component draws the ring.
- [ ] The badge tooltip states the tenure in whole months, then in years and months. It shows no tenure when `since` is null.
- [ ] The client adds no staff rule. A null `supporter` from the server shows no flair.
- [ ] The flair shows on community cards, the listing detail, comments, feedback threads and replies, notifications, the in-app profile dialog, and the site profile page. Contest entries show it during voting.
- [ ] A surface that draws a name without the shared components is moved to them, or is listed in the hand-over with the reason. Contest podiums and the reports queue stay plain.
- [ ] Component tests cover each tier, null, a null `since`, and the tenure wording at 0 months, 11 months, and 14 months.
- [ ] `verify-ui` evidence on a card, a comment, and a profile, in both themes.
- [ ] A changelog line in In Progress.
- [ ] Four gates green.
