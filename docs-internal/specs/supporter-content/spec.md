# Spec: Supporter Content and Mascot Listings

Status: done
Status note: Closed 2026-10-28; tickets 01–18; last landing b6ff088b1. Review: four gaps fixed in tickets 15–18, spec text corrected. Gates green on 2026-10-28.
Spec session: supporter-content — spec

Make Mascots a Community Creations listing kind, add a staff Pin, and add Supporter-only listings whose downloads are watermarked and scrambled per account. The first Supporter-only listing is an exclusive Mascot. Spans both repos: the Formamorph client and FormamorphServer.

## Problem Statement

The user wants to give Patreon Supporters content that other players can't get, starting with an exclusive Mascot. Today every Mascot image is public. Morphie's layers are bundled into the app and sit in the public repo. Any Mascot can be duplicated and exported as a mascot card that carries every layer. A file placed in the repo or the bundle would leak on day one. A file downloaded in the app could be passed on with one click.

Separately, players can't share Mascots at all. Community Creations holds worlds, entities, dictionaries, Avatars and prompts, but not Mascots. Community Creations also has no way to keep a listing at the top, so a new exclusive is easy to miss.

Leaks can't be prevented outright: anything the app draws can be screenshotted. The goal is to make the clean, layered rig hard to get, and to make any leak traceable to an account.

## Solution

**Mascot** becomes a listing kind in Community Creations (Q13). Players publish their own Mascots from the Mascot tab and download other players' Mascots as normal custom Mascots (Q14, Q18).

Staff can mark a listing **Supporter-only** (Q13). Everyone can see the listing, like it and comment on it (Q19). Only signed-in Supporter and Supporter+ accounts can download it (Q2). The server watermarks each account's copy invisibly (Q4, Q7) and sends the layers scrambled (Q4). The app rebuilds the layers only when it draws them. The installed exclusive Mascot is read-only: no edit, no Duplicate, no Export (Q4).

Staff can **Pin** any listing, and a pinned listing shows first (Q16). The exclusive Mascot is pinned. The Mascot tab also shows it: as a locked entry that opens the listing for non-supporters, and as a one-click install for Supporters (Q15, Q21).

The app checks the account's tier at each start. When the pledge ends, the exclusive Mascot is removed and the Mascot falls back to Morphie (Q3). When the server can't be reached, the cached copy works for up to 7 days after the last good check (Q6). When staff publish a new revision, installed copies update at the next check (Q22).

When a leaked image turns up, staff run a server script that reads the watermark and names the account (Q9). Staff can then revoke that account's access to Supporter content, without touching its account or flair (Q10).

## Rulings

Settled in the grill on 2026-10-27. A ruling reopens on new evidence, never on a new opinion.

