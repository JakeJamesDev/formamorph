# Spec: Patreon Supporters

Status: ready-for-agent
Spec session: patreon-supporters — spec
Status note: 12 tickets in issues/. 01 and 02 are prefactors. 01, 02, 03, and 07 can start now. 07 ends at the user's design approval, and 12 is the user's live check. The work spans both repos, and the server part lands first.

A Patreon member links their Patreon account to their Formamorph account and gets **Supporter Flair**: a badge, a name color, a Profile Image ring, and a place on the Supporters wall. Designed in a grilling session on 2026-10-02 against the client code, the server code, and the Patreon API v2 documentation.

## Problem Statement

Patreon members pay for the project, and Formamorph does not know who they are. A member gets nothing inside the community that shows their support. The project has no way to thank them by name.

The thanks must not lock a feature. A player who does not pay keeps every function of the game.

The thanks must also be opt-in. A Patreon member who never links an account stays unknown to Formamorph, and their name appears nowhere.

## Solution

A member selects **Link Patreon** in their account settings, approves the request on Patreon, and returns. From then on the server reads their tier from Patreon and keeps it current.

| Tier on Patreon | Name in Formamorph |
|---|---|
| $5 | **Supporter** |
| $10 | **Supporter+** |

A linked member with a tier gets Supporter Flair wherever their name shows to other people:

| Flair | Supporter | Supporter+ |
|---|---|---|
| Badge beside the name | Supporter badge | Supporter+ badge with its own style |
| Badge tooltip | Tenure of the current pledge | The same |
| Name color | One fixed color | A second fixed color |
| Profile Image ring | Ring in the Supporter color | Ring in the Supporter+ color |
| Supporters wall | Listed after Supporter+ | Listed first |

The **Supporters wall** is a page on formamorph.ai. It lists only linked accounts.

One toggle, **Show Supporter Flair**, hides all of it. When the membership ends, the flair goes away. When it starts again, the flair comes back with no new link.

The app's User Profile dialog gets a **Settings** tab. It holds email, password, account deletion, and the Patreon link. The dialog header keeps only **Log Out**.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Perks follow the tiers Patreon says the member is entitled to. Trials, gifts, and Patreon's grace period count. |
| Q2 | A staff account shows only its staff badge beside the name. |
| Q3 | The first version has the badge, tenure, name color, and the Supporters wall. Preset titles are out. |
| Q4 | Flair shows on contest entries during voting. |
| Q5 | Supporter+ gets a distinct badge style and the top section of the wall. |
| Q6 | Tenure resets after a lapse. It counts from the start of the current pledge. |
| Q7 | The name color is fixed. The member does not pick it. |
| Q8 | One toggle, **Show Supporter Flair**, on by default. Off hides the badge, color, ring, and wall entry together. |
| Q9 | Each tier has its own solid name color. |
| Q10 | The Profile Image gets a ring in the tier color. |
| Q11 | Linking works from the site and from the app. The app's User Profile dialog gets a Settings tab with email, password, delete, and Patreon. The header keeps only Log Out. |
| Q12 | The wall is a page on formamorph.ai. |
| Q13 | Staff who support appear on the wall. |
| Q14 | Unlink removes the flair at once. The Patreon account can link to another Formamorph account right away. |
| Q15 | The wall sorts Supporter+ first, then longest tenure first inside each group. |
| Q16 | The Settings tab restructure is the first ticket of this effort. |
| Q17 | The Steam build does not use these accounts. No Steam rule shapes this effort. |

Settled before the grilling:

- A lapsed member loses every perk.
- Personal cosmetics (themes, alternate art, app icons) are out of scope.
- The wall lists linked accounts only, never the full Patreon member list.

Accepted without a numbered ruling:

