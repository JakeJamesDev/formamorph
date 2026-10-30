# Flagged Likes

Status: ready-for-agent
Spec session: flagged-likes — spec

Staff can see when a listing's like count is being inflated. Each like records the kind of network it came from (VPN, hosting, Tor), the likes audit shows those kinds and any burst of likes, and a staff-only marker points at listings worth a look. Designed in a grilling session on 2026-10-30; rulings Q1–Q23 below. The work spans both repos; the server part lands first.

**Ordering constraint.** The public privacy text must state the new collection before the server stores one Network Kind. The server ships with collection switched off, the text goes live, and only then does the operator switch it on. Same order as Anonymous Likes and abuse signals.

## Problem Statement

A guest can give a listing up to three Anonymous Likes from one address by clearing local storage, which is the designed cap. With a VPN, every server switch is a new address, so the cap resets and one person can give a listing as many likes as they want. Players have found and reported this.

The likes audit cannot show it. It groups likes by shared address, and a VPN user shows up as many separate guests from many separate addresses. Staff also have to suspect a listing before they open its audit, so an inflated listing nobody looks at goes unseen.

## Solution

When a like is given, the server checks the address against local lists of VPN, hosting and Tor networks and stores the **Network Kind** beside the like. No address leaves the server, and the raw address is never stored.

Staff see the kind on each group in **Audit the likes**, the share of flagged likes on the listing, and any **Burst**: many different likers on one listing within minutes. When a listing crosses either threshold, a staff-only **Likes Marker** shows on its card and in its details. Pressing it opens the audit.

One **Moderation** button with a popover replaces the two staff toggles in the community browser. It holds **Quarantined**, **Show Pending** and a new **Flagged Likes** filter that lists every marked listing.

Nothing acts on its own. Counts, sorts and acceptance do not change. Staff decide, and remove groups with the tools they already have.

## User Stories

### Staff reading the audit

1. As a staff member, I want each group in the likes audit to say whether it came from a VPN, a hosting network or Tor, so that I can tell a VPN user from a real household.
2. As a staff member, I want VPN, hosting and Tor shown as separate kinds, so that a cloud server, which is a stronger script tell, stands out from a consumer VPN.
3. As a staff member, I want the audit to show how many of the listing's recent likes are flagged and what share that is, so that I can judge inflation at a glance.
4. As a staff member, I want the audit to list each Burst with its time and size, so that I can see a VPN user who switched servers even when the lists missed the network.
5. As a staff member, I want account likes flagged as well as Anonymous Likes, so that a ring of fresh accounts made over a VPN shows too.
6. As a staff member, I want likes with no flag to look as they do today, so that the audit does not get louder for ordinary listings.
7. As a staff member, I want likes older than 90 days to show no kind, so that the audit matches what the privacy text promises.
8. As a staff member, I want the flags to change nothing on their own, so that a false positive never costs an author a like.

### Staff finding inflated listings

9. As a staff member, I want a marker on the card of a listing that has a Burst or a high flagged share, so that I notice it while I browse.
10. As a staff member, I want the same marker in the listing details, so that it is there wherever I open the listing.
11. As a staff member, I want pressing the marker to open the likes audit, so that the evidence is one press away.
12. As a staff member, I want the marker to say which reason fired (Burst, flagged share, or both), so that I know what to look for in the audit.
13. As a staff member, I want the marker on contest entries too, so that the listings where inflation pays most are covered.
14. As a staff member on the contest tab, I want the marker to show while like counts are hidden from players, so that I can act before results are announced.
15. As a staff member, I want a marker to clear on its own when the likes that caused it age out or are removed, so that the marker reflects the listing as it is now.
16. As a staff member, I want a **Flagged Likes** filter that lists every marked listing, so that I can sweep them in one place.

### The Moderation button

17. As a staff member, I want one **Moderation** button instead of separate toggles, so that the toolbar stays short as staff tools grow.
18. As a staff member, I want the button to open a popover shaped like the **Filters** button, so that it works the way I already know.
19. As a staff member, I want each option in the popover to show its count, so that I know whether there is work before I turn it on.
20. As a staff member, I want an option with a count of zero to be disabled, not hidden, so that the controls stay in the same place.
21. As a staff member, I want an option that does not apply to the current tab to be hidden, so that the popover never offers a filter that does nothing there.
22. As a staff member, I want the button to show how many options are on, so that I know the list is narrowed.
23. As a staff member, I want **Quarantined** and **Flagged Likes** to narrow together when both are on, so that the options combine the way the regular filters do.
24. As a staff member, I want **Show Pending** to keep working as it does today, so that the review flow does not change.
25. As a staff member on a narrow screen, I want the Moderation button to sit where the staff toggles sat, so that the mobile toolbar does not grow.
26. As a player, I want to never see the Moderation button, the marker or the filter, so that staff tools stay private.

### Operator

