# Spec: Thumbnail cache and catalog freshness (client)

Status: ready-for-agent

Server side: the FormamorphServer repo, `docs-internal/specs/catalog-freshness/spec.md`. Build that first; the third part here depends on it.

## Problem Statement

Community Creations opens slowly. The cards appear at once from the local copy of the catalog, but every thumbnail starts blank and fills in one by one, on every open — even though every one of them is already stored on this device. Paging, switching Kinds, and coming back to a page repeat the same blank-then-fill. Behind it, every open also re-downloads the whole catalog and rewrites the local copy, whether or not anything changed.

## Solution

Three changes, each removing one repeated cost.

- **Remember resolved thumbnails for the session.** Once a thumbnail has been turned into something the page can show, it stays available in memory until the tab closes. Every later card that needs it paints on the first frame. The disk cache stays as it is.
- **Read a page's thumbnails in one go.** When a page of cards mounts, the stored thumbnails for the whole page are read together rather than one card at a time.
- **Refresh the catalog only when it changed.** The app keeps the server's freshness tag beside its local catalog and sends it back on the next open. When the server says nothing changed, the local copy stands and no rewrite happens.

Nothing changes for a first visit: a thumbnail never seen is still fetched, stored, and shown, and a catalog never fetched is still downloaded in full.

## User Stories

1. As a reader, I want thumbnails I have already seen to appear the moment their card does, so that the catalog opens as fast as it says it does.
2. As a reader, I want the next page's thumbnails to appear at once when I have visited it before, so that paging back and forth is instant.
3. As a reader, I want switching between Worlds, Entities, and Dictionaries and back to keep every thumbnail I already saw, so that a tab switch never blanks the grid.
4. As a reader, I want closing Community Creations and opening it again to keep every thumbnail from this session, so that a second look costs nothing.
5. As a reader, I want a thumbnail I have never seen to still load and be stored, so that the first visit works as it always has.
6. As a reader, I want a Listing whose thumbnail changed to show the new picture, so that a remembered image never goes stale.
7. As a reader, I want a page of never-seen thumbnails to arrive together rather than trickle in, so that a fresh page reads as one paint.
8. As a reader, I want the catalog to open without re-downloading a list that has not changed, so that the open is faster on every visit after the first.
9. As a reader, I want a change on the server — a new Listing, a new Like, a new Comment — to reach me on my next open, so that faster never means stale.
10. As a reader, I want the app to still fall back to a full download when the server does not know my tag, so that an old server or a cleared cache never breaks the open.
11. As a signed-in reader, I want my liked marks and my own quarantined Listings to stay right after a skipped refresh, so that a `304` never hides my own state.
12. As a reader on a slow connection, I want a skipped refresh to cost one small request and no rewrite, so that the saving is real where it matters.
13. As a reader whose browser has cleared site data, I want the catalog and thumbnails to load in full and be stored again, so that a wiped cache is a slow open and not a broken one.
14. As a developer, I want the in-memory thumbnail store bounded, so that a long session browsing hundreds of Listings does not grow without limit.
15. As a developer, I want the blank-image fallback gone, so that a failed thumbnail shows the card's placeholder rather than a broken picture.
16. As a developer, I want a regression in any of the three to fail a test, so that the speed survives the next refactor.

## Implementation Decisions

**Vocabulary.** *Catalog* is the full list the browser fetches: every Listing of every Kind, in one request. *Thumbnail* is a Listing's stored preview image, keyed by the server's per-upload filename. *Resolved* means turned into an object URL the page can put in an image element. *Tag* is the server's `ETag` for the catalog response.

### Part 1 — the session store

**A module-level map from thumbnail filename to resolved object URL**, kept in the thumbnail cache module beside the disk cache. Keyed the same way the disk cache is, and recording the same `updatedAt` so a newer Listing invalidates the entry exactly as it invalidates the disk record.

**The hook checks the map first, synchronously.** When the map has a current entry, the hook's initial state is that URL and the image renders on the first frame with no effect involved. Only a miss falls through to the disk read and, past that, the network.

**Object URLs are no longer revoked on unmount.** Revoking is what made every remount start over. The map owns each URL for the session and revokes only what it evicts. A newer `updatedAt` for a known filename replaces the entry and revokes the old URL.

**Bounded.** The map holds a fixed number of entries, evicting least recently used and revoking what it evicts. The cap is a small multiple of one page, large enough that paging through the whole catalog once keeps every thumbnail, and it is a named constant beside the disk cache's own cap.

**The error fallback is removed.** On any failure the hook resolves to nothing, and the card shows its placeholder. The old fallback pointed the image at the raw cross-origin URL, which the server's resource policy blocks from an image element, so it only ever produced a broken picture.

**The image element gains hints.** The rendered image declares asynchronous decoding and its intrinsic size from the card's aspect token, so a batch of new thumbnails decodes off the main thread and the grid does not shift as they land.

### Part 2 — the batched read

**One read per page, not per card.** The thumbnail cache module gains a function that takes a list of filenames and answers with every matching record in one transaction. The hook is unchanged in shape; what changes is who asks. The grid, which knows the page's filenames, asks once when the page changes and hands the results to the session store before the cards mount. A card whose thumbnail arrived that way finds it in the map on its first render.

