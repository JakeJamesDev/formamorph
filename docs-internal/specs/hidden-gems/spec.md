# Hidden Gems

Status: ready-for-agent

Three well-liked worlds with few downloads get slots on page 1 of Community Creations, and the picks rotate every 12 hours. Designed on 2026-11-07 against production data and both repos. The work spans both repos. The server half is `docs-internal/specs/hidden-gems/spec.md` in FormamorphServer, and it lands first.

## Problem Statement

Community Creations sorts by recent updates or newest listings by default, and a reader can sort by likes or downloads. A world that most people who download it like, but that few people download, never reaches page 1. It is not new, and its counts are small. Readers miss worlds that the people who did play them liked.

A plain likes-to-downloads ratio does not find these worlds. Likes started on 2026-08-03, but download counts go back to May 2025. An old world got most of its downloads before anyone could like it, so on all-time counts its ratio is about 20 times lower than a new world's. A ratio on all-time counts only finds new worlds.

## Solution

The server picks up to three **hidden gems**: worlds whose likes are high for the downloads they got in the last 60 days, among worlds with few downloads in that window. It picks again every 12 hours. A world that was a gem cannot be a gem again for 7 days.

The app shows the gems on page 1 of the Worlds tab, in slots 3, 6 and 9, with a badge. This works with any sort, so new listings still get the same exposure as today. A reader can turn hidden gems off with a toggle next to the sort control. The toggle is on by default.

Gems show only in the plain browse view. A search, or any author, tag, model or status filter, gives the normal sorted list.

## User Stories

1. As a reader, I want a few well-liked but little-known worlds on page 1, so that I find good worlds the default sort hides.
2. As a reader, I want gems marked with a badge, so that I know why a world sits among the others.
3. As a reader, I want gems spread through page 1, so that the top of my chosen sort still leads the page.
4. As a reader, I want gems to keep my chosen sort around them, so that the sort I picked still means what it says.
5. As a reader, I want new listings to stay as visible as today, so that the newest-first view still shows what just came out.
6. As a reader, I want the gems to change over time, so that a return visit shows me different worlds.
7. As a reader, I want a world I just saw as a gem to leave the gem slots for a while, so that the slots don't repeat.
8. As a reader, I want to turn hidden gems off, so that I see a pure sorted list when I prefer it.
9. As a reader, I want my toggle choice remembered between sessions, so that I don't turn it off on every visit.
10. As a reader, I want hidden gems on by default, so that I see them without having to find a setting.
11. As a reader who searches, I want only matching results, so that gems don't push into a search.
12. As a reader who filters by tag, author, model or status, I want only matching worlds, so that a filter means what it says.
13. As a reader, I want a world I hid, or a world by an author or tag I hid, never shown as a gem, so that my hide choices still apply.
14. As a reader, I want each world to appear only once in the list, so that a gem is not repeated further down.
15. As a reader on a later page, I want a normal sorted page, so that paging works as it does today.
16. As a reader on a small screen with fewer than 9 rows per page, I want the gems that fit to show and the rest to stay in their sorted place, so that the page doesn't overflow.
17. As a reader of the Contest tab, I want the contest order unchanged, so that gems never mix into judging or results.
18. As a reader of the Avatars, Entities or other kind tabs, I want those tabs unchanged, so that gems stay a Worlds feature.
19. As a reader, I want gems picked from worlds I can open, so that a gem slot is never a dead end.
20. As an author of a well-liked world with few downloads, I want a fair chance at a gem slot, so that my world reaches readers.
21. As an author of an older world, I want my world judged on recent downloads, so that downloads from before likes existed don't count against it.
22. As an author of a popular world, I understand my world won't be a gem, because it already leads the likes sort.
23. As a contest entrant, I want my hidden like count to stay hidden, so that a gem slot never reveals my entry's rank.
24. As staff, I want quarantined, unlisted, unapproved and pinned worlds kept out of gem slots, so that gems follow the same rules as the catalog.
25. As staff, I want gems picked by a fixed rule, so that no one can say the picks are hand-chosen.
26. As a reader on an older app build, I want the catalog to keep working, so that the new field doesn't break anything. That build shows no gems.
27. As the operator, I want download history kept from now on, so that later ranking features can use recent activity.
28. As the operator, I want download history rebuilt from the backups we have, so that the 60-day window works on the first day.

## Implementation Decisions

### Server (FormamorphServer; full detail in its half of this spec)