| # | Ruling |
|---|---|
| Q1 | Build a general Supporter content channel. The exclusive Mascot is its first user. |
| Q2 | Supporter ($5) and Supporter+ ($10) both qualify. |
| Q3 | When a pledge ends, the content is removed and the Mascot falls back to Morphie. |
| Q4 | Safeguards: private storage behind a tier-checked download, read-only lock, per-account watermark, scrambled layers. The IndexedDB cache is not encrypted. |
| Q5 | Files stay on the server's disk behind a storage interface that could later point at R2. Supporter content is distributed through Community Creations listings (see Q13). |
| Q6 | The tier is checked at each app start while signed in. If the check fails, the cache stays usable for 7 days from the last good check. |
| Q7 | The watermark is robust and invisible: it survives re-encoding, scaling, cropping and screenshots. |
| Q8 | Non-supporters see the exclusive in the Mascot tab as a locked entry with a preview. |
| Q9 | Staff read a watermark with a server CLI script. |
| Q10 | Staff can revoke one account's access to Supporter content. Its account and Supporter Flair stay. |
| Q11 | The preview is the listing thumbnail (settled by Q13). |
| Q12 | DevTools stay on in packaged desktop builds. |
| Q13 | Mascot is a listing kind. Only staff can mark a listing Supporter-only. |
| Q14 | User-uploaded Mascot listings are part of this effort. |
| Q15 | The Mascot tab's locked entry opens the Community Creations listing. |
| Q16 | Staff can Pin any listing of any kind. A pinned listing shows first in its kind's section and in All. |
| Q17 | Mascot listings follow the global Listing Review setting. |
| Q18 | A Mascot downloaded from a listing that is not Supporter-only becomes a normal custom Mascot. |
| Q19 | On a Supporter-only listing, everyone can see the listing, like it and comment on it. A Patreon button, or Sign In when signed out, replaces Download. |
| Q20 | The Steam build is out of scope. A Steam path is planned separately. |
| Q21 | For a Supporter, picking the exclusive in the Mascot tab downloads and installs it in one step. |
| Q22 | Installed Supporter content updates on its own at the next check after staff publish a new revision. |
| Q23 | A Mascot upload is capped at 10 MB. Morphie's 26 layers total 1.1 MB. |
| Q24 | A Mascot listing's thumbnail defaults to the card's Initial render. The author can replace it. |
| Q25 | The 10 MB cap counts the decoded bytes of every data-URL image in the card, not the serialized JSON. The refusal states the measured size and the limit. Server and client measure the same way. |
| Q26 | A Mascot listing can't enter a contest. |
| Q27 | The watermark carries a random 32-bit mark number, one per account and stable across listings and revisions. A server table maps it to the account. The full account id would cost robustness on small layers. |
| Q28 | Every layer must round-trip its mark. The attack list (re-encode, downscale, crop, composite) must pass on the full composite and on every layer at or above a measured opaque-area floor. Smaller layers need only the round-trip. A leaked rig is traced through its base layer. |
| Q29 | Publish refuses a Mascot that holds any bundled (Morphie) layer and names the layers to replace, like Avatar publish refuses the default Avatar. Export is unchanged. |
| Q30 | After a publish, the author's own Mascot links to the new listing, as prompts and worlds do. |
| Q31 | The public content routes refuse a Supporter-only listing for everyone. The gated route also serves the listing's author and staff whatever their tier, through the same per-account processing. The entitlement route stays tier-based. |
| Q32 | Ticket 04 lands with a known gap: a copy shifted off the 4 px grid and then saved lossy mostly loses the mark. Ticket 14 hardens it behind the same `embed`/`read` interface. User ruling on new evidence, narrowing Q7 until ticket 14 lands. |
| Q33 | The client has no All tab, so "in All" (Q16) applies to the server's all-kinds read only. In the app, pinned listings sort first inside each kind's tab, ahead of Updates First and the chosen sort. The Contest tab keeps its own order. |
| Q34 | Scramble format version 1: pad each layer with transparent pixels to a multiple of 8 per axis, cut a fixed 8×8 grid, and permute the tiles with a single-cycle (Sattolo) shuffle seeded by a 32-bit seed through mulberry32, so no tile stays in place. The route returns seed, version and original size beside the file; the client crops after unscrambling. Scrambled layers travel losslessly. |
| Q35 | The hardened watermark (ticket 14) need not read ticket 04's marks, since none were served. Budget: embedding a Morphie-sized rig under about 3 s cold, `read-leak` under about 1 min. Two lossy saves in a row are measured, not required. |
| Q36 | The gated route processes every `data:image/…;base64` string in the content. Each becomes `{ dataUrl, seed, version, sourceWidth, sourceHeight }` in the same JSON position, encoded as lossless PNG. One seed per account, listing and revision, from an HMAC with a fixed purpose label. Results are cached per account, listing and revision; the staff review route processes without caching. |
| Q37 | The hardened watermark keeps the 40 dB invisibility bar. A copy shifted 1–3 px, halved and saved WebP q50 then reads about 5 times in 6; a stronger mark at about 38 dB was declined. User ruling on new evidence. |
| Q38 | Ticket 04's mark misses the plain round-trip for about 1 random mark and layer pair in 312. Ticket 10 proves the route by exact equality with `embed(source, mark)`, without its own read-back. Ticket 14 must show zero misses across at least 10,000 random marks. User ruling on new evidence. |
| Q39 | Cached Supporter content carries its account id. While another account is signed in it is never returned or drawn, and that account's first good check deletes it. Offline, `qualifies` reports the last good check inside the 7-day window and false after. A higher revision of an installed item re-fetches at once; on failure the old copy stays. Install refuses an item the last good check didn't list. The module exposes a `useSyncExternalStore` store with `check`, `install` and `readItem`, plus pure `unscramble` and `unscrambleToCanvas`. |
| Q40 | On a Supporter-only listing the app offers Install only for kinds that have a consumer, Mascot today. Another kind shows a disabled button for a qualifying account. A signed-in account shows Checking until the first check ends, then Install or Installed if entitled, else Patreon. Author and staff get no special case in the app. |
| Q41 | The installed exclusive's rig (layer names, picks, Voice, transition, Mask) is stored in help settings as a read-only entry tagged with its account id, with `{ kind: 'supporter', id, revision, index }` image refs; pixels stay in the module's cache and draw only as canvases. A sync step writes the entry on install or update and removes it when the module no longer lists it. Any export or import of help settings skips it. Revised on evidence: the face call, Voice chip and speaker read the rig synchronously. The Mascot tab finds Supporter-only Mascots from the Mascot catalog, for every account state. A pick from the help window opens the listing through a request the main menu consumes. Fallback to Morphie happens only once the module's check is ready. No Rename, Delete or Reset either. |
| Q43 | Close-review fixes: the update reply omits `contentData` on any Supporter-only listing, held updates included. The client's entitlement check times out after 15 s and an install or update fetch after 60 s; a timeout counts as a failed request. The per-account cache key includes a hash of the watermark and scramble source, and a listing's cache clears when it is deleted, swept, erased with its author, or no longer Supporter-only; an erased account's cache clears too. |
| Q44 | Narrows Q13: only an admin sets or clears Supporter-only, on the route, the card and the details window, and the publish script. Clearing it asks first, because it makes the clean files public. Pre-launch review, user ruling. |
| Q45 | Pre-launch review fixes, user picks. Exclusive publishes go through `npm run publish-supporter`, which creates the listing Supporter-only and pinned in one transaction. The watermark and scramble run in worker threads. `kind=all` covers only the kinds 3.5.0 knows; the client names its kinds as a list. The client re-checks entitlement when the app regains focus, on a Patreon press, on a locked pick and on an install whose list is stale, and retries a failed check every minute. |
| Q46 | Supersedes Q45's publish path. An admin publishes an exclusive from the app, as its author, so later revisions go through the normal update from the linked Mascot (Q30, Q22). The create route takes `supporterOnly: true` from an admin only: the content goes straight to the private area, and the row is created Supporter-only and pinned in one transaction, so it is never public. The shared Publish dialog shows a Supporter-Only switch to an admin, for a new Mascot listing only. It starts off and needs no confirm; when on, the button reads Publish Supporter-Only. An update keeps the listing's flag. `npm run publish-supporter` stays as a fallback. User rulings, 2026-10-28. |
| Q47 | The Publish dialog preselects the listing the local copy is linked to, for every kind with a link, when that listing is the user's own. So a revision of Willow defaults to updating it, and a second public listing takes a deliberate Publish as new. User ruling, 2026-10-28. |
| Q42 | Supersedes Q37's 40 dB bar. The luma mark showed a checker on flat fills, so the hardened mark's coarse band moved to 16 px blue-yellow chroma cells: RGB PSNR 36.6–38.6 dB, luma at least 46 dB. Accepted losses: a 50% downscale then WebP q50, and a copy shifted, halved and saved WebP, no longer read. Two WebP q50 saves read 4 of 12. User rulings given to ticket 14 on new evidence. |

