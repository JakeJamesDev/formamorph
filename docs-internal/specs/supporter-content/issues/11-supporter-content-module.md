# 11: Client: Supporter content module

Status: done
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the client's core deep module: entitlement rules, an offline window, a scrambled cache and draw-time unscrambling.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Owns installing Supporter content and the "qualifies" state that tickets 12 and 13 use.

## What to build

A module with injected fetch and clock. At each app start while signed in it calls the entitlement route, updates installed items, and removes items that are no longer entitled (Q3, Q22). If the check fails it keeps the cache for 7 days after the last good check, then removes it (Q6). It exposes whether the account qualifies, the installed items, and an install action for one item.

The gated route returns each image as `{ dataUrl, seed, version, sourceWidth, sourceHeight }` in place of its data-URL string, as lossless PNG (Q36). Installed content stays scrambled in IndexedDB, keyed by listing id and revision. An unscramble function, tested against ticket 05's vectors copied into this repo, rebuilds a layer onto a canvas in memory, then crops the padding back to the original size (Q34). Unscrambled layers are never stored and never become a downloadable Blob (Q4).

## Acceptance criteria

- [x] A qualifying check installs nothing on its own; the install action installs one item. (`supporterContent.test.ts`: "reports a qualifying account and installs nothing on its own", "downloads one listing from the gated route")
- [x] A good check that excludes an item removes it. ("removes an installed item that a good check no longer lists", "removes everything when the pledge ended"; storage read too)
- [x] Failed checks keep the cache until 7 days after the last good check, then remove it. ("failed checks" block: unreachable and error status, boundary at exactly 7 days, running app past the window)
- [x] A new revision replaces the installed copy. ("replaces the installed copy…", old revision gone from storage; failed re-fetch keeps the old copy)
- [x] Signed out, nothing is fetched; an existing cache follows the 7-day rule. ("signed out" block)
- [x] Unscramble restores every shared vector exactly. (`scramble.test.ts`: all six vectors, pure path and canvas path)
- [x] Unit tests drive all of the above through the module's public interface, with fetch and clock injected. (fake server + fake-indexeddb; 12 mutations of the module all turn a test red)

## Landed

**Not verified**

- Nothing unticked. The canvas path ran against a stub 2D context in jsdom, not a real browser canvas; ticket 12 draws it for real.

**For you**

- Nothing to judge yet: the module has no UI until tickets 12 and 13.

Notes for tickets 12/13: import from `@/lib/supporterContent` (`supporterContent` singleton: `subscribe`/`getSnapshot` → `{ status, qualifies, entitled, installed }`, `install(id)`, `readItem(id)`; `isScrambledLayer`, `unscrambleToCanvas`). Account isolation follows Q39. A device clock set back before the last good check extends the offline window; Q4 already accepts an editable cache, so this adds no new path.
