# Spec: Age gate for community content

Status: ready-for-agent

## Problem Statement

Community Creations carries user-generated content with NSFW elements, and nothing stands between a new player and it. The catalog, thumbnails, profiles, and comments are all reachable signed out, with no age acknowledgment anywhere in the app. Community-derived data also persists on the client (catalog metadata, thumbnail blobs), so even a player who never opened the browser again still holds it.

## Solution

A client-side age gate: a non-dismissible dialog attesting "I am at least 18 years old and of legal age to view adult content where I live." Until it is accepted, the app neither fetches nor shows any user-generated community content, and the persisted community caches are purged. Declining closes the surface; reopening re-prompts. Admin-authored surfaces (event banners, contest posters, broadcasts) are exempt. The acceptance flag is local but policy-shaped, so a later server-side `age_gate` policy adopts it without redesign.

## User Stories

1. As an underage player, I want community content unreachable without an adult attestation, so that the app does not show me NSFW material.
2. As a player opening Community Creations for the first time, I want the gate before anything loads, so that no listing of any kind, thumbnail, or profile arrives ahead of my answer.
3. As a player who declines, I want the browser to close and the full game to keep working, so that declining costs me nothing else.
4. As a player who declined earlier, I want the gate again on every reopen, so that I can change my answer whenever I qualify.
5. As a signed-out player clicking Sign In, I want the gate first, so that account creation (and the NSFW profiles it unlocks) sits behind the attestation.
6. As a player who accepted, I want community features to unlock immediately in the same session, so that acceptance is not followed by a reload.
7. As a player who used Community Creations before the gate existed, I want my cached catalog and thumbnails purged until I accept, so that old NSFW data is not sitting on my disk unattested.
8. As a signed-in player updating to the gated version, I want the gate at boot before anything else, so that my session does not keep fetching community data unattested.
9. As that signed-in player, I want declining to sign me out and purge the caches, so that my answer has effect.
10. As a player with community worlds already in my library, I want them untouched by the gate, so that my library remains mine regardless of my answer.
11. As a player, I want admin-run contest banners and posters still visible without the gate, so that curated announcements are not collateral damage.
12. As a player who wipes app data, I want the gate to ask again, so that a fresh profile starts unattested.
13. As the maintainer, I want the gate's copy versioned, so that changed wording re-prompts everyone.
14. As the maintainer, I want the flag shaped like the existing policy acceptances, so that a future server-side `age_gate` policy syncs it instead of migrating it.
15. As the maintainer, I want the demo build unaffected, so that the build with community features off gains no dead dialog.
16. As a desktop or itch player, I want the same gate in every distribution, so that the attestation travels with the app rather than with one host.
17. As a player reaching Community Creations through a contest banner's View Entries button, I want that path gated too, so that no side door skips the attestation.
18. As a player who accepted and then signs in, I want no second gate at the sign-in step, so that one attestation covers the session's surfaces.
19. As a staff member, I want my sign-in (and the admin tools behind it) behind the same gate, so that staff accounts attest like everyone else.
20. As a player on a shared computer, I want a data wipe to remove my attestation along with everything else, so that the next person starts unattested.

## Implementation Decisions

- **The gate is one dialog component** in the image of the existing publish policy dialog: modal, no Escape, no backdrop dismiss, no close button; exactly Accept and Decline. Attestation copy: at least 18 **and** of legal age where the player lives. Decline closes the calling surface with no further copy.
- **Three trigger points, one flag:**
  - Opening Community Creations (any tab, including View Entries from a contest banner) while unattested.
  - The Sign In path (the MainMenu profile circle while signed out) while unattested.
  - Boot, when a stored auth token exists and the flag is absent — shown before the event acknowledgment poster. Accept continues; Decline signs out, purges the community caches, and continues signed out.