## User Stories

1. As a Supporter, I want an exclusive Mascot, so that my pledge gets me something other players don't have.
2. As a Supporter+, I want the same exclusive Mascot, so that the higher tier never loses a perk.
3. As a Supporter, I want to install the exclusive with one click in the Mascot tab, so that I don't have to search Community Creations.
4. As a Supporter, I want to install the exclusive from its Community Creations listing too, so that either place works.
5. As a Supporter, I want the exclusive to keep working when I'm offline for a few days, so that a lost connection doesn't take my Mascot away.
6. As a Supporter, I want the exclusive to update on its own when staff improve it, so that I always have the current art.
7. As a Supporter, I want the exclusive to show and act exactly like any other Mascot (looks, face calls, Voice, transitions), so that it is a real Mascot and not a lesser copy.
8. As a lapsed Supporter, I want the app to fall back to Morphie cleanly, so that the Mascot window never breaks or shows missing art.
9. As a lapsed Supporter who pledges again, I want the exclusive back at the next check, so that rejoining just works.
10. As a non-supporter, I want to see the exclusive in the Mascot tab with a preview, so that I know it exists.
11. As a non-supporter, I want the locked entry to open its listing, so that I can read about it and find the Patreon link.
12. As a non-supporter, I want to see, like and comment on the exclusive listing, so that I can take part in the community around it.
13. As a non-supporter, I want a Patreon button where Download would be, so that I know how to get it.
14. As a signed-out player, I want Sign In where Download would be, so that a Supporter who isn't signed in knows what to do.
15. As a player, I want pinned listings at the top of their section and of All, so that I see staff announcements and exclusives first.
16. As a Mascot creator, I want to publish a Mascot from the Mascot tab, so that other players can use my character.
17. As a Mascot creator, I want the publish flow to match the one for other kinds, so that I don't learn a second process.
18. As a Mascot creator, I want the thumbnail filled from my Mascot's Initial look, so that publishing needs no extra art.
19. As a Mascot creator, I want to replace that thumbnail, so that I control how my listing looks.
20. As a Mascot creator, I want to be told when my Mascot is over the size cap, so that I know to compress the layers.
21. As a Mascot creator, I want to update, delete and write Listing Changelog entries for my Mascot listing, so that it works like my other listings.
22. As a Mascot creator, I want my Mascot listing to go through Listing Review only when review is on, so that Mascots aren't treated differently from other kinds.
23. As a player, I want a Mascots section in Community Creations, so that I can browse Mascots like any other kind.
24. As a player, I want search, tags, sort and paging to work for Mascots, so that nothing about browsing them is special.
25. As a player, I want a downloaded Mascot to appear in my Mascot list and be selectable, so that I can use it at once.
26. As a player, I want a downloaded plain Mascot to be fully editable, duplicable and exportable, so that it works like an imported card.
27. As a player, I want a downloaded Mascot to show Downloaded on its card, and Update Available after the creator publishes a new version, so that I can tell what I have.
28. As a staff member, I want to Pin and Unpin any listing, so that I control what shows first.
29. As a staff member, I want to mark a listing Supporter-only, so that I can publish exclusives.
30. As a staff member, I want to publish a new revision of an exclusive, so that I can improve it after release.
31. As a staff member, I want to read the account out of a leaked image with one command, so that I can act on a leak.
32. As a staff member, I want to revoke one account's Supporter content access, so that a leaker loses the perk without losing the account.
33. As a staff member, I want to restore that access, so that I can undo a mistake.
34. As the owner, I want the exclusive art kept out of the public repo and out of every build, so that nobody can take it from GitHub or by unpacking the app.
35. As the owner, I want each account's copy marked, so that a leak names the account behind it.
36. As the owner, I want the layers scrambled in transit and in the cache, so that DevTools and the browser profile don't hold clean images.
37. As the owner, I want no Duplicate or Export on the exclusive, so that there is no one-click leak path.
38. As the owner, I want later exclusives (worlds, Avatars, prompts) to reuse this channel, so that the next one is a staff toggle, not a new effort.

