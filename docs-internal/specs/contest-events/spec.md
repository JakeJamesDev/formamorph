# Spec — Server Events & Contest Section

Status: ready-for-agent
Assembled: 2026-08-20 (ticket 08; decisions from tickets 01–07)
Repos: **formamorph** (client) + **FormamorphServer** (server; deploys as a HANDOFF to FieryLion's live prod)

## Problem Statement

The Formamorph community has no way to run time-boxed happenings. There is no mechanism to
announce "a world-building contest runs until the 30th" that every player reliably sees, no way
for an author to enter a world into such a contest, no place where entries are gathered and
browsable, and no way for staff to pick and announce a winner. Staff can only post broadcasts by
hand, players can miss them entirely mid-session, and nothing connects an announcement to the
content it is about. Past community moments also leave no trace — once an announcement scrolls
by, the event never happened as far as the app is concerned.

## Solution

A generic **timed server events** layer with **contest** as its first fully-featured type and a
plain **announcement** type proving the generality.

Staff schedule an event (title, banner text, modal body, window, and for contests a rules text)
from a new admin Events tab. When the event starts, the server automatically posts a pinned
broadcast and every player sees a banner on the main menu and in Community Creations plus a
one-time acknowledge modal. For contests, the publish flow gains an "Enter into <contest>" opt-in:
entries are ordinary published worlds flagged with the contest, dual-listed in the normal catalog
and in a conditional **Contest tab** in Community Creations. When the window closes, entries lock,
staff pick a winner (guarded against self-picks and quarantined entries), the winner is
auto-announced and badged, and the contest tab persists as a browsable archive with the winner
pinned first. Multiple events may run at once, but at most one active contest — enforced by the
server.

## User Stories

1. As a player, I want a banner on the main menu while an event is running, so that I can't miss a live contest or announcement.
2. As a player, I want the same banner inside Community Creations, so that the event is visible where the content lives.
3. As a player, I want a one-time acknowledge modal when an event starts, so that I actively see the announcement instead of scrolling past it.
4. As a player, I want to dismiss the banner down to a small chip naming the contest, so that the event stays reachable without occupying my screen.
5. As a player, I want clicking the banner or chip to open the contest section, so that I can get from the announcement to the entries in one step.
6. As a player, I want a Contest tab in Community Creations while a contest is active, so that I can browse all entries in one place.
7. As a player, I want the contest tab to show the contest's title, dates, and rules, so that I understand what is being judged and until when.
8. As a player, I want entries listed in a fresh order on each visit while the contest runs, so that early entrants don't monopolize the top slots.
9. As a player, I want to like contest entries just as I like normal worlds, so that my appreciation counts.
10. As a player, I want an end-of-contest modal and broadcast, so that I know judging has begun.
11. As a player, I want the winner announced with a broadcast and pinned first in the contest tab with a badge, so that the outcome is celebrated and easy to find.
12. As a player, I want the winner's badge visible on its card in the normal catalog too, so that the honor travels with the world.
13. As a player, I want past contests to remain browsable as archives, so that community history isn't lost.
14. As a player, I want to switch between past contests from a selector in the contest tab once several archives exist, so that older contests stay reachable.
15. As a player, I want events I've acknowledged to stay acknowledged on this device even when signed out, so that I'm not re-shown the same modal every launch.
16. As a signed-out player, I want to see the banner and browse the contest tab, so that public happenings don't require an account.
17. As an author, I want an "Enter into <contest>" opt-in card in the publish flow while a contest is running, so that entering is a single switch at publish time.
18. As an author, I want the publish flow to warn me if I already have an entry, so that I don't waste a publish on a doomed request.
19. As an author, I want to keep editing my entry until the deadline, so that entering early doesn't freeze my work.
20. As an author, I want my entry locked against content edits after the deadline until judging ends, so that the contest is judged on what was submitted.
21. As an author, I want to withdraw my entry, so that I can leave a contest I no longer want to be part of.
22. As an author, I want my entry to appear in both the normal catalog and the contest tab, so that entering costs me no visibility.
23. As an author, I want the contest rules shown where I enter and where entries are browsed, so that I know what I'm agreeing to by entering.
24. As an author, I want deleting my world during judging to simply withdraw it, so that my content stays under my control.
25. As a staff member, I want an Events tab in the admin panel grouped by state (happening now / scheduled / past), so that I can see the event calendar at a glance.
26. As a staff member, I want to pick the winner from a gallery of entries, so that judging is a browsing task, not an id-typing task.
27. As a staff member, I want a preview of the winner broadcast before announcing, so that nothing goes out sight-unseen.
28. As a staff member, I want the server to refuse picking my own entry or a quarantined entry, so that obvious judging mistakes are impossible.
29. As a staff member, I want to enter contests myself, so that staff creators aren't excluded from a small community's events (no-self-pick is the guard).
30. As an admin, I want to create, edit, cancel, and delete events from one form serving both types, so that announcements and contests share one workflow.
31. As an admin, I want start/end/cancel/winner broadcasts auto-posted from templates, so that the announcement machinery runs itself.
32. As an admin, I want to polish an auto-posted broadcast afterward via the normal message edit, so that templated wording isn't final wording.
33. As an admin, I want the server to reject a second contest overlapping an active one, so that "one active contest" is guaranteed by construction.
34. As an admin, I want cancelling a contest to revert entries to plain catalog worlds and recall the announcements, so that a cancelled event leaves no debris.
35. As an admin, I want every event mutation and winner pick audit-logged, so that event operations have the same accountability as moderation.
36. As a moderator, I want to withdraw someone's entry with the withdraw route, so that entry moderation needs no new machinery.
37. As the server operator (FieryLion), I want schema changes to be additive with idempotent boot migrations, so that deploying is `git pull` + restart and old clients keep working.
38. As a user of the original (pre-events) client, I want the server additions to be invisible, so that my client keeps working untouched.
39. As a user of an old events-aware client, I want unknown future event types to degrade to announcement behavior, so that new server features never break my banner.

## Implementation Decisions

### Server — events layer

- One `events` table, nullable per-type columns (the `worlds` one-table-many-kinds precedent):
  id (uuid), type (`contest` | `announcement`), title, banner_text, body (modal), rules_text
  (nullable), starts_at, ends_at, cancelled_at (nullable), start_message_id / end_message_id /
  winner_message_id (nullable FKs → messages), winner_world_id (nullable FK → worlds, ON DELETE
  SET NULL), winner_name + winner_author_name (TEXT snapshots), created_by, created_at,
  updated_at. Indexes on type, starts_at, ends_at.
- **No status column.** Scheduled/active/ended derive from timestamps; `cancelled_at` is the only
  stateful stamp. Active = starts_at ≤ now < ends_at ∧ not cancelled. Events write ISO
  timestamps; every comparison goes through `datetime()` (the documented mixed-format trap).
- Read surface: `GET /api/events/active` (optionalAuth; all active events, every type; DTO carries
  the linked message ids) and `GET /api/events` (started incl. ended — the archive source;
  future-scheduled rows staff-only, viewer-dependent like quarantined worlds). Cancelled events
  drop out of both public lists.
- Write surface: create/edit/cancel/delete = **admin**; `PUT /:id/winner` = **any staff**. Cancel
  is its own route, distinct from DELETE. Hard DELETE only before start; started events can only
  be cancelled. After start `starts_at` is immutable (400); other fields editable; edits never
  re-fire broadcasts (wording fixes go through the message edit route). Overlap 409 on any
  non-cancelled contest window enforces one active contest at POST/PUT time.
- Transitions run via an hourly unref'd sweeper (quarantine-sweeper twin: boot run + interval +
  lazy check in front of the events read path). Start = post pinned auto-templated broadcast
  (`sender_as: 'team'`, sender = event creator), store its id. End = recall the pinned start
  message (every type); contest-only: post a scope-`new` dismissible end broadcast. Cancel =
  recall pinned + scope-`new` cancellation notice if started, nothing if never started. Winner =
  post winner broadcast, store its id. All broadcast text is auto-templated server-side; admins
  polish afterward.
