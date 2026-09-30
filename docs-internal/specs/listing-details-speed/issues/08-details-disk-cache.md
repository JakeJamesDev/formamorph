# 08: Listing details disk cache

Status: ready-for-human
Base: 859c77f1
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

New storage module with privacy keying, eviction, and purge rules; mistakes leak one account's view to another.

## What to build

Spec Q7. Listing details are kept in IndexedDB beside the catalog. Reopening a listing shows its cached details at once, and a fresh fetch always replaces them. A new loader returns cached details at once and fresh ones when they arrive; the details window reads through it.

## Acceptance criteria

- [ ] Entries hold exactly what the details fetch returns, never a thumbnail.
- [ ] Entries are keyed by listing id and reader, the same reader identity the catalog tag uses; another reader never sees them.
- [ ] A 404 drops the entry; a network failure keeps it.
- [ ] The store keeps about 300 entries and evicts the least recently used.
- [ ] The age-gate purge clears the store with the other community caches.
- [ ] The details window shows cached details first, then fresh ones, and a stale answer never lands in another listing's window.
- [ ] Tests at the cache module seam (fake-indexeddb) and the details window seam cover each rule and fail when it is removed.