27. As the operator, I want collection to ship switched off behind a server setting, so that I switch it on only after the privacy text is live.
28. As the operator, I want to switch collection off again without a deploy, so that I can stop it if the lists misbehave.
29. As the operator, I want the marker and Burst thresholds as server settings, so that I can tune them on real data without a deploy.
30. As the operator, I want the server to download fresh lists once a day, so that new VPN servers get flagged without my help.
31. As the operator, I want a failed download to keep the last good lists, so that a network hiccup never blanks the flags.
32. As the operator, I want a server that has never downloaded the lists to store no kind rather than fail the like, so that likes keep working on a fresh install.
33. As the operator, I want no address sent to a third-party service, so that the privacy text stays simple and true.

### Players and privacy

34. As a player, I want liking to work exactly as before, so that the flag costs me nothing.
35. As a player on a VPN, I want my like accepted and counted, so that I am not punished for my network.
36. As a player, I want the privacy page to say that the kind of network is stored, for how long, and where the lists come from, so that I know what is kept.
37. As a player, I want the privacy page to say how long the browser family beside an Anonymous Like is kept, so that no field is kept without a stated limit.
38. As a reader of the privacy page, I want the IPLocate.io credit beside the data it describes, so that the license terms are met where the data is explained.

## Implementation Decisions

### Rulings (Q-numbered, from the grill)

- **Q1** Both Anonymous Likes and account likes get a Network Kind. Other Signal events do not.
- **Q2** Three separate kinds: `vpn`, `hosting`, `tor`. No kind means none matched, or the lists were not loaded.
- **Q3** Staff information only. No effect on counts, sorts, profile totals or acceptance.
- **Q4** The lookup is local. No address goes to a third-party API.
- **Q5, Q15** A staff-only Likes Marker on the community browser card and in the listing details. Pressing it opens the likes audit.
- **Q6, Q12** A Burst is 8 or more different likers on one listing within 15 minutes, account and anonymous likes together.
- **Q7** Sources: X4BNet `lists_vpn` (the VPN list and the data-center list, IPv4 and IPv6) and the Tor Project bulk exit list. Paid databases are out.
- **Q8** The audit shows the kind only, never the network owner's name.
- **Q9** The kind is blanked at 90 days, together with the address hash.
- **Q10** Collection ships behind a server setting, off by default, switched on after the privacy text is live.
- **Q11** The marker shows when a listing has a Burst in the last 90 days, or when at least 5 of its likes from the last 90 days are flagged and those are half or more of its likes from that window. Either reason alone is enough.
- **Q13** The marker and Burst thresholds are server settings.
- **Q14** The server downloads the lists daily and keeps the last good copy when a download fails.
- **Q16, Q19** A staff-only **Flagged Likes** filter, inside one **Moderation** popover button that replaces the **Quarantined** and **Show Pending** toggles.
- **Q17, Q18** The browser family beside an Anonymous Like is blanked at 90 days with the hash. The privacy text states both.
- **Q20** The IPLocate.io credit goes on the privacy page, in both copies.
- **Q21** Popover options work independently. "Only" filters (Quarantined, Flagged Likes) narrow together (AND).
- **Q22** The Moderation button always shows for staff where moderation applies. Each option shows its count and is disabled at zero.
- **Q23** The marker and the filter work on the contest tab, for staff only.
- Assumption carried from the grill summary: an option that does not apply to the current tab is hidden (today Quarantined and Show Pending do not apply on the contest tab).

### Server

- **Network Classifier module.** One deep module with a small interface: classify an address and get a kind or none; load lists from text; report when the lists were last loaded. It matches IPv4 and IPv6 CIDRs with Node's built-in `net.BlockList`, so it adds no dependency. Precedence is Tor, then VPN, then hosting, because the data-center list also contains the VPN ranges. The address it classifies is the same `req.ip` the address hash already uses (Caddy on loopback, `trust proxy` set to loopback). It never reads a forwarded header of its own.
- **List refresh.** A daily job downloads the three lists, validates each (non-empty, parses as CIDRs or addresses), writes them to the server's data folder, and swaps them into the classifier. A failed or invalid download keeps the last good copy on disk and in memory. On startup the classifier loads the copy on disk and starts a download when none exists. Until a list is loaded, classification returns none.
- **Storage.** A nullable `network_kind` column on `anonymous_likes` and on `world_likes`, written when the like is stored and only while the collection setting is on. A claimed Anonymous Like keeps its kind when it moves. The account like side stores no address. Its kind is what links it to the network.
- **Retention.** The existing 90-day sweep blanks `address_hash`, `browser_family` and `network_kind` on Anonymous Likes, and `network_kind` on account likes older than 90 days. The like itself stays.
- **Burst counting.** Different likers means each account counts once and Anonymous Likes count once per address hash. A household behind one address counts once. Anonymous Likes whose hash was blanked are past the 90-day window and do not count.
- **Settings.** New entries in the existing settings map: the collection switch (boolean, default off), the minimum flagged count (5), the flagged share (0.5), the Burst size (8) and the Burst window in minutes (15). The existing Server Settings tab lists them. Thresholds apply on the next read.
- **Audit route.** The likes audit adds `networkKind` to each account row and each anonymous row, and returns a per-listing summary: flagged count, likes in the window, flagged share, the Bursts found (start time, size), and which marker reasons fire. It still never returns the hash or the Install id.
- **Catalog.** For staff readers only, each listing carries the marker reasons. The catalog accepts a staff-only flagged-likes filter and returns only marked listings. A non-staff request that sends the filter gets the filter ignored. Responses that carry marker fields use the per-reader caching the catalog already uses for staff fields.
- **Contest entries.** Staff already see private like counts on contest entries. The marker and filter follow the same reader rule.
- **Marker computation.** Computed on read from the last 90 days of likes, so a marker clears on its own when likes age out or are removed. The volume is small; an index on listing and like time covers it.
- **Privacy text.** The server privacy policy and the client privacy page each gain: the kind of network is stored beside a like, it is blanked after 90 days, it comes from local lists, and the IPLocate.io credit. The anonymous-likes retention list also states that the browser family is blanked at 90 days.