| # | Assumption |
|---|---|
| A1 | A linked account with no tier stays linked. Its status reads "No active membership". |
| A2 | The site and the app show a **Become a Supporter** link to accounts with no tier. |
| A3 | The in-app link flow opens the system browser. The callback is on the server, and the member confirms the link signed in on the site (see the ticket 03 rulings). |
| A4 | Flair reads live everywhere. A lapsed supporter loses flair on old feedback replies too. |
| A5 | Contest podiums show no flair. A placement stores only a name. |
| A6 | Tiers map by Patreon tier ID in server configuration. A new tier needs a configuration change. |
| A7 | Account deletion removes the link. The privacy page says that Formamorph stores the Patreon user ID. |

## User Stories

### Members

1. As a Patreon member, I want to link my Patreon account from the account site, so that Formamorph knows I support it.
2. As a Patreon member, I want to link from the app's Settings tab, so that I do not have to find the website first.
3. As a member, I want the link flow to open Patreon's own approval page, so that I never type my Patreon password into Formamorph.
4. As a member, I want to see my link status and my tier after I return, so that I know the link worked.
5. As a member in the app, I want the status to update when I return from the browser, so that I do not have to restart.
6. As a $5 member, I want a Supporter badge beside my name, so that other people see my support.
7. As a $10 member, I want a Supporter+ badge that looks different, so that the higher tier is visible.
8. As a supporter, I want my name in my tier's color on listings, comments, feedback, and profiles, so that my support shows wherever I take part.
9. As a supporter, I want a ring around my Profile Image, so that my support shows where the badge does not fit.
10. As a supporter, I want the badge tooltip to say how long I have supported, so that long support is visible.
11. As a supporter, I want my name on the Supporters wall, so that the project thanks me in public.
12. As a Supporter+ member, I want my name in the top section of the wall, so that the higher tier has a visible place.
13. As a long-time supporter, I want the wall to list longer tenure first, so that my time counts.
14. As a supporter who values privacy, I want one toggle that hides all flair, so that I can support without a public mark.
15. As a supporter who turned the flair off, I want my name absent from the wall, so that the toggle covers everything.
16. As a member who upgrades or downgrades, I want my badge to change without a new link, so that the flair matches my pledge.
17. As a member on a free trial or a gifted membership, I want the same flair as a paying member of that tier, so that Formamorph agrees with Patreon.
18. As a member whose payment was declined, I want the flair to follow Patreon's own grace period, so that one failed charge does not remove it early.
19. As a former member who pledges again, I want my flair back without a new link, so that I do not repeat the setup.
20. As a former member, I want my tenure to start again from the new pledge, so that the number is honest.
21. As a member, I want to unlink Patreon, so that I control the connection.
22. As a member with two Formamorph accounts, I want to unlink one and link the other, so that I can move my flair.
23. As a member who deletes their Formamorph account, I want the Patreon link removed with it, so that nothing of mine stays.
24. As a member, I want the privacy page to say what Formamorph stores from Patreon, so that I can decide to link.

### Players without a membership

25. As a player, I want every feature to work without a membership, so that support stays a choice.
26. As a player, I want to see who supports the project, so that I know who helps to keep it running.
27. As a player with no tier, I want a **Become a Supporter** link in my account settings, so that I can find the Patreon page.
28. As a Patreon member who never linked, I want my name to stay off the wall, so that my Patreon identity stays private.
29. As a free Patreon member who linked, I want a clear "No active membership" status, so that I understand why I have no badge.

### Account settings in the app

30. As a signed-in player, I want a Settings tab in the User Profile dialog, so that every account control is in one place.
31. As a signed-in player, I want to add or change my email in the app, so that I do not need the website for it.
32. As a signed-in player, I want password change and account deletion in the same tab, so that the dialog header stays simple.
33. As a signed-in player, I want the header to show only Log Out, so that the destructive controls are not beside it.

### Staff

34. As a staff member who supports, I want only my staff badge beside my name, so that my role reads clearly in threads.
35. As a staff member who supports, I want my name on the wall, so that my support is still thanked.
36. As an administrator, I want one Patreon account to link to one Formamorph account at a time, so that one pledge cannot give many badges.
37. As an administrator, I want forged webhook calls refused, so that nobody can grant themselves flair.
38. As an administrator, I want a missed webhook corrected within the hour, so that a Patreon outage does not leave wrong badges.
39. As an administrator, I want the tier IDs in server configuration, so that a tier change on Patreon needs no code change.

