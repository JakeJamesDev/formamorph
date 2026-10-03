# 11: Supporters Wall

Status: ready-for-human
Status note: Built. Server commits 9d5dccf and aeff7e2 in FormamorphServer, client commit b5ff0486. The wall excludes suspended accounts (spec session ruling): a wall name must open a profile. Live look at both viewports and themes was done with computed styles and one mobile screenshot.
Base: 6f2f5727
Blocked by: 04, 08
Deliberate exception: "Each name uses the shared name components" is met in part. [SupportersPage.tsx](../../../../site/pages/SupportersPage.tsx) builds the name anchor itself and reuses the shared `SupporterBadge`, `UserAvatar` and `SUPPORTER_NAME_STYLES`. `UserName` opens the in-app profile through the profile store, which the site does not have, and the site `ProfilePage` makes the same call. The name links to `/u/<name>` instead.
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: FormamorphServer, then formamorph
Spec: ../spec.md (Rulings Q5, Q12, Q13, Q15; A7; Implementation Decisions › Account routes, Supporters wall)

Model rationale: one public route and one site page. The order and the exclusion rules are small and fully stated.

## What to build

Anyone opens `/supporters` on formamorph.ai and sees the linked supporters. Supporter+ names come first, in their own section. Inside each section, the longest tenure comes first. Each name carries its flair and links to the public profile.

The server part lands first.

## Acceptance criteria

Server:

- [ ] A public wall route returns the supporters in display order: Supporter+ first, then earliest pledge start first. A null pledge start sorts last in its section.
- [ ] Each row has the account ID, username, Profile Image URL, tier, and pledge start.
- [ ] The wall includes staff who support. It excludes every account with the flair toggle off and every account with no tier.
- [ ] Route tests cover the order, a staff supporter, the toggle off, a lapsed member, and a null pledge start.
- [ ] Server gates green.

Client:

- [ ] The site has a `/supporters` page with two sections, Supporter+ and Supporter. An empty section does not show.
- [ ] Each name uses the shared name components, so it shows the badge, the color, and the ring, and it links to the profile.
- [ ] An empty wall shows a short line and the **Become a Supporter** link.
- [ ] The landing page footer and the Patreon section link to the page.
- [ ] The privacy page says that Formamorph stores the Patreon user ID and the tier for a linked account, and that unlink and account deletion remove them.
- [ ] Page tests cover both sections, the order as sent, and the empty wall, against a mocked response.
- [ ] `verify-ui` evidence at a desktop and a mobile viewport, in both themes.
- [ ] A changelog line in In Progress.
- [ ] Four gates green.
