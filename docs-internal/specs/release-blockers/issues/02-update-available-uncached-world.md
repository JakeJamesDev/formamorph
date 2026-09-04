# 02 — "Update Available" doesn't open an uncached world

Type: task
Status: done
Blocks: release

## Problem

The **Update Available** message does not open to the updated world when that world isn't already
cached. Raised as a release blocker 2026-08-22.

Expected: acting on the notice takes you to the updated world regardless of whether it happens to be
in whatever the client has already fetched. Today it only works when the world is already on hand.

## Starting points — unconfirmed, needs triage first

Two surfaces carry an "Update Available" affordance and it isn't yet pinned which one is meant (or
whether both are affected):

- `src/components/community/RemoteWorldDetailsModal.tsx:193` — the details-modal action button,
  which mirrors the card's contextual download state (`downloadStateForWorld`).
- `src/components/community/RemoteWorldCard.tsx:138` — the `cloudUpdate` icon on the card itself.

Not this: `src/components/menu/UpdateVersionControl.tsx:29` is the desktop **app** updater's
"Update Available!" string, a different feature.

Likely shape of the bug: the target is resolved by looking the world up in an already-loaded
catalog page or session cache, so a world outside that set resolves to nothing and the open is a
no-op. Fix probably means fetching the single world by id on demand rather than requiring it to be
present locally.

## First step

Reproduce with a world that is definitely not in the cached list, and confirm which of the two
surfaces the report is about, before touching code.

## Comments

**Triage 2026-08-23 (code-level; live repro pending flow confirmation).** Neither guessed surface
is the bug: both the card icon (`RemoteWorldCard.tsx:138`) and the details-modal button
(`RemoteWorldDetailsModal.tsx:298`) *download* by listing id via `fetchCatalogContent` — always a
live fetch, no cache dependence, and both only render for a world already in the catalog list.
There is also no Library-side "Update Available" notice at all (repo-wide sweep: the only other
match is the desktop app updater).

The one flow that matches "acting on the notice only works when the world is already on hand" is
the **open-a-listing-from-outside jump** — a NotificationsTab row ("X published a new world / updated
their world", `NotificationsTab.tsx:26`) or a profile-dialog listing row — which funnels through
`handleOpenListing` (`MainMenu.tsx:504`) into the effect at `CommunityCreationsBrowser.tsx:451`:

- The effect waits only for `isLoadingRemoteWorlds`, which is true **only when the IDB catalog
  cache is empty** (`useCatalogSync.ts:26` — a warm cache renders instantly and refreshes in the
  background under `isSyncingCatalog` instead).
- So for any returning user the lookup runs against the **previous visit's snapshot**
  (`worldCatalog.ts` — persistent IndexedDB). A listing published (or made visible) since then
  isn't in it: the effect fires the misleading toast "That listing is no longer in Community
  Creations" and `onListingOpened()` clears the pending listing — so when the fresh catalog lands
  moments later, nothing re-runs. Cold opens (empty cache) work, which is why it looks intermittent.

One bug, two feeders (notifications, profile listings), one broken effect.

**Proposed fix** (small): in the effect, when the listing isn't found and `isSyncingCatalog` is
still true, wait (return without toasting or clearing); the effect re-runs when the sync lands and
either opens it or truthfully reports it gone. Keeps the instant open for listings the cache does
have.

**Needs from the reporter:** confirm the failing action was a notification/profile listing row
(not the download button), so the repro matches the report before the fix lands.

## Answer

Reporter confirmed the failing flow was a **notification row** — the open-listing jump, not the
download button. Root cause (worse than triaged): the lookup effect in
`CommunityCreationsBrowser.tsx` ran against whatever `remoteWorlds` held at arrival — last visit's
IDB snapshot, or `[]` on the session's first open, since the loading flags only flip after an async
IDB read — so any listing not already in memory was toasted "no longer in Community Creations" and
the request cleared before the real catalog landed.

Fix (2026-08-23): `useCatalogSync` now exposes `catalogSettled` — false until a refresh attempt
completes during the current open (set in `loadCatalog`'s `finally`, reset when the browser
closes). The open-listing effect opens a hit immediately, but holds a miss until `catalogSettled`;
only then does it toast. Closing the browser mid-wait drops the request instead of replaying it on
a later open.

Tests: `useCatalogSync.test.ts` (4 — settled timing incl. failure path and close reset; module at
97% stmts / 87% branch, uncovered line is the catch's console.error) and
`CommunityCreationsBrowser.openListing.test.tsx` (5 — hold, open-on-landing, gone-after-settle,
instant hit, drop-on-close). All three guards mutation-tested: each reintroduced bug failed exactly
the expected test, sources restored and verified. Four gates green. Not verified live: the
notification path needs staged server data (a listing published since the local cache); named as
tested-only.