### Old clients

40. As a player on an old build, I want listings, comments, and profiles to load as before, so that the new fields do not break my app.

## Implementation Decisions

### The link (server)

- A new table holds one row per link: the Formamorph account, the Patreon user ID, the current tier, the pledge start date, the flair toggle, and the time of the last check.
- Both the account and the Patreon user ID are unique in that table. A second link to the same Patreon user ID is refused with a clear error while the first exists.
- The server keeps no member tokens. It exchanges the OAuth code, reads the Patreon user ID with the `identity` scope, and discards the member's tokens.
- The link starts with an authenticated call that returns Patreon's authorize URL. The `state` value is signed, short-lived, and bound to the account.
- Patreon redirects to a callback route on the server. The callback verifies `state`, stores the link, reads the member's tier, and redirects to the site's account page with a result.
- Unlink deletes the row. Account deletion deletes the row.

Rulings from ticket 03 (2026-10-02):

- Routes: `POST /api/users/me/patreon/link` returns `{ url }`; `GET /api/users/me/patreon` is the status; `DELETE /api/users/me/patreon` unlinks; `GET /api/patreon/callback` is public. The webhook of ticket 05 is `POST /api/patreon/webhook`.
- The callback redirects to `${SITE_URL}/account?patreon=<result>`. Results: `confirm` with `&token=<t>` (approved on Patreon, the page must confirm), `taken` (the Patreon user ID is held by another account), `denied` (the member refused on Patreon), `expired` (bad or old state), `failed` (a Patreon call failed). The callback never answers `linked`. Ticket 09 reads them.
- `state` is signed with a key derived from the server's JWT secret for the link purpose, so a state cannot pass as a session token and a session token cannot pass as a state. It is bound to the account ID and its token generation and valid 10 minutes. A suspended or deleted account's state stores nothing.
- Confirm: `POST /api/users/me/patreon/confirm`, body `{ token }`, bearer required. 200 returns the status. 400 `PATREON_CONFIRM_REFUSED` covers an unknown, spent, or expired token and a bearer mismatch, with one answer for all four. 409 `PATREON_TAKEN`. The token is spent on any attempt and lives 10 minutes. The tier is read at confirm time.
- A relink replaces the row, so the flair toggle returns to its default, on. A relink is an unlink plus a link (Q14), and nothing from the old row survives.
- A linked account that links again with a different Patreon user replaces its row. That is an unlink plus a link (Q14); the uniqueness check against the new Patreon user ID still applies.
- When the identity read succeeds and the tier read fails, the link is stored with no tier and a null last-check time, and the result is `linked` (A1). The webhook or the hourly job corrects the tier.
- Status shape: `{ linked: false }` or `{ linked: true, tier, since, showFlair }`. `tier` is `supporter`, `supporter_plus`, or null; `since` matches `supporter.since`. The status shows a staff account its real tier; only author payloads null it (Q2).
- **Confirm on return (link injection).** An attacker could start a link on their own account and send the approval URL to a victim; the victim's approval would link the victim's Patreon user to the attacker's account. So the callback does not finish the link. It stores a pending link for 10 minutes and redirects to the site's account page with a one-shot confirm token in the URL. That page, signed in, calls a confirm route with the token and its bearer. The server finishes the link only when the bearer account equals the account in the pending link. The attacker never holds the token, and a victim signed in as themselves fails the match. A3 changes: in the app flow the member signs in on formamorph.ai in the system browser if asked, confirms, then returns to the app. Ticket 09 calls confirm on return; ticket 10 words the return step that way.
- Until ticket 06, the creator token comes from the environment. The server has no tracked example env file; the README's environment block is the example.

### The tier rule (server)

- The tier is the highest mapped tier in the member's `currently_entitled_tiers`. No other field decides it (Q1).
- Two configuration values hold the Patreon tier IDs for Supporter and Supporter+ (A6). An unmapped tier gives no flair.
- The pledge start is Patreon's `pledge_relationship_start`. It can be null. A null start gives a badge with no tenure text and sorts last on the wall.