- New audit actions (noun_verbed): `event_created`, `event_edited`, `event_cancelled`,
  `event_deleted`, `winner_picked`, `entry_withdrawn`. Recorded via the never-throwing audit
  helper.

### Server — contest entries

- Storage: nullable `contest_event_id` FK column on `worlds` (spoiler-column precedent), added by
  an idempotent boot migration + index. Entry happens at publish only, so a world belongs to at
  most one contest ever; withdraw history lives in the audit log, not schema.
- Entry: `contestEventId` rides **top-level in the publish body** (never inside contentData —
  keeps the world export shape untouched). Server refuses unless it equals the currently-active
  contest (makes the contest-swap race a clean 4xx). One per user: a second non-withdrawn entry
  **409s the whole publish** with a distinct code; withdrawn/deleted entries free the slot.
- Withdraw: `DELETE /api/worlds/:id/contest`, owner-or-canModerate (staff entry-moderation falls
  out free), doesn't touch `updated_at` (spoiler precedent), always audited (`entry_withdrawn`;
  self-withdraw → null target, the delete precedent). Withdrawing the picked winner: 409 — the
  record stands; deleting the world is the owner's escape hatch.
- Post-deadline lock (entered, ended, no winner yet, not cancelled): owner content update refused
  with a contest-lock code; staff canModerate bypasses. Spoiler, comments, likes, quarantine, and
  delete stay live; owner delete during judging = implicit withdraw. Lock lifts at winner pick or
  cancel.
