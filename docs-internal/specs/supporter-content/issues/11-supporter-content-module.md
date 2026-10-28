# 11: Client: Supporter content module

Status: ready-for-agent
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

- [ ] A qualifying check installs nothing on its own; the install action installs one item.
- [ ] A good check that excludes an item removes it.
- [ ] Failed checks keep the cache until 7 days after the last good check, then remove it.
- [ ] A new revision replaces the installed copy.
- [ ] Signed out, nothing is fetched; an existing cache follows the 7-day rule.
- [ ] Unscramble restores every shared vector exactly.
- [ ] Unit tests drive all of the above through the module's public interface, with fetch and clock injected.
