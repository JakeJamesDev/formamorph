# 04 — Contest entry storage & lock semantics

Type: grilling
Status: done
Blocked by: 03

## Question

Lock how entries are stored and enforced server-side:

- Storage: `contest_event_id` column on `worlds` (spoiler-column precedent, `addContestColumn.js` migration) vs a `contest_entries` join table (cleaner history across multiple contests, supports withdraw records). Recommend deciding with the archive story in mind.
- Entry endpoint: rides `POST /api/worlds` payload vs a separate `PUT /api/worlds/:id/contest` (spoiler-endpoint precedent) called by the publish flow.
- One-per-user enforcement: refuse vs replace; withdraw flow and whether withdrawing after the deadline is allowed.
- Post-deadline lock: exactly which mutations are refused (content update yes; spoiler toggle? delete? comment?) and how the lock lifts (winner picked).
- Winner storage (field on events vs entries) and the auto-broadcast wording/mechanics.
- Eligibility edges: staff entering their own contest; quarantined entries; entries deleted mid-contest.
- New `AuditLog.ACTIONS` entries for event create/edit, winner pick, entry moderation.

## Answer

Three grilling rounds (12 questions), 2026-08-20. Scout facts that shaped it: `AuditLog.ACTIONS` uses noun_verbed naming and `tryRecord` never throws; spoiler toggle is owner-or-`canModerate`, skips `updated_at`, never audits; world DELETE audits **always** (self-delete → `targetUser: null`); quarantine expiry **hard-deletes** row + files; `db.pragma('foreign_keys = ON')` means a default FK would make the winning world undeletable; `World.create` inserts a fixed column list (new field = validator + destructure + create + INSERT).

### Storage — column on worlds

`contest_event_id` NULL FK→events on `worlds`, via idempotent `addContestColumn.js` (quarantine-columns pattern) + index. Entry happens at publish only, so a world belongs to at most one contest ever — the join table's advantages can't occur. Entry date ≈ `created_at`; row deletion self-cleans. Withdraw history lives in audit_log, not schema.

### Entry — explicit id in the publish body, 409 backstop

- `contestEventId` rides `POST /api/worlds` top-level (per ticket 02). Server refuses unless it equals the **currently-active** contest — the explicit id makes the contest-swap race a clean 4xx instead of a silent wrong entry.
- One per user: a second non-withdrawn entry **rejects the whole publish (409)** with a distinct code; the client toggle preflights ("you already entered <name>"). Withdrawn/deleted entries free the slot (re-entry requires a new publish by construction).
- Touch points: route validator array, controller destructure, `World.create` object + fixed INSERT column list.

### Withdraw — `DELETE /api/worlds/:id/contest`

- Withdraw-only route (no dead `entered: true` half); owner-or-`canModerate` — staff entry-moderation falls out free. Doesn't touch `updated_at` (spoiler precedent).
- Audit **always**: `entry_withdrawn`, self-withdraw → `targetUser: null` (delete precedent, compensates for schema keeping no withdraw records).
- Withdrawing the picked winner: **409** — the record stands; deleting the world is the owner's escape hatch.

### Post-deadline lock (entered worlds, `ends_at` ≤ now, no winner yet, not cancelled)

- Refused: **owner content update** (`PUT /:id`) with a contest-lock error code. Staff `canModerate` **bypasses** (moderation always wins; audit is the accountability).
- Stays live: spoiler toggle, comments, likes (they drive the post-winner sort), quarantine, delete. Owner delete during judging = implicit withdraw — their world, their right.
- Lock lifts at winner pick or cancel.

### Winner — snapshot + SET NULL

- `PUT /api/events/:id/winner` (any staff, per 03) validates: world exists, is an un-withdrawn entry of this event, **not quarantined** (release first), and **not authored by the picker** — staff may enter contests (settled here), so the one server check that kills self-judging optics is the picker≠author rule.
- Pick stamps `winner_name` + `winner_author_name` TEXT snapshot columns on `events`; `winner_world_id` FK is **ON DELETE SET NULL**. Archive survives owner delete, staff delete, and quarantine-expiry hard-delete; the showcase card just loses its live entry.
- Winner broadcast (mechanics per 03): scope-'new' dismissible, auto-templated from event title + snapshot name/author, `winner_message_id` stored, admins polish via message edit.

### Cancel — bulk-clear

Cancel runs `UPDATE worlds SET contest_event_id = NULL WHERE contest_event_id = ?` — entries revert to plain catalog worlds; no consumer ever needs a cancelled-event check. No un-cancel route exists, so nothing is lost.

### Eligibility edges

- **Staff**: may enter (small community, staff are creators); guarded by no-self-pick, not by entry refusal.
- **Quarantined entries**: invisible in showcase via the existing `isVisibleTo`/SQL predicate (nothing new); can't be picked winner; expiry hard-delete self-cleans the entry.
- **Deleted mid-contest**: column dies with the row — nothing to do.
- **Suspended users**: non-GET already refused globally — can't enter or withdraw; existing entry stands.

### New `AuditLog.ACTIONS` (noun_verbed convention)

`event_created`, `event_edited`, `event_cancelled`, `event_deleted`, `winner_picked`, `entry_withdrawn`.