- Winner pick validates: world exists, is an un-withdrawn entry of this event, not quarantined,
  and **not authored by the picker** (staff may enter; picker≠author is the guard). Pick stamps
  the name/author snapshots so the archive survives any later deletion.
- Cancel bulk-clears `contest_event_id` on all entries — no consumer ever needs a
  cancelled-event check.
- Eligibility edges: quarantined entries invisible in the showcase via the existing visibility
  predicate and unpickable; suspended users already can't perform non-GET requests; a deleted
  entry's flag dies with the row.

### Client — generic events layer

- An events service + polling hook: fetch `/api/events/active` every ~5 minutes plus on window
  focus, piggybacking a nudge of the unread message count (this is the app's first polling
  interval — gated on the community feature flag, callbacks held in refs, fails silent/hidden).
  Focus-driven reads sit behind a **60-second floor**: alt-tabbing is not news about an event.
- Banner: a card (title, dates, blurb) with **Dismiss | View Entries** actions, mounted as a
  shrink-0 row at the top of the main menu's flex column and a second instance in the Community
  Creations header (the two surfaces don't share a shell). Dismiss collapses it to a right-aligned
  chip naming the contest; clicking the chip opens the contest tab. Severity-token styling only;
  visible signed-out; hidden entirely once the event is no longer active.
- **Stacked, one card per running event** — contest first, then announcements by start time. Two
  events can run at once, and showing only the first hid whichever the server listed second. Each
  card dismisses to its own chip (the store is already keyed per event), so collapsing one leaves
  the rest standing. The chip carries a short status marker ("12d", "Ended", "Winner").
- The card **body is a click target**: a contest card opens the contest tab, an announcement card
  re-opens itself. Its buttons stop the click at themselves, so Dismiss never doubles as Open. An
  announcement's chip likewise re-expands the card it was collapsed from — it has nowhere to go.
- Acknowledge modal: poster-style dialog at start and end, closable only by explicit acknowledge.
  Acknowledged state is per-device localStorage keyed by event id + phase (works signed-out;
  intro/tutorial-seen precedent); when signed in, acknowledging also marks the linked broadcast
  read so the inbox badge agrees. A new device re-shows the modal — accepted.
- **The modal's event source is active events plus ended-and-in-judging contests**, the latter read
  from the contests feed (one request at launch, no new endpoint and no new poll). The end poster
  only ever reached sessions that happened to be polling at the deadline otherwise. Eligibility
  ends on a winner pick or a cancellation — that news travels by broadcast and badge, and a third
  winner-phase poster is out of scope. Announcements keep start-phase only.
- Forward compatibility: banner + modal render purely from generic fields, so an unknown future
  type degrades to announcement behavior; `type` only unlocks extras (contest tab, publish
  toggle).
- New surfaces get dev-router entries (drift-guarded), including a canned-fixture route for the
  acknowledge modal and banner.

### Client — contest tab

- Contest is **not** a catalog kind — it's a pre-filter *view* over the same catalog (the
  quarantined-view precedent): a widened local tab union, conditional trigger (needs an icon —
  tabs are icon-only on narrow widths), its own aria stub, kind-label guards, and its own filter
  slot rather than sharing the Worlds tab's persisted filters.