### Staying current (server)

- One module owns every call to Patreon: the code exchange, the identity read, the member list, and the token refresh. Nothing else calls Patreon.
- The module reads the campaign member list with the creator token. Link time and the reconcile job use the same read.
- The creator token and its refresh token live in the server's settings store, seeded from the environment. The module refreshes the token from `expires_in` and stores the new pair.
- Every request sends a `User-Agent` header. Patreon can refuse a request without one.
- A webhook route receives `members:create`, `members:update`, `members:delete`, and the three `members:pledge:*` triggers. `members:update` is required because gifts do not fire the pledge triggers.
- The webhook route reads the raw body and verifies `X-Patreon-Signature`, the hex HMAC-MD5 of the body with the webhook secret. It compares in constant time and refuses a mismatch.
- A webhook for a Patreon user with no link is accepted and ignored. Applying the same webhook twice gives the same state.
- A reconcile job runs on the existing hourly sweep. It reads the full member list and corrects every link. A link whose member is absent from the list gets no tier.

### Author payloads (server)

- One shared serializer builds the author object for listings, comments, follows, feedback, and profiles. Today about seven places build it by hand. This is a prefactor.
- The author object gains one field, `supporter`. It is null or `{ tier, since }`. `tier` is `supporter` or `supporter_plus`. `since` is the pledge start or null.
- The server decides who shows flair. `supporter` is null when the account has no tier, when the flair toggle is off, and when the account is staff (Q2).
- `supporter` is always read live (A4). Feedback keeps its role snapshot, and the supporter field does not join it.
- **Ruling from ticket 04 (2026-10-02):** the staff rule follows the `role` the same payload shows. Where the payload snapshots the role (feedback), the snapshot decides; everywhere else the live role decides. A name never carries a staff badge and a supporter badge together, and a reply snapshotted as normal shows flair even when the account is staff today. The membership itself stays live.
- The field is additive. Old clients ignore it.

### Account routes (server)

- A status route returns the caller's own link: linked or not, the tier, the pledge start, and the flair toggle.
- A route sets the flair toggle.
- A public wall route returns the supporters in display order: Supporter+ first, then earliest pledge start first (Q15). Each row has the account ID, username, Profile Image URL, tier, and pledge start.
- The wall includes staff (Q13) and excludes every account with the toggle off (Q8). It also excludes suspended accounts: a name on the wall must open a profile (ruling from ticket 11, 2026-10-02).

### Flair display (client)

- The shared username component draws the Supporter badge and the name color from the author's `supporter` field. Every surface that uses it gets the flair with no change of its own.
- The shared Profile Image component draws the ring from the same field.
- A staff badge wins. The server already sends a null `supporter` for staff, and the client does not add a second rule.
- The badge tooltip states the tenure in whole months, then in years and months. It shows no tenure when `since` is null.
- Two new color tokens, one per tier, serve the badge tint, the name color, and the ring. Both themes define them.
- Surfaces that print a stored name snapshot (contest podiums, the reports queue) show no flair (A5).

### Account settings (client)

- The app's User Profile dialog gets a **Settings** tab (Q11, Q16). Email, Change Password, and Delete Account move into it. The header keeps Log Out.
- The Settings tab and the site's account page each get a Patreon section with the same states:

| State | The section shows |
|---|---|
| Not linked | **Link Patreon**, and the **Become a Supporter** link |
| Linked, no tier | "No active membership", **Unlink**, and the **Become a Supporter** link |
| Linked, with a tier | The tier, the tenure, the **Show Supporter Flair** toggle, and **Unlink** |

- In the app, **Link Patreon** opens the system browser (A3). The dialog reads the status again when the window gets focus.
- The dev-router gets an entry for the Settings tab.

### Supporters wall (site)

