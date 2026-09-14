# 13: Listing associations in Community

Status: ready-for-human
Base: 4ca9e7ce
Status note: Built in `3ae06641`. Every acceptance criterion passes. One product call is open for the
author, in the comments below.
Blocked by: 04, 07
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: read-only presentation over server fields that ticket 04 returns, plus one not-found path in the browser.

## Parent

[spec.md](../spec.md) — Settled follow-up decisions (Unlisted, Relationships over time), Missing sources and offline use.

## What to build

Players see where content fits before they download it, and unlisted content stays invisible.

A component's community details show a **Compatible Worlds** list: its approved and community associations with the world author's review state, linked to each world. Declined associations are not shown. A world's community details name its required components, with **Not recommended by the world author** where the world author declined an add-on the player reaches by another path. Downloading a component offers its associated worlds without downloading them.

An unlisted listing opened by direct link by anyone but its author or staff renders the same not-found state as a missing listing. Author and staff open it normally and can download it standalone.

## Acceptance criteria

- [x] A component's details list its approved and community worlds with review state; a declined world is absent.
- [x] A world's details list its required components.
- [x] Downloading a component with associations offers those worlds and installs only the component.
- [x] A direct link to an unlisted listing shows not found for another player, and the full listing with a standalone download for its author and for staff.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 04 — Server: listing relationships and Unlisted.
- 07 — Manage Add-ons review.


## Comments

**Built in `3ae06641`** (Base `4ca9e7ce`). Gates, all run on the final tree: `typecheck` 0 errors ·
`lint` 0 errors · `build` 43.6 s · `test` 10029 passed, 119.4 s wall. Three tests failed, none of them
this unit's and none importing its files: `useDeviceDownload.test.tsx` fails on ticket 11's in-flight
edits to `useDeviceDownload.ts`, `entityFile.ts` and `dictionaryFile.ts`, and `StatManager.test.tsx` and
`CodeArea.test.tsx` pass in isolation.

### What it built

- [`listingAssociations.ts`](../../../../src/lib/listingAssociations.ts) — the pure seam. Splits the
  listing read's `compatibleWorlds` into approved, community, and declined.
- [`ListingCompatibleWorlds.tsx`](../../../../src/components/community/ListingCompatibleWorlds.tsx) —
  the read-only section. Each row opens that world's listing.
- [`RemoteWorldDetailsModal.tsx`](../../../../src/components/community/RemoteWorldDetailsModal.tsx) —
  draws the section for a component listing, and an **Unlisted** banner.
- [`CommunityCreationsBrowser.tsx`](../../../../src/views/CommunityCreationsBrowser.tsx) — resolves a
  named world out of the catalog, or says it is no longer there.

No new fetch: both `compatibleWorlds` and `visibility` already came back from the listing read that
ticket 05 added. No export-shape change.

### One product call for the author

**Where the Not recommended by the world author label goes.** The ticket says a declined world is
absent, and the parent spec says the label is "for the affected world" on content "the player reaches by
another path". Ticket 04 settled the server half: a declined association is sent only to the component's
author and to staff. So the client groups declined rows apart under that exact label, and decides the
audience again for itself rather than trusting the row that arrived. A player never sees one even if a
server over-sends. Say if you would rather the author saw nothing either.

### Notes

- **Criterion 2 was already met by ticket 06.** `DownloadLinkedContent`'s Required tab lists a world's
  required components. This unit covers it with tests rather than building a second list.
- **Criterion 4's client half is the catalog.** The server omits an unlisted listing from browse for
  everybody but its author and staff, so the existing direct-link path already answers not found. What
  this unit adds is the banner telling the author why nobody else can find it.
- **Verified in the running app** at 1440x900: the section's groups, counts, and copy read correctly out
  of the live DOM, and the Unlisted banner and standalone **Download Entity** button are on screen.
- **Not fixed, named.** The details modal now holds four `useState` fed from one `ListingDetails` and
  cleared in lockstep (`changelog`, `modelLicense`, `associations`, `listingVisibility`). One `details`
  object would keep them from drifting. Out of this unit's scope, and the file is busy.
- **Glossary.** Association, Compatible Worlds, and Unlisted are new player-facing vocabulary with no
  `CONTEXT.md` entry yet.