- Tab visible while a contest is active or archives exist. Layout: slim bar (title, dates, a
  Rules button opening a dialog) above the entry grid. No player-facing copy about shuffling.
- Entry order: shuffled per visit while live (likes visible); after the winner is picked, winner
  first (badged), then by likes. Archive state keeps the same layout, minus entry affordances.
- Once **more than one contest exists in total** the slim bar gains a selector (dropdown) switching
  which one is shown; the newest — the running one, when there is one — is the default. Counted
  against every contest rather than every *ended* one, so a lone archive stays reachable while a
  contest runs. One tab, no layout change.
- Judging phase order: entries stand **by likes** once the window closes, since a shuffle there
  would only obscure the standings. A picked winner is pinned in front of them.
- Once decided, a **won-by band** sits under the slim bar, read from the names the pick stamped
  onto the contest rather than from the grid — a winning world since deleted still won.

### Client — publish entry

- An opt-in card with a switch inside the publish modal, shown only while a contest is active and
  the payload is a world; hidden, never disabled, for other kinds/states. Shows the contest name
  and links the rules.
- The flag is publish-time intent, not content: an optional field on the publish payload set by
  the modal, sent top-level in the request body. State resets in the modal's open-effect (the
  modal lives for the app's lifetime) and survives the upload-gate accept-and-retry round trip.
- Preflight: if the user already entered, the card says so ("you already entered <name>") instead
  of arming the switch; the server 409 remains the backstop.
- **Withdraw** is offered on that already-entered card, beside the advice that names it, and on the
  author's own entry card in the contest tab. Both call the existing `DELETE /:id/contest` route
  behind one confirmation; the picked-winner 409 surfaces as its own explanatory toast rather than
  a generic failure. Author-only in the UI even though the server also allows moderators — leaving
  a contest is the author's call. Hidden once the contest is decided. On success the publish
  modal re-reads its listings and the browser corrects the catalog it holds, so both surfaces
  reflect it without a reload.

### Client — admin Events tab

- New Events tab in the admin panel, following the keep-mounted/fetch-on-active tab template.
  List grouped by derived state: a Happening Now card, then Scheduled, then Past.
- One create/edit form serves both types, with the type picker as a full-width two-column tab
  strip (Feedback-tab style). The broadcast composer is untouched — this resolved the dedupe
  question.
- Winner pick: gallery dialog — entry grid → auto-broadcast preview → announce. Own-entry and
  quarantined-entry cards are unpickable with the reason shown.
- Role gating shown by hiding, never disabling: staff (non-admin) see the tab read-only with only
  Pick Winner; create/edit/cancel/delete and canceled rows are admin-only. The tab is
  staff-visible (not admin-only) because winner pick belongs to any staff.
- Newly coined identifiers, state values and labels spell it **canceled** (American English). The
  API field `cancelledAt` keeps the server's own spelling — the documented external exception.

## Testing Decisions

- A good test asserts **external behavior at the highest existing seam** — what an HTTP caller or
  a rendered component observes — never internal call order or private state.
- **Server seam: supertest HTTP against the Express app with in-memory SQLite** via the existing
  test context helper (the established ~90-file pattern; importing models directly would create a
  second module graph and a second DB). Cover: schema migration idempotency (boot twice), derived
  event states across time boundaries, overlap 409, admin/staff/public auth matrix, transition
  side effects (pinned post at start, recall at end, contest end broadcast, cancel notice, winner
  broadcast), entry accept/refuse (inactive contest, second entry 409), withdraw semantics and
  audit rows, post-deadline lock matrix (owner blocked, staff bypass, spoiler/like/comment/delete
  live), winner guards (self-pick, quarantined, withdrawn), snapshot survival after world delete,
  cancel bulk-clear, and old-client invisibility (publish without the field, catalog shape
  unchanged).