**Cards still self-serve on a miss.** A card mounted from somewhere other than the grid — the profile's Creations list, the details modal — keeps the per-card path. The batch is an optimization the grid adds; it is not a dependency the hook takes.

### Part 3 — the conditional refresh

**The tag is stored beside the catalog.** The catalog cache module gains a place for one string, the last tag the server answered with, written in the same transaction that replaces the records.

**The refresh sends it back.** The catalog fetch gains an optional tag argument. When given, the request carries `If-None-Match` and is made with the browser's HTTP cache bypassed, so a `304` reaches the app rather than being turned into a `200` by the browser first. The call answers one of two shapes: *fresh*, with the rows and the new tag, or *unchanged*, with nothing. The service does not throw on a `304`.

**The bypass must be `no-store`, not `reload`.** Measured against the server: a conditional request that also carries `Cache-Control: no-cache` answers `200` with the whole body however well the tag matches, because Express reads that header as an end-to-end reload and skips its freshness check. `fetch(url, { cache: 'reload' })` sends exactly that, so it turns the tag off silently — every open looks like a change. `cache: 'no-store'` bypasses the browser's cache without sending it, and answers `304`. Pinned server-side in `catalogFreshness.test.js`.

**Unchanged means untouched.** On *unchanged*, the sync hook keeps the records it already rendered, writes nothing to the catalog store, and marks the catalog settled. On *fresh*, it replaces records and tag together as it does today. On a `200` with no tag at all — an older server — it behaves exactly as today and stores no tag.

**Signed-in state is the server's problem, by design.** The tag the server answers with already differs by credential and its response varies by `Authorization`, so a signed-in reader's tag never matches an anonymous body and the liked marks and quarantine visibility in a kept copy are that reader's own. The client stores one tag, for whoever fetched last; signing in or out clears it, since the next catalog is a different reader's.

**No export-shape change.** The catalog store and the thumbnail store are local caches, never exported, never in a save or a world file.

## Testing Decisions

**Two seams, both existing: the hooks, and the modules under them.**

- The thumbnail hook is tested with `renderHook` against a fake IndexedDB, the way the thumbnail cache module already is, with `fetch` spied. The session store is exercised through the hook, not on its own — mount, unmount, remount is the behavior.
- The sync hook is tested with `renderHook` and a spied storage service, the way it already is, with the catalog store faked.
- The batch read and the tag storage are tested in the thumbnail and catalog cache modules' own files against the fake IndexedDB.

**What a good test looks like here.** It mounts, watches what the hook resolves to and when, and counts what was read or fetched. It asserts on the source the image would show and on calls to the store and the network, never on the map's contents or the hook's internals.

**Coverage to write.**

- Thumbnail hook: a first mount reads the disk, a second mount of the same filename resolves on the first render with no disk read; a newer `updatedAt` for the same filename reads again and the old URL is revoked; a filename beyond the cap is evicted and reads again; a disk miss fetches and stores once; a fetch failure resolves to nothing and the image is not rendered; an unmount mid-fetch does not set state.
- Batch read: a list of filenames answers every stored record in one transaction and omits the missing; an empty list reads nothing.
- Catalog tag: replacing the catalog with a tag stores both; reading answers the tag beside the rows; replacing without a tag clears the old one.
- Sync hook: a cached catalog with a tag sends it and, on *unchanged*, renders the cached rows, writes nothing, and settles; on *fresh*, replaces rows and tag; a cached catalog with no tag sends none; an empty cache never sends a tag; signing out clears the tag before the next fetch.
- Storage service: the catalog fetch sends `If-None-Match` and bypasses the HTTP cache only when given a tag; a `304` answers *unchanged*; a `200` answers *fresh* with the tag read from the response; a `200` without a tag answers *fresh* with no tag.

**Prior art.** The thumbnail cache test for the fake IndexedDB setup and epoch handling. The catalog sync test for the spied service and the faked store. The details modal changelog test for a spied fetch answering a specific status.

**Bar.** Coverage is measured on the three modules, not guessed. Each guard is checked to fail when its line is removed: the synchronous map hit, the eviction, the skip on *unchanged*, the cache bypass. No fixture is shaped so a read cannot fire. Typecheck, lint, test, and build all pass, then the code graph is updated.

## Out of Scope

- The disk cache's own prune, which loads every stored blob once the store is over its cap. Named, not fixed here; it is a separate change to the same module.
- Warming either IndexedDB connection before the browser opens.
- A `?since=` delta fetch. The server hard-deletes Listings and cannot report removals.
- Changing the image element's fetch path or the resource policy on thumbnails.
- Virtualizing the grid.
- Any change to how the catalog is filtered, sorted, or paged.

## Further Notes

The blank-then-fill was never a cache miss. The hook renders nothing until an effect has opened the database, read the record, and made an object URL — so even a perfect hit paints blank for a few frames, and every unmount revoked the URL so the next mount started over. Part 1 is the fix the reader feels; Parts 2 and 3 shorten what remains.

Part 3 needs the server spec landed first: without `ETag` exposed across origins and `If-None-Match` allowed through the preflight, the browser refuses the conditional request before it leaves. Build Parts 1 and 2 against any server; gate Part 3 on the server's deploy.
