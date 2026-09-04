# Winner Badge Carry-Over

Status: ready-for-agent

## Problem Statement

A contest win is only visible on the listing's card inside the Community Creations browser. The
details modal opened from that very card says nothing about the win, a winner downloaded into the
local library looks like any other world, and the winning author's own copy of the world carries no
mark at all. The honor the contest system awards evaporates one click away from where it was won.

## Solution

The winner badge — trophy plus "Winner — \<contest title\>", exactly as the community card already
renders it — follows the world everywhere it is shown: the community details modal, the local
My Worlds library (cards and the local details modal), and, through a new publish-time link, the
author's own copy. Winner status is always derived live from the contest archive the app already
fetches; nothing about a win is stored locally, so a win announced after a download appears
retroactively and the badge simply hides while offline.

## User Stories

1. As a player browsing Community Creations, I want the details modal to show the winner badge under the world's title, so that opening a winning card never loses the honor the card showed.
2. As a player, I want the badge in the details modal to name the contest it was won in, so that I know which event the world beat.
3. As a player who downloaded a winning world, I want its card in my My Worlds library to wear the winner badge, so that I can find the champion among my local worlds.
4. As a player, I want the badge on my library card in both the grid and detailed layouts, so that my layout choice doesn't hide the honor.
5. As a player, I want the local world details modal to show the same badge, so that the library agrees with itself.
6. As a player who downloaded a world before its contest was decided, I want the badge to appear on my copy once the winner is announced, so that the honor doesn't depend on when I downloaded.
7. As a player who edited my downloaded copy of a winner, I want the copy to keep its badge, so that my local tweaks don't erase where it came from.
8. As a player with several copies of the same winning listing, I want every copy badged, so that no copy silently pretends to be an ordinary world.
9. As a player offline, I want badge-less worlds rather than errors, so that the library works exactly as before when the community server is unreachable.
10. As an author whose world wins a contest, I want the copy I published from to carry the badge in my own library, so that the win is visible where I actually work.
11. As an author, I want publishing a world (new or overwriting my listing) to link my local world to its listing, so that future wins reach my copy without re-downloading my own work.
12. As an author, I want that publish-time link to behave like a real download link — my library copy recognized as a copy of the listing in the community browser — so that the app has one honest notion of "this local world is that listing".
13. As an author, I want my freshly published world to not be offered a phantom "update available", so that linking doesn't nag me about changes I just made.
14. As a player looking at a world that won more than one contest, I want every win shown, so that no title is silently dropped.
15. As a player, I want the badge treatment identical everywhere (icon, wording, tone), so that one glance reads the same in the browser, the modal, and my library.
16. As a player, I want the badge to reflect only real wins — the world the staff picked — so that entries that merely participated are never dressed as winners.

## Implementation Decisions

- **Derivation, not storage.** Winner status is computed at render from the contest archive (the
  events list with winners stamped on them) that the app already fetches on the main menu and in
  the community browser. No winner fields are written to local records, exports, or saves — no
  export-shape change.
- **Matching rule.** A community listing matches by its server id (as today). A local world matches
  when its community link id (`sourceId`) equals a contest's winning-world id. Every local copy
  with a matching link badges, edited (`dirty`) or not.
- **Multi-win.** The pure helper returns *all* contests a record won (newest first); every surface
  renders one badge line per win.
- **Pure seam.** All matching and ordering lives in the existing contests helper module beside
  `contestWonBy`; components only render what it returns. The community card's existing
  single-contest path may be re-expressed over the new helper.
- **Details modal.** The community browser passes its already-fetched contest list down to the
  details modal; the badge renders under the title, styled as on the card.
- **Local library.** The main menu already holds the contest archive (fetched for the
  event-acknowledge poster); the same data feeds the library cards and the local details modal.
  The grid layout uses the card's existing badge overlay slot; the detailed layout adds the badge
  line to the card shell.
- **Publish stamps the link.** Every successful publish — new listing and overwrite alike — writes
  the community link onto the local world: `sourceId` (the listing's server id) and
  `sourceUpdatedAt` (the listing's post-publish updated stamp, so the author's own card offers no
  phantom update). Local-only fields; the world's exported shape is untouched. The resulting
  coupling with the download machinery (browser download states, copies list, re-download
  overwrite guard) is deliberate and accepted.
- **Vocabulary.** "Winner — \<contest title\>" is the one term, everywhere; amber/trophy treatment
  as the community card renders today.

## Testing Decisions

- Tests assert external behavior only: what a surface shows for a given record + event list, never
  how the helper walks the data.
- **Pure helper**: unit tests beside the existing contests helper tests (multi-win ordering, the
  sourceId match, no-match, cancelled contests excluded).
- **Details modal**: the community browser's contest test harness — open the modal on a winning
  listing, expect the badge; on a non-winner, expect none.
- **Local library**: the main-menu/world-card harnesses — a metadata record whose link matches a
  decided contest badges in both layouts and in the local details modal; offline (empty archive)
  shows no badge.
- **Publish stamp**: the publish-modal contest test file — a successful publish (new and
  overwrite) stores the link fields; a refused publish stores nothing.
- **E2E**: extend the server-backed contest flow spec — after the winner is picked through the
  admin API, download the winning listing and assert the badge in the local library. Skips without
  a local server, like the rest of that spec.
- Each new guard is mutation-tested per the house test bar (bug reinstated, right test red,
  restore verified).

## Out of Scope

- In-game surfaces (game viewer, load dialog) — deliberately excluded.
- Back-linking worlds published before this ships; they stay unlinked until re-published or
  re-downloaded.
- Winner badges for characters or dictionaries (contests take worlds only today).
- Offline persistence of winner status.

## Further Notes

- The community browser's Contest tab winner band and the event banner/poster wording are
  unchanged; this spec only extends where the *per-world* badge appears.
- A world that wins a second contest years later starts badging everywhere automatically — that is
  the point of deriving live.