### Client

- **Moderation button.** A popover trigger in the community browser toolbar for staff where moderation applies, shaped like the **Filters** button, with a badge for the number of options on. It holds **Quarantined (n)**, **Show Pending** and **Flagged Likes (n)** as independent options. An option with a zero count is disabled. An option that does not apply to the tab is hidden. It reuses the existing popover and filter patterns, so it needs no new visual pattern.
- **Flagged Likes filter.** Sends the staff-only filter to the catalog. It narrows together with Quarantined.
- **Likes Marker.** A staff-only marker on `RemoteWorldCard` and in `RemoteWorldDetailsModal`, naming which reason fired. Pressing it opens the likes audit in `LikersDialog`.
- **Likes audit.** `LikersDialog` shows the kind on each row or group, a summary line with the flagged count and share, and the list of Bursts.
- **Dev router.** The Moderation popover and the marker get dev-route entries so they can be checked in the preview.
- **No export-shape change.** Nothing here touches world or save files.

## Testing Decisions

- Good tests here drive the public surface: an HTTP request against the server, or a rendered component with mocked fetch. They assert what staff or players would see, never internal calls.
- **Server, supertest on the in-memory DB** (prior art: `likesAudit.test.js`, `anonymousLikes.test.js`, `signals.test.js`, `likes.test.js`, `hiddenLikes.test.js`). Cover: a like from a fixture VPN, hosting or Tor address stores the right kind; precedence when a range is on two lists; no kind with the setting off; no kind before lists load; a claimed like keeps its kind; the sweep blanks kind, hash and browser family at 90 days and keeps the like; the audit returns kinds, summary and Bursts; a household on one address counts once toward a Burst; marker reasons appear for staff only; the filter returns only marked listings and is ignored for non-staff; contest entries get the marker for staff while counts stay hidden from players; settings changes apply on the next read.
- **Network Classifier**, the one new seam. Feed it fixture lists built from documentation ranges (`192.0.2.0/24`, `198.51.100.0/24`, `2001:db8::/32`). Stub the download to prove a failed or invalid fetch keeps the last good copy and a fresh install classifies as none.
- **Client, RTL with mocked fetch** (prior art: `CommunityCreationsBrowser.*.test.tsx`, `LikersDialog.test.tsx`, `RemoteWorldCard.quarantine.test.tsx`, `RemoteWorldCard.review.test.tsx`). Cover: the Moderation button replaces the two toggles; counts, disabled-at-zero and hidden-on-tab; AND narrowing; the filter reaches the request; the marker shows for staff only and opens the audit; the audit renders kinds, the summary and Bursts; players never see any of it.
- Each guard gets proven by reinstating the bug once (the `test-bar` skill).

## Out of Scope

- Any automatic action: refusing, discounting or hiding flagged likes.
- Network owner names (ASN data, IPinfo Lite).
- Paid VPN or residential-proxy databases.
- Flags on Signal events other than likes (signup, login, publish, comment, follow).
- Backfilling likes stored before collection starts. No raw address exists to classify.
- Phone or other identity verification for likes.
- A changelog entry. Staff tools never get one.

## Further Notes

- Glossary terms for `CONTEXT.md`: **Network Kind**, **Flagged Like**, **Burst**, **Likes Marker**.
- The lists catch commercial VPNs, cloud servers and Tor. They miss residential proxies, and mobile carriers look normal. The Burst is there for what the lists miss.
- The Tor list has no IPv6 entries.
- X4BNet's lists are MIT, built from IPLocate.io data under CC BY-SA 4.0, so the credit carries over. Facts checked on 2026-10-30.
- Rollout: server with the setting off → privacy texts live → client release → the operator switches collection on.
- Write-ups describe the pattern only. Never name the reporter or any listing in a ticket, test, fixture or commit.