- **Download log.** A new table holds one count per world per UTC day, and cascades on delete. Every download path already goes through one model function, which updates the log in the same transaction as the counter. Day buckets, not one row per download: the score only needs days, and a bucket stores nothing about who downloaded.
- **Backfill.** A one-off script rebuilds daily buckets from the production backups, from 2026-09-06 to the deploy. Each download difference between two backups goes into the bucket for the later backup's day.
- **Score.** Over the last 60 days, `score = (likes + k·p) / (downloads + k)`. `likes` and `downloads` count only events inside the window. `p` is the catalog's window likes over window downloads. `k` is the median window downloads.
- **Eligibility.** A world in circulation (public, approved, not quarantined), not pinned, not Supporter-only, below the 75th percentile of window downloads, with at least 3 window likes. A contest entry whose likes are hidden from a public reader is never eligible.
- **Rotation.** A pick set holds up to 3 worlds. The hourly runner makes a new set when the newest one is 12 hours old. It takes the top scores among eligible worlds not picked in the last 7 days. Fewer than 3 eligible worlds gives a smaller set.
- **Catalog field.** `GET /api/worlds` marks each row in the current pick set with `hidden_gem: true`. A pick that has left circulation is not marked. The body changes when the set rotates, so the catalog's `ETag` changes too, and the app's conditional fetch gets the new picks.
- The server does not order the catalog for gems. The app fetches the whole catalog and sorts and pages it on the device.

### App (this repo)

- **Catalog row.** The world record gains an optional `hidden_gem` flag, read from the catalog row. A missing flag means not a gem.
- **Browse pipeline.** `useCommunityBrowserFilters` places gems after it sorts and before it pages. The placement applies only when all of these are true:
  - the tab is Worlds;
  - the tab has no `order` override (the Contest tab has one);
  - the toggle is on;
  - the search box is empty;
  - no author, tag, model or status filter is set.
- **Placement.** The pipeline takes the gem rows out of the sorted list, then puts them back at positions 3, 6 and 9 of page 1, in the order the sort gave them. The app doesn't know the score. The rows they move aside shift down, so `totalPages` stays the same. A gem slot past the page size stays empty, and that gem goes back to its sorted position. Hide preferences run before placement, so a hidden world never takes a gem slot.
- **Pinned rows** keep leading page 1 as today. Gem slots count from the first row after the pinned group.
- **Toggle.** A per-tab browse setting, `showHiddenGems`, defaults to true and is saved with the other tab filters. The control shows only on the Worlds tab, next to the sort control.
- **Badge.** `RemoteWorldCard` shows a badge on a row only when that row sits in a gem slot. A row flagged as a gem but shown in its sorted position (toggle off, a filter set, or a slot past the page size) has no badge.
- **Copy.** The toggle label, the badge and its tooltip follow the Writing Guide.
- **Changelog.** One 👤 Added entry under Minor.

## Testing Decisions

- A good test drives a public seam and checks what a reader or client sees. It doesn't read internal tables or call private helpers.
- **App seam:** the `useCommunityBrowserFilters` hook, given a catalog with flagged rows. Prior art: `useCommunityBrowserFilters.likes.test.ts` and `useCommunityBrowserFilters.pinned.test.ts`. Cases:
  - gems sit at positions 3, 6 and 9 of page 1 under each sort field;
  - no world appears twice across pages, and `totalPages` is unchanged;
  - a search, or each filter type, gives the plain sorted list with no gem slots;
  - the toggle off gives the plain sorted list, and the setting survives a reload of saved preferences;
  - a hidden world, author or tag removes that gem;
  - the Contest tab `order` and the other kind tabs ignore the flag;
  - with a page size below 9, a gem slot that doesn't fit leaves its gem in sorted position;
  - pinned rows still lead, and gem slots count after them.
- **Badge:** a component test that a card in a gem slot shows the badge and a flagged card outside one does not. Prior art: the existing `RemoteWorldCard` tests.
- **Server seam:** see the server half. It tests through `GET /api/worlds` and through calling the rotation job with a set clock.

## Out of Scope

- A staff switch that turns hidden gems off for everyone.
- Gems on the website's listing pages, or on any tab but Worlds.
- Gems in search or filtered results.
- Showing the score, or why a world was picked.
- Changing the default sort.
- Using the download log for anything else, such as a trending sort or download charts.

## Further Notes

- Measured on production on 2026-11-07, with downloads counted from the 2026-09-06 backup: 106 worlds were eligible. One pick set every 12 hours with a 7-day cooldown uses 42 worlds per cycle, so the pool lasts.
- With the 60-day window, likes per 1k downloads were flat at about 16–37 across listing months. On all-time downloads they ranged from 1.1 to 21.3.
- Supporter-only worlds are excluded because most readers can't download them. Revisit if that rule hides good Supporter worlds.
- Older builds ignore `hidden_gem` and show no gems.
