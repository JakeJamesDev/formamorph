# Wayfinder map: Server Events & Contest Section

Status: ready-for-agent

Label: wayfinder:map

## Destination

A build-ready spec in `.scratch/contest-events/spec.md` plus sliced implementation tickets — covering the generic server-events layer (server + client), contest entry publishing, the Community Creations contest tab, and the admin surface — every design decision made, ready for build sessions on both repos (formamorph + FormamorphServer).

## Notes

- Two repos: this client and `D:\Documents\GitHub\FormamorphServer` (Express + better-sqlite3, MIT). Server changes deploy as a **handoff to FieryLion's live prod** (`workshop.fierylion.com/api`) — spec must include a HANDOFF section (compatibility, rollback), schema changes must be additive, boot-time idempotent migrations (`src/utils/add*.js` pattern).
- Server capability map (scout report, 2026-08-20): pinned broadcasts = existing undismissable message; `spoiler` column + endpoint = precedent for server-side world flags; quarantine sweeper (unref'd interval + lazy read-path check) = template for timed transitions; timestamps are mixed-format — write ISO, compare via `datetime()`. No websockets: polling only.
- Skills per ticket type: grilling tickets → /grilling + /domain-modeling (AskUserQuestion delivery); prototype tickets → /prototype; research → /research subagent.
- Glossary lives in `CONTEXT.md` at repo root (create lazily as terms crystallize).

## Decisions so far

- [Charting interview](issues/01-charting-interview.md) — destination = build-ready spec; typed events with contest first + announcement type proving generality; banner + acknowledge modal on main menu & CC; entries are flagged publishes, dual-listed, one per user, editable until deadline then locked until winner; rules shown not gated; staff pick winner → auto-broadcast + badge; showcase shuffled per visit, lives as an event tab in CC, persists as archive; in-app admin UI; multi-event with at most one active contest.
- [Client surfaces research](issues/02-client-surfaces-research.md) — findings in [research/client-surfaces.md](research/client-surfaces.md): contest flag rides top-level in the publish body (not contentData); Contest tab must NOT be a fourth CatalogKind (model on the quarantinedOnly pre-filter view); no message polling exists (unread fetched once per auth change); banner mounts as a shrink-0 MainMenu row; admin tab follows BroadcastsTab; hide-never-disable throughout.
- [Events API contract](issues/03-events-api-contract.md) — one `events` table with nullable per-type columns; state derived from timestamps + `cancelled_at` (no status enum); `GET /api/events/active` + public started-events list (scheduled = staff-only); CRUD admin, winner pick any staff; hourly sweeper twin + lazy check; start = pinned auto-templated broadcast, end = recall + contest-only end broadcast, cancel = recall + notice; overlap 409 enforces one active contest; unknown types degrade to announcement behavior on old clients; acknowledge = localStorage + markRead when authed; client polls /active ~5 min.
- [Entry mechanics](issues/04-entry-mechanics.md) — `contest_event_id` column on worlds (`addContestColumn.js`); explicit id in the publish body, second entry 409s the whole publish; withdraw = `DELETE /:id/contest` (owner-or-canModerate, always audited as `entry_withdrawn`); lock = owner content-update only, staff bypass, everything else stays live, owner delete = implicit withdraw; winner pick refuses quarantined + picker-authored worlds, stamps `winner_name`/`winner_author_name` snapshot, FK ON DELETE SET NULL; cancel bulk-clears entry flags; staff may enter (no-self-pick is the guard); new ACTIONS: event_created/edited/cancelled/deleted, winner_picked, entry_withdrawn.

- [Player UI prototype](issues/05-player-ui-prototype.md) — banner = card (B) with Dismiss | View Entries, dismissing collapses it to a chip naming the contest that opens the contest tab; contest tab = slim bar + rules dialog (C), no player-facing shuffle copy; publish = opt-in card with switch (B); ack modal = poster dialog (B). Mock: [assets/05-player-ui-prototype.html](assets/05-player-ui-prototype.html).
- [Admin UI prototype](issues/06-admin-ui-prototype.md) — events tab = grouped by state (B); create form = one event form for both types (A) with the type picker as a Feedback-style full-width sub-tab strip — resolves the fog item, broadcast composer untouched; winner pick = gallery dialog (A) with the auto-broadcast preview before announcing. Staff (non-admin) sees the tab read-only with only Pick Winner, per contract 03. Mock: [assets/06-admin-ui-prototype.html](assets/06-admin-ui-prototype.html).
- [FieryLion coordination](issues/07-fierylion-coordination.md) — heads-up done, confirmed 2026-08-20: additive schema + boot migrations accepted; established fork→handoff→deploy flow; backup-restore rollback; no new roles needed.
- [Spec assembled](issues/08-assemble-spec.md) — [spec.md](spec.md) written; archive browsing = selector dropdown in the slim bar once >1 archive exists; test seams = existing HTTP/component seams + one Playwright E2E flow; build tickets 09–16 sliced, all `ready-for-agent`.

- [Server entry mechanics](issues/11-server-entry-mechanics.md) — entry column + migration, top-level
  `contestEventId` at publish (`CONTEST_NOT_ACTIVE` / `CONTEST_ALREADY_ENTERED`), withdraw route, the
  judging lock (`CONTEST_LOCKED`), and the staff winner pick with its snapshot. Second pick refused, no
  un-pick route. Server lane 09–11 complete; the events HANDOFF write-up is still owed.

- [Review fixes](issues/17-review-fixes.md) — 2026-08-21 two-axis review of the client build
  (36aae90..a34b558): end poster reachable during judging, Withdraw on preflight card + own entry
  card, stacked banners, spelling/fixture/predicate cleanups, spec amended to document kept
  behaviors. `ready-for-agent`.

- [Review polish fixes](issues/19-review-polish-fixes.md) — 2026-08-21. Server: one
  `createImageAssetRouter` factory behind the avatar and event-poster routes, one
  `saveImageAsset`/`deleteImageAsset` pair behind the four per-kind wrappers, and the hex validator now
  takes 3-digit shorthand and stores it expanded (the round's only behavior change). Client: shared
  `IMAGE_UPLOAD_ACCEPT`, `avatarSrc` inlined to `serverAssetSrc` (its URL tests moved to
  `serverAssets.test.ts`), the redundant `ServerEvent` union member dropped, two comments fixed.
  Review of the dedup found the allowlist lookup reaching `Object.prototype` — a subtype of
  `constructor` passed as an allowed type and wrote a garbage-named file; closed with a null-prototype
  lookup and a regression test. `saveThumbnail` keeps its own copy of that hole (out of scope).
  Deliberately-rejected review findings are recorded in the ticket's Further Notes. Done.

- [Banner click + chip row](issues/20-banner-click-and-chip-row.md) — 2026-08-21 grilling of two
  player reports: in-browser View Entries dies after first use (MainMenu state already set, apply
  effect never refires) → the browser sets its own tab; the dismissed chip's dedicated row is
  deleted on both surfaces, all chips folding into the existing top bars (menu center cell /
  browser header toolbar), same on mobile. `ready-for-agent`.

## Map closed 2026-08-20

Destination reached: [spec.md](spec.md) + tickets 09–16. Build sessions take tickets in dependency
order (server 09→10→11 in FormamorphServer; client 12→13/14/15; E2E 16 last).

## Out of scope

- Voting/community-judged winners — staff pick chosen for this effort.
- Entering already-published worlds into a contest — entry happens at publish time only (charting decision).
- Steam Workshop interplay — Steam sharing is a separate lane entirely.
- Prizes/rewards beyond the winner badge + announcement.