- **Until accepted, no UGC request leaves the client.** The catalog sync, thumbnail fetches, world content, remote details, profiles, comments, and likes are all behind the flag. Admin-authored fetches are exempt: active events, the contest archive, event prose and posters, broadcasts — including the winner world titles and author names those contest rows carry (curated podiums; place badges on library cards stay).
- **Cache purge:** the catalog store and the thumbnail store are deleted (a) once, at first launch of the gated version when no acceptance flag exists, and (b) on every explicit decline. The remote-image cache is NOT purged — it serves worlds in the player's library, which the gate never touches. Browser filter state and hidden-lists stay — the player authored them.
- **The flag is local and policy-shaped:** stored acceptance carries a version integer; bumping the version (changed copy) re-prompts. Layout mirrors the server's policy acceptance shape so a future server-side `age_gate` policy (accept/decline endpoints, per-user reset, `acceptanceVersion`) adopts the client flag as its local mirror — the same relationship the upload gate already has.
- **Clearing app data clears the flag** — no special-casing; re-gating after a wipe is correct behavior.
- **No third state.** Decline is not remembered as a lockout; it closes the surface and the next open re-prompts ("badgering" is the design).
- **Reader-side only.** No upload tagging requirements; publish-time popups remain the admin-configured tag-notice machinery's job.
- **Client-only.** No server coordination in this effort; the server-side policy is a later, tracked coordination item like the staff 2FA one.
- Builds with community features compiled off contain no gate surface at all (it rides the existing feature flag).

## Testing Decisions

- **One seam: the UGC fetch boundary, observed through the real surfaces.** Every test renders a real surface with real providers and asserts at that boundary - what leaves the client and what renders - never the gate's internals. Good tests assert behavior: opening Community Creations unattested shows the gate and — the load-bearing assertion — **zero UGC requests leave the client** (spy on fetch); accepting unlocks the same session without a reload; declining closes and re-opening re-prompts.
- **Boot path:** with a stored token and no flag, the gate renders before the event poster; decline clears the token and purges the two stores (assert the IndexedDB stores are gone), accept leaves the session intact.
- **Migration purge:** seeded catalog/thumbnail stores plus an absent flag → both stores empty after boot; the remote-image cache survives.
- **Version bump:** stored acceptance at version N, gate at N+1 → re-prompt.
- **Exemptions:** event banner and contest fetches still fire unattested.
- Prior art: the GamePanels test harness (real providers, service stubs), the Radix-in-jsdom notes, and the existing first-run gate tests. The standing test bar applies: guards proven by reinstating the bug (e.g. remove the flag check and watch the zero-requests assertion fail).

## Out of Scope

- Server-side enforcement and the `age_gate` server policy (later coordination with the server owner).
- Upload-side NSFW tagging or rating requirements.
- Real age verification (ID or estimation services); this is self-attestation.
- Content-level filtering, blurring, or per-world ratings inside the browser once accepted.
- The landing page (SFW by construction; no gate).
- Jurisdiction-specific legal compliance review (e.g. UK OSA "highly effective age assurance") — a product/legal judgment outside this effort.

## Further Notes

- The inventory behind these decisions (every community fetch point, persisted store, and login entry) was gathered on 2026-09-01; the boot-time surfaces are the event banner, the contest archive, and the event poster, and the only login trigger is the MainMenu profile circle.
- Two non-dismissible boot dialogs can now queue (age gate, then event poster). The gate renders first by design; the poster's own acknowledgment flow is unchanged.
- The gate is app code: changelog entry expected, no version bump, no export-shape change.

## Comments

**Implemented in `da55ab6`.** Four gates green (typecheck 0 · lint 0 · 7449 tests, 47.8s · build 17.5s).

Where it lives: [ageGate.ts](../../src/lib/ageGate.ts) (the flag), [AgeGateContext.tsx](../../src/contexts/AgeGateContext.tsx) (provider + boot pass), [AgeGateDialog.tsx](../../src/components/community/AgeGateDialog.tsx) (the copy), [communityCaches.ts](../../src/lib/communityCaches.ts) (the purge). Tests in [MainMenu.ageGate.test.tsx](../../src/views/MainMenu.ageGate.test.tsx), driven through the real menu under the real providers.

Two deliberate departures from the letter of the spec, both toward its intent:

- **The purge runs on every unattested launch, not once.** A version bump re-prompts an already-cached device, and leaving that cache on disk while unanswered is the thing the purge exists to prevent. It is one no-op transaction when there is nothing to drop.
- **The stores are emptied by a transaction, not deleted.** `indexedDB.deleteDatabase` is blocked by any open connection and resolves without deleting, so a purge racing a card mid-render silently did nothing. Measured: the first version of the boot purge failed exactly this way.

**Still conventional rather than structural.** Only the catalog sync carries its own flag check ([useCatalogSync.ts](../../src/lib/useCatalogSync.ts)). Thumbnails, world content, remote details, profiles, comments, and likes are gated by the browser never mounting open. A seventh community call added later is gated only if its author remembers. The structural fix is a seam at the service layer; it touches eight services and was left out of this pass.
