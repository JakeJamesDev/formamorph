# Contest Archive at Scale

Status: ready-for-agent

## Problem Statement

Nothing about the contest system forgets. Every contest that ever started rides the events list
forever, with its full poster body and rules prose aboard (~80% of the bytes), and the client
refetches that whole list on every open of the Community Creations browser. The archive dropdown is
one flat, unlabeled list of titles; the admin Events tab renders every finished event as a full
card. At the expected monthly cadence this is ~25 contests after two years and ~60 after five —
a 150–240 KB payload per browser open, a dropdown twice its own viewport with no structure, and an
admin "over" section that scrolls forever. None of it is broken today; all of it degrades on a
schedule.

## Solution

The archive stays permanent and fully reachable — history is the record — but gets cheap and tidy.
The server learns to serve the list slim (prose stripped) with a detail read for the two surfaces
that actually show prose; the client shares one in-memory fetch between the main menu and the
browser instead of refetching per open; the archive dropdown grows a pinned "Running" section and
year sections below it; and the admin tab's finished events fold to the newest handful behind a
"Show older" expander. Winner badges are exempt from all of it: whatever the list is trimmed to,
every decided winner always rides it, so a badge earned years ago never disappears.

## User Stories

1. As a player, I want opening Community Creations to stay fast after years of contests, so that the archive's growth never costs me anything.
2. As a player, I want the archive dropdown grouped by year, so that sixty contests read as a calendar rather than a wall of titles.
3. As a player, I want the running contest pinned in its own section at the top of the dropdown, so that the live one is never mistaken for an archive.
4. As a player, I want a contest that is being judged to sit in that same top section, so that "still undecided" reads differently from "history".
5. As a player, I want every past contest still reachable from the dropdown, so that no part of the record is deleted from view.
6. As a player, I want keyboard type-ahead in the dropdown to keep finding contests by title, so that grouping costs me nothing I had before.
7. As a player, I want the end-of-contest poster to still show the organizer's full text, so that trimming the list never trims what I'm shown.
8. As a player, I want the Rules dialog to still show the full rules on demand, so that the slim list is invisible to me.
9. As a player, I want winner badges to keep appearing for wins from any year, so that the payload work never erodes the honor system.
10. As a player, I want reopening the browser several times in one session to reuse what was already fetched, so that I'm not re-downloading the same archive five times.
11. As a player, I want that reuse to still pick up fresh data in the background, so that a winner announced mid-session reaches me without a restart.
12. As a player on an older community server, I want everything to work exactly as it does today, so that the app never depends on a server upgrade.
13. As a player offline, I want the same behavior as before — no archive, no badges, no errors — so that this changes nothing about the offline stance.
14. As an admin, I want the Events tab's finished events folded to the newest handful, so that the section I check after a contest ends isn't buried under years of cards.
15. As an admin, I want one "Show older" action to reveal the rest, so that the full record is two clicks away, never gone.
16. As an admin, I want the edit form to keep opening instantly with the event's full text, so that managing events costs nothing new.
17. As an admin, I want saving, canceling, or picking a winner to refresh what players' surfaces show in-session, so that my change doesn't wait for their restart.
18. As a server operator, I want the slim behavior to be opt-in by query parameter, so that deploying it breaks no existing client.

## Implementation Decisions

- **Design horizon.** Monthly cadence — ~60 contests at year five. Bound the interface, not the
  data: every event that ever started stays served and reachable.
- **Slim list (server).** The events list endpoint takes an opt-in query parameter that strips the
  two prose fields (poster body, rules text) from every row; all other fields ride as today. Slim
  rows are ~600 B, so sixty of them are ~36 KB — an unbounded list that stays cheap for a decade.
  No paging and no separate winners feed; slim rows make both unnecessary, and paging remains
  available as a future additive step. The parameter is ignored by older servers, which return the
  full rows — a superset of the same shape — so client compatibility is free.
- **Detail read (server).** A new public single-event endpoint returns one full row. Exactly two
  client surfaces read prose: the end-of-contest acknowledge poster (fires for at most a judging
  contest or two per launch) and the contest Rules dialog (fires on button press). Both fetch the
  detail on demand.
- **Prose-need detection (client).** A row whose prose field is absent needs the detail fetch; a
  row that carries it (an old server ignored the slim parameter) never triggers one. Detection is
  by field absence, not server version.
- **Shared events cache (client).** One in-memory, session-lifetime cache behind the contests
  hook: the main menu's launch fetch seeds it, browser opens reuse it and revalidate in the
  background. Admin event mutations — create, edit, cancel, winner pick — invalidate it, following
  the existing precedent of refreshing the events poll after admin saves. Deliberately never
  persisted: offline behavior (empty archive, no badges) is a stance the winner-badge spec set,
  and this spec does not reopen it.
- **Dropdown grouping.** The archive selector gains a pinned top section holding the running
  contest (and any judging one), then one labeled section per year, newest year first, newest
  contest first within each. Grouping is derived from each contest's start date by a pure helper
  beside the existing contest helpers; the select component renders what the helper returns.
  Type-ahead behavior is unchanged.
- **Admin "over" section.** The finished-events group shows the newest ~10 cards with a single
  expander revealing the rest. The admin tab keeps its full (non-slim) fetch: it is staff-only,
  already refetches per visit, and the edit form opening with no loading state is worth more than
  bytes no player pays.
- **Badge exemption.** Winner-badge derivation reads the same (slim) list and is never capped,
  filtered by age, or paged — every decided winner is always present in what the client holds.

## Testing Decisions

- Tests assert external behavior only: what a surface shows for a given event list, what a request
  carries, never how a helper walks the data.
- **Pure helper**: unit tests beside the existing contests helper tests — year grouping order,
  running/judging pinned to the top section, empty-archive and single-contest cases.
- **Service**: the storage-service test pattern — the list request carries the slim parameter; the
  detail endpoint is fetched when a row lacks prose and never when it carries it (old-server
  fallback); the detail response is what the caller receives.
- **Dropdown**: the community browser's contest test harness — section labels render, the running
  contest sits in the top section, an archived one sits under its year, selection still works.
- **Poster and Rules dialog**: their existing component harnesses — given a slim row, each shows
  the detail-fetched prose; given a full row, no detail request is made.
- **Cache**: reopening the browser does not refetch eagerly; an admin mutation invalidates so the
  next read is fresh — asserted at the hook/service seam, not by counting renders.
- **Admin tab**: the existing Events tab harness — over-section shows the newest N, the expander
  reveals the rest, both role views unaffected.
- Each new guard is mutation-tested per the house test bar (bug reinstated, right test red,
  restore verified).

## Out of Scope

- Persisting events to localStorage/IndexedDB — it would make badges appear offline, reversing a
  deliberate scope cut in the winner-badge spec; a product decision, not a cache tweak.
- Paging the events list or a separate winners feed — future additive steps if slim rows ever
  stop being enough.
- Slimming the admin tab's fetch — staff-only surface, kept full deliberately.
- Search/filter inside the archive dropdown — type-ahead plus year sections carry sixty entries
  fine.
- Any retention or deletion of old events — the archive is permanent by decision.

## Further Notes

- The server half (slim parameter, detail endpoint) needs coordination with the FormamorphServer
  owner before it ships; it is additive and deployable independently of the client.
- The client half (grouping, shared cache, admin expander) works against today's servers as-is —
  the slim parameter is simply ignored and the detail fetch never fires. The two halves can land
  in either order.
- Payload facts behind the decisions: prose is ~75–85% of a full row; a typical contest row is
  2.5–4 KB full vs ~600 B slim; the poster image is a URL, never inline bytes.
