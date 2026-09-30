# Spec: Listing details speed (client)

Status: ready-for-agent
Spec session: listing-details-speed — spec
Status note: first iteration, items 1–5; more items will follow.

Server side: the FormamorphServer repo, `docs-internal/specs/listing-details-speed/spec.md`.

## Problem Statement

When a reader opens a listing in Community Creations, the details window builds itself in stages. The Changelog | Comments switch appears only after the listing details answer, so the right column jumps down. The comments header reads "Comments (0)" and then changes. Linked Content and Compatible Worlds appear late and push the left column around. Each reopen of a listing, even one opened a minute ago, waits a full round trip again. The round trip is about 180 ms at best and over 500 ms on a new connection.

Community Creations itself opens slower with a cached catalog than with an empty one. The cached cards render in the same step that shows the window, so the window waits on them. On a slow device, that wait is over a second.

## Solution

The window opens in its final layout and fills in without moving.

- The Changelog | Comments switch is always there. Changelog is disabled until the app knows the listing has entries.
- The catalog already tells the app how many changelog entries and comments a listing has, so most windows open with the right tab state and the right comment count at once.
- Sections that wait on the network hold their space until the answer arrives.
- Listing details are kept on disk. A listing opened before shows its last known details at once, and the fresh answer replaces them.
- Resting the pointer on a card starts loading that listing, so the data is often ready by the click.
- Community Creations shows its window first and fills in the cards after. Cards render once per catalog answer, and tooltips cost nothing until someone uses one.

## User Stories

1. As a reader, I want the Changelog | Comments switch in the same place on every listing, so that the right column never jumps when the window opens.
2. As a reader, I want Changelog disabled on a listing with no entries, so that I can see there is nothing to read there.
3. As a reader, I want Changelog enabled the moment the window opens when the listing has entries, so that I don't wait for a second request to find out.
4. As a reader with an update available for a listing I downloaded, I want the window to open on Changelog, so that I see what changed first.
5. As a reader who clicked a tab while the window was loading, I want my choice to stay, so that a late answer doesn't switch the panel under me.
6. As an author, I want Changelog enabled on my own listing even with no entries, so that I can start a changelog where it will appear.
7. As a reader against a server that has never heard of changelogs, I want Changelog to stay disabled, so that nothing breaks.
8. As a reader, I want the comments header to show the real count at once, so that it doesn't read "(0)" and then change.
9. As a reader, I want placeholder rows where comments will appear, so that the list doesn't jump when they arrive.
10. As a reader of a listing with no comments, I want the empty state at once, so that I don't watch placeholders for nothing.
11. As a reader, I want Linked Content and Compatible Worlds to arrive below everything else in the left column, so that nothing I'm reading moves.
12. As a reader who opened a listing before, I want its details to show at once, so that a reopen feels instant.
13. As a reader, I want cached details replaced by fresh ones in the background, so that I never keep reading stale data.
14. As a reader, I want a listing that was deleted or hidden since my last visit to drop out of the cache, so that I don't see a listing I can't open.
15. As a reader who signs in, signs out, or switches accounts, I want details cached for another account never shown to me, so that one account's view never leaks to another.
16. As a reader who resets the age gate, I want the details cache cleared with the other community caches, so that the purge is complete.
17. As a reader on the desktop or Android app, I want the details cache to survive a restart, so that the first open after a restart is fast too.
18. As a reader, I want the details cache to stay small, so that it doesn't grow without limit on my device.
19. As a mouse user, I want a listing to start loading when I rest the pointer on its card, so that the window is often ready when I click.
20. As a mouse user sweeping across a row of cards, I want no requests for cards I pass over, so that the app stays light.
21. As a keyboard user, I want focus on a card to start loading it the same way, so that I get the same speed.
22. As a touch user, I want no prefetch, so that nothing loads that I didn't ask for.
23. As a reader, I want a prefetch that is still running to be used by the open, so that the open never sends the same request twice.
24. As the operator, I want at most one prefetch in flight at a time, so that server load stays bounded.
25. As a website reader, I want the same behavior on formamorph.ai, so that the site and the app match.
26. As a reader, I want Community Creations to appear the moment I click it, so that the app feels responsive.
27. As a reader with a cached catalog, I want the window to open as fast as it does with an empty cache, so that caching never makes the open slower.
28. As a reader on a slow device, I want the window to stay responsive while the cards render, so that I can scroll, type, or close it at once.
29. As a reader, I want the cards to update in place when the fresh catalog arrives, so that unchanged cards don't flicker or stall.
30. As a reader, I want every tooltip to keep working, so that the speedup costs no help text.
31. As a keyboard and screen-reader user, I want every tooltip trigger to keep its accessible name, so that the speedup costs no accessibility.
32. As a keyboard user, I want to tab to a community card and open it with Enter, so that I can browse without a pointer.