## Implementation Decisions

### Server

- **Mascot kind.** Add `mascot` to the listing kinds. Its content is the mascot card data (rig, picks, Mask, Voice, transition and every layer). Its rules require a thumbnail; the client fills it from the card render (Q24). The upload cap is 10 MB on the decoded content (Q23), checked on the server.
- **Pin.** Add a `pinned_at` column on listings, set and cleared through a staff-only route. The catalog orders pinned listings first, newest pin first, then the sort the player chose. A Pin applies in its kind's section and in All (Q16).
- **Supporter-only.** Add a staff-only `supporter_only` flag on listings. The public content route refuses a Supporter-only listing. A new gated content route serves it only to a signed-in account whose live `patreon_links` tier is `supporter` or `supporter_plus` and whose Supporter content access is not revoked. The catalog and detail payloads carry the flag, so the client can show the locked button. Listing details, thumbnail, likes and comments stay public (Q19).
- **Revocation.** Add a per-account `supporter_content_revoked_at` column, set and cleared through a staff-only route (Q10). Revocation does not touch Supporter Flair or the Supporters wall.
- **Entitlement route.** One signed-in route returns the account's Supporter content state: whether it qualifies, and every Supporter-only listing it may install, each with its id, kind and current revision. The client's start check calls it (Q6, Q22).
- **Per-account processing.** The gated route passes each image layer through a watermark step that embeds the account's mark number (Q27), then a scramble step. The result is cached on disk per account and listing revision, and dropped when the revision changes. The steps sit behind one module interface, so later kinds can opt in. Non-image content (a future world's JSON) passes through unmarked, until a later effort decides otherwise.
- **Watermark module.** A pure module: `embed(image, payload) → image` and `read(image) → payload | null`. The mark is in the frequency domain with error correction and survives WebP re-encoding, scaling, moderate cropping and a screenshot of the composed Mascot (Q7), narrowed by Q32, Q37 and Q42. It needs a server image library (none exists today); choose one by checking its current release and Node support live.
- **Leak CLI.** A server script takes an image file and prints the account id and username it reads, or that no mark was found (Q9).
- **Scramble format.** Each layer is cut into a fixed grid of tiles and shuffled by a permutation derived from a per-account, per-revision seed that the gated route returns with the file. The format is versioned. The server owns scrambling and the client owns unscrambling; both test against one set of shared vectors.
- **Storage interface.** All file reads and writes for listing content go through one storage interface. Today it is backed by the local disk (Q5). Supporter-only content lives in its own private folder that no static route serves.

### Client