- **Client seam: Vitest + RTL component tests with service-layer mocks** (the real-providers
  panel-harness style). Cover: banner render/dismiss-to-chip/chip-opens-tab, ack modal
  acknowledge persistence + markRead when authed, contest tab states (live shuffle presence,
  winner pinned, archive, selector with multiple archives), publish card visibility matrix +
  already-entered preflight + state reset on reopen, admin tab grouping + role-gated rendering +
  winner dialog guards. Polling hook tested for ref-held callbacks and flag gating.
- **Drift guards**: every new view/modal/tab lands in the dev-router ledger; the existing
  lockstep tests enforce it.
- **Playwright E2E** (in the existing suite, outside the four gates): one flow — publish a world
  with the entry switch on, see it in the contest tab. Requires a local server instance; skip
  when unavailable. The flow registers its own account and pins the requests it depends on, so a
  shared dev database cannot make it flake. Withdraw is deliberately **not** E2E'd — the component
  seam plus the server's own route tests cover it.
- One shared `ServerEvent` fixture module under `src/test/` backs every events/contest test file:
  the builder, the day/offset helpers and the `matchMedia` stub. Adding a field to the DTO is one
  edit, not a sweep.
- Prior art: the server's existing route-level supertest suites; the client's panel-harness
  component tests and dev-router drift tests; the existing E2E suite's two-viewport setup.

## Out of Scope

- Voting or community-judged winners — staff pick only.
- Entering already-published worlds — entry happens at publish time only.
- Steam Workshop interplay.
- Prizes/rewards beyond the winner badge + announcement.
- Acceptance records for rules (shown, not gated) — no per-user agreement rows in v1.
- Websockets/SSE — polling only, matching the server.
- Entity/dictionary contests — v1 contests are worlds-only (the publish card hides for other
  kinds; the server contract doesn't preclude widening later).

## HANDOFF (FieryLion) — confirmed 2026-08-20

- **Compatibility:** fully additive. New `events` table created in the standard table-creation
  path; `contest_event_id` added to `worlds` by an idempotent boot migration (quarantine-columns
  pattern). No existing column, route, or response shape changes. The deployed original client
  never sends the new field and never sees a behavioral difference; events surface only to
  clients that ask for them.
- **Deploy:** the established flow — fork → handoff → FieryLion deploys (`git pull` + restart;
  boot self-migrates). The handoff document accompanying the server changes must include
  Deploying / Rollback / What-to-look-at-first sections per the repo's existing handoff artifact.
- **Rollback:** rolling back the code alone is safe (the extra table/column are inert to old
  code); full rollback = restore the pre-deploy backup via the existing backup/restore scripts.
- **Roles:** no new roles. Winner pick = any staff (mod/dev/admin); event create/edit/cancel/
  delete = admin. Their staff's existing roles map directly.
- **Ops notes:** the sweeper is a second unref'd hourly interval alongside the quarantine
  sweeper; transitions also fire lazily on the events read path, so a missed tick never serves a
  stale state. Timestamps written ISO, compared through `datetime()`.

## Further Notes

- Decision provenance: tickets 01–07 under `issues/`; grounding research under `research/`
  (server capability map + client surfaces, both scouted 2026-08-20 — file/line references live
  there, deliberately not here).
- UI fidelity: interactive mocks for the player surfaces and admin surfaces are linked from
  tickets 05/06 (`assets/`); the picked variants are the defaults in each mock.
- The client banner poll is the app's first interval — the events service is the natural future
  home for any other "server pushes nothing" freshness needs (e.g. mid-session unread nudge,
  which it already piggybacks).
- Implementation tickets: 09–16 under `issues/`, each `ready-for-agent`, ordered by dependency
  (server 09→10→11, client 12→13/14/15, E2E 16 last).