## Implementation Decisions

Rulings settled in the session that wrote this spec:

- **Q1. The switch is always shown.** Changelog is disabled until the app knows the listing has at least one entry. An author's own listing enables Changelog regardless. This supersedes the Listing Changelog rule that the switch is absent on a listing with no entries.
- **Q2. A late default never overrides a choice.** The default tab (Changelog when the listing has entries and the reader's copy needs an update, else Comments) applies only while the reader has not picked a tab in this open.
- **Q3. The catalog carries the entry count.** Each catalog row gets `changelog_count`. The window reads it for the tab state and the default tab before the details answer. The details answer is the authority and corrects the count when they differ. A row without the field (older server) behaves as it does today: the state is unknown until the details answer.
- **Q4. Comments start from the catalog count.** The header uses the row's `comment_count` until the comments fetch answers. Placeholder rows show only when the count is above zero, one per expected comment up to one page. At zero, the empty state shows at once.
- **Q5. Late sections never move what the reader sees.** The form is ruled by Q11.
- **Q12. Cards open from the keyboard.** Added by the user after ticket 09 found the gap. The card title is a real button that opens the details window, and its hit area covers the card. Inner controls stay separate buttons, so no control nests inside another. The card frame gets no `tabIndex`.
- **Q11. Late sections go to the bottom of their column.** Ruled by the user (ticket 07). Linked Content and Compatible Worlds move to the end of the left column, so a late arrival pushes nothing above it. No placeholder, no reserved space, and no server field.
- **Q6. Hover prefetch is guarded.** It starts after the pointer rests on a card for about 150 ms, or when a card gets keyboard focus. It never starts from a touch pointer. A new prefetch cancels the one before it. A listing whose details are already cached in this visit is not prefetched. A prefetch loads the listing details (into the disk cache) and the first comments page (in memory, for the next open only). An open that finds a prefetch in flight waits for it instead of sending its own request.
  - **Q6a. Ruling (ticket 09): reuse, focus, and "this visit".** An open of the listing the last prefetch loaded reuses that answer once, whether it is in flight or settled, as long as it settled within about 30 seconds. An older answer only fills the disk cache, and the open fetches fresh. The next open of that listing fetches fresh too; that is Q7's rule. Keyboard focus that enters a card (`:focus-visible` on a control inside it) starts the same dwell as a resting pointer, so tabbing past cards sends nothing. A tap that focuses a control inside a card does not start one. Cards get no new `tabIndex` here. "Cached in this visit" means a fresh answer for this reader in this app session, from an open or a prefetch. A disk entry from an earlier visit does not count. Only the last prefetch holds a comments page. Only an answer is reused. A 403 or 404 counts as an answer. A prefetch that got no answer (unreachable, or a failed comments page) never stands in for the open, and a re-hover retries it.
- **Q7. Listing details are cached on disk.** The cache lives in IndexedDB beside the catalog. It holds exactly what the details fetch returns, never a thumbnail. Entries are keyed by listing id and reader, the same reader identity the catalog tag uses. An open shows the cached entry at once and always fetches fresh. A 404 drops the entry. A network failure keeps it. The store keeps about 300 entries, evicting the least recently used. The age-gate purge clears it with the other community caches.
  - **Q7a. Ruling (ticket 08): what drops and what keeps.** A 403 or a 404 drops the entry: both mean the listing is not this reader's to see, which covers story 14's deleted or hidden listing. A 5xx, a 429, or a thrown fetch keeps it. When cached details are on screen and the fresh fetch fails that way, the window keeps showing them; on a 403 or 404 it clears them as today. With no cached entry, a failure behaves as today. The store may be its own IndexedDB database, as the thumbnail cache is, as long as the age-gate purge clears it.

- **Q8. The window paints before the cards.** Opening Community Creations commits the window shell first. The card grid renders after, as a transition, so the first paint never waits on it. This applies to cached and fresh rows alike.
- **Q9. One catalog answer is one grid render.** The catalog loader batches the states it sets (rows, the anonymous-likes flag, the syncing flags) into one commit per step. Cards are memoized. A fresh catalog row that matches the cached row keeps the cached object, so its card skips the render. As built (ticket 03): the loader commits once per step, and the browser adds its own commits in reaction to the settled flags, three per answer in all. No card renders in those extra commits, so the rule holds for cards, not for browser commits.
- **Q10. Tooltips cost nothing until used.** An idle `Tip` does not build a full tooltip root, store, and portal. The approach is picked by a prototype that measures both candidates: one shared root through Base UI's `Tooltip.createHandle()`, or the real tooltip mounted on first hover or focus. Either way, the trigger keeps its accessible name from the first render, and the tooltip opens on the first hover with no extra delay. The change lives in `Tip`, so every surface gains it.
  - **Q10a. Ruling (ticket 04): the shared root wins.** "Measures better" means main-thread blocking and window-visible time, not tooltip share of script. On those, both approaches tied within run noise at 4× (median of 3). Mount-on-hover remounts the control, so it loses focus and misses the first hover, which fails Q10. A correct version would reimplement Base UI's trigger behavior at about 3× the work, with drift risk. `Tip` adopts `Tooltip.createHandle()`.

Profiling that led to Q8–Q10 (production build, Playwright + CDP, warm open): the window became visible at 272–287 ms (1.2–1.4 s at 4× CPU throttle) against 79–103 ms with an empty cache. Data work was small: IndexedDB read of 694 rows 6 ms, write 14 ms, JSON parse 2 ms, style and layout ~40 ms. Base UI tooltip roots and triggers were 30–50% of each render block, with about 100 mounted per open. Each open committed 3–4 full grid renders.

Modules:

- **Listing details cache** (new, deep): get, put, drop, and purge, with the reader key and the size cap inside. The window and the prefetcher use it; neither knows about IndexedDB.
- **Listing details loader** (new): one function that returns cached details at once and fresh details when they arrive, and shares an in-flight request between a prefetch and an open. The window's current details fetch moves behind it.
- **Details window:** always-shown switch, the choice guard, catalog-seeded tab state and comment count, placeholders.
- **Community card / browser:** the dwell, focus, and touch rules for prefetch.
- **Community cache purge:** adds the new store.
- **Catalog sync hook:** batched commits and row reuse.
- **Community browser / card:** the shell-first transition and card memoization.
- **`Tip`:** the idle-cost change.

API contract: catalog rows gain `changelog_count` (integer, zero or more). No world or save export shape changes.

## Testing Decisions

A good test drives the window, the cache, or the route the way a reader or client does and checks what they would see. It never checks internal state or call order.

- **Server route seam:** supertest on the catalog list and the changelog routes, as in the existing changelog tests.
- **Details window seam:** the window rendered with the storage service mocked, as in the existing `RemoteWorldDetailsModal.*` tests. It covers the always-shown switch, the disabled and enabled states, the author case, the old-server case, the choice guard against a late answer, the seeded comment count, placeholders at zero and above zero, reserved space for late sections, and cached details shown first and then replaced.
- **Cache module seam:** the cache on fake-indexeddb, as in the community cache purge tests. It covers the reader key, 404 drops, the size cap, and the purge.
- **Prefetch seam:** the card or browser with fake timers. It covers the dwell delay, a sweep that sends nothing, keyboard focus, touch that sends nothing, cancel on a new prefetch, and an open that reuses the prefetch in flight.

- **Catalog sync seam:** the hook with a mocked catalog fetch. It covers one commit per answer, and row objects reused when a fresh row matches.
- **Card render seam:** the browser rendered with the real catalog hook. A React `Profiler` covers the shell committing before the grid. Per-card renders are counted at each card's shell, because a `Profiler` reports a whole subtree's commit and can't name which card rendered. That count covers unchanged cards skipping the render when the fresh catalog lands.
- **`Tip` seam:** the existing tooltip tests. They cover the accessible name before any hover, the popup opening on first hover and focus, and no tooltip root or portal mounted for an idle trigger.
- **Speed evidence:** the profiling harness runs on a production build before and after, at 1× and 4× CPU. The ticket records the window-visible time, the main-thread blocks, and the tooltip share. The harness moves from the session scratchpad into `testing/`.

Each guard is proved to bite by reinstating the behavior it replaces.

## Out of Scope

- Caching comments on disk.
- Prefetch on touch devices.
- Server response time; the round trip itself is the floor.
- The inlined thumbnail on the details response. The server stopped sending it before this spec.

## Further Notes

- The server already dropped the base64 thumbnail from the details response (FormamorphServer `f7b4e60`). The response went from 32–100 KB to about 1 KB.
- Open for the next iteration: whether disabled Changelog carries a tooltip such as "No changelog yet".
- Open for the next iteration: a target time for the window-visible number. This spec records before and after; it sets no bar.
- Moving work to a worker was ruled out for now: the data work is ~20 ms, and a worker can't render React.