- **Supporter content module.** A deep module with injected fetch and clock. It runs the start check, stores the last good check time, installs and updates entitled items, and removes items that are no longer entitled. Rules: remove on a good check that excludes an item (Q3); keep for 7 days after the last good check when checks fail (Q6); replace on a new revision (Q22); do nothing when signed out, beyond the 7-day window for a cache already present.
- **Cache.** Installed Supporter content stays scrambled in IndexedDB, keyed by listing id and revision. Unscrambling happens in memory, onto a canvas, only when the Mascot draws (Q4). The unscrambled layers are never written back to storage or turned into a downloadable Blob.
- **Mascot presets.** A new built-in, read-only Mascot entry type sits beside the Default. It is shown when the Supporter content module has the item installed, or as a locked entry when the account doesn't qualify (Q8, Q15). Its image references use a new `supporter` reference kind that resolves through the Supporter content module. Duplicate, Export and edit are refused for it (Q4). If it is active when removed, the active id falls back to the Default.
- **Mascot tab.** For a Supporter, picking the locked entry installs it, then selects it (Q21). For anyone else, it opens the listing in Community Creations (Q15).
- **Community Creations.** Add the Mascots section, with Mascot listings downloading into the Mascot preset store as normal custom Mascots (Q18). Downloaded and Update Available follow the existing source-tracking pattern. Pinned listings sort first (Q16). On a Supporter-only listing, Download is replaced by Install for a Supporter, a Patreon button for a signed-in non-supporter, and Sign In when signed out (Q19). Staff see Pin and Supporter-only toggles.
- **Publish.** The Mascot tab gains Publish for custom Mascots, reusing the shared publish flow. The thumbnail defaults to the card's Initial render (Q24). An over-cap Mascot is refused before upload with the measured size (Q23).
- **Builds.** The exclusive art never enters the repo or the bundle. The Pages build has `COMMUNITY_ENABLED` off, so it shows no exclusive and no locked entry. The Steam build is out of scope (Q20).

### Export shape

- The mascot card format is unchanged.
- Help settings gain a read-only Supporter Mascot entry with `supporter` image references, and may store its id as the active Mascot (Q41). That is stored settings, not a world or save export. Mascot listing content is the existing card data.

## Testing Decisions

A good test drives a public seam and asserts what a player, staff member or route caller observes. It never asserts internal calls. Each guard is proven by putting the bug back and watching the test fail (`test-bar` skill).

1. **Server routes.** Prior art is FormamorphServer `tests/*.test.js` (`avatars.test.js`, `anonymousLikes.test.js`, `authorListings.test.js`). Cover: publish, update and download of a Mascot listing; the size cap; Pin order in a kind's section and in All; a Supporter-only listing refused on the public route; the gated route for a signed-out caller, a non-supporter, a Supporter, a Supporter+, a lapsed account and a revoked account; the entitlement route; revision changes dropping the per-account cache.
2. **Watermark module.** Embed a payload, then read it back after WebP re-encoding at low quality, a 50% scale, a crop, and a composite over a background. Read an unmarked image as `null`. Two different accounts read as two different payloads.
3. **Scramble pair.** Shared vectors (source tiles, seed, scrambled output) checked in both repos: the server's scramble produces the vector, and the client's unscramble restores the source.
4. **Client Supporter content module.** With injected fetch and clock: install on a qualifying check; remove on a good check that excludes the item; keep through failed checks for up to 7 days, then remove; update on a new revision; nothing installed while signed out.
5. **Components.** Prior art is the CommunityCreationsBrowser tests and the `FormaquestionMascotTab.test.tsx` and `Formaquestion.mascot.test.tsx` suites. Cover: the locked button by sign-in state and tier; pinned listings first; the Mascot tab's locked entry opening the listing or installing it; Duplicate and Export refused on the exclusive; fallback to Morphie when it is removed while active.

## Out of Scope

- Supporter content in the Steam build, and Mascot listings on Workshop (Q20; planned separately).
- Encrypting the IndexedDB cache (Q4).
- Turning off DevTools in packaged builds (Q12).
- Watermarking non-image content.
- Automated leak detection. Staff run the script by hand (Q9).
- Any creator-run gating. Only staff mark a listing Supporter-only (Q13).

## Further Notes

- The user supplies the exclusive Mascot's art and its listing thumbnail. They are uploaded through the staff publish path, never committed.
- Morphie's bundled art stays exportable as it is today. This effort doesn't change the Default Mascot.
- Formaquestion and the Mascot shipped in 3.2.0, so the new `supporter` reference kind is an additive settings change for released installs.
- The watermark's robustness bar (Q7) is the largest technical risk. Its ticket proves the bar on real Mascot layers before the gated route is built on it.