- A new `/supporters` page on the account site reads the wall route.
- It has two sections, Supporter+ and Supporter. Each name links to the public profile and carries its flair.
- The landing page footer and the app's Patreon section link to it.
- The privacy page gets a paragraph on the Patreon link (A7).

### Shape

- World and save files do not change. No export-shape change.
- The server needs new environment values: the Patreon client ID and secret, the creator tokens, the campaign ID, the two tier IDs, and the webhook secret.

## Testing Decisions

A good test here drives a public surface and reads what a user or a client reads. It does not assert on table rows, on which function ran, or on the Patreon module's internals.

| Seam | What the tests do | Prior art |
|---|---|---|
| Server HTTP API | Call the link, unlink, status, toggle, webhook, and wall routes. Read `supporter` from listing, comment, feedback, and profile payloads. | The hidden-likes and author-badge server tests |
| Patreon client module | The only fake. Tests replace it with one that returns members and tokens. The reconcile job runs against it. | The mail module is the only outbound call today |
| Shared name components | Render the username and Profile Image components with an author object. Assert the badge, the color, and the ring. | Tests of the staff role badge |
| Account surfaces | Render the Settings tab and the site account section against a mocked account service, one test per state in the table above. | The site account page tests |
| Supporters page | Render the page against a mocked wall response. Assert the sections and the order. | The site profile page tests |

Cases the server tests must cover:

- Each tier, no tier, and an unmapped tier.
- The toggle off: `supporter` is null in every payload, and the wall omits the account.
- A staff supporter: null in payloads, present on the wall.
- A second link to the same Patreon user ID is refused. After an unlink it succeeds (Q14).
- A webhook with a bad signature is refused. A good one changes the tier. A repeat changes nothing.
- A webhook for an unlinked Patreon user changes nothing.
- The reconcile job corrects a tier that a missed webhook left wrong, and clears a member who left the list.
- A lapsed supporter's old feedback reply shows no flair (A4).
- Account deletion removes the link, and the Patreon user ID can link again.
- A forged or expired `state` on the callback stores nothing.

Each guard gets proof that it fails when its bug returns.

**Live Patreon check.** No automated test calls Patreon. Before release, one manual checklist runs against the real API with real member accounts:

- [ ] A $5 member and a $10 member link, and each gets the right tier.
- [ ] An upgrade, a downgrade, and a cancel each arrive by webhook.
- [ ] A free member links and gets "No active membership".
- [ ] A free trial and a gifted membership: record the real field values. The documentation gives no example for them.
- [ ] A declined payment: record whether the entitled tiers stay during Patreon's retry period.
- [ ] The webhook signature verifies on a real delivery.
- [ ] The creator token refresh works, and the new pair is stored.

## Out of Scope

- Personal cosmetics: themes, accent colors, alternate entity art, app icons.
- Preset titles and member-picked name colors.
- Hiding flair on contest entries (Q4).
- Flair on contest podiums and other name snapshots (A5).
- Cumulative tenure and any pledge history of our own.
- A relink cooldown (Q14).
- The Steam build (Q17).
- Any feature that needs a membership.
- Other Patreon data: posts, benefits, addresses, pledge amounts.

## Further Notes

- **Design approval.** The two tier colors, the Supporter+ badge style, and the Profile Image ring are new visual patterns. The user approves them in the design-system showcase before adoption.
- **Glossary.** The effort adds terms to the glossary: Supporter, Supporter+, Supporter Flair, Supporters wall, Patreon link. Copy says Profile Image, never avatar.
- **Order of work.** The Settings tab restructure and the shared author serializer are prefactors. The server link and tier rule come next, then the client flair, then the wall.
- **Unverified facts.** The Patreon documentation does not state the field values for trial, gifted, and declined members, or the lifetime of a creator token. The live check settles them. If a trial or a gift does not appear in `currently_entitled_tiers`, Q1 needs a new ruling.
- **Patreon limits.** The member list returns 1000 members for each page. The API allows 100 requests in 2 seconds for each client. The hourly job is far below both.
- **Adjacent bug, not in this effort.** The Likers list passes a role to its badge, and the server sends none, so that badge never shows.
