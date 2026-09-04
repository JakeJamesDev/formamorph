# 03 — Events schema & API contract

Type: grilling
Status: done
Blocked by: 02

## Question

Lock the generic events layer contract:

- `events` table columns (id, type, title, start/end, banner text, modal body, rules text, status?, winner ref?, created_by, timestamps — what exactly; which are per-type vs generic).
- Endpoint surface: `GET /api/events/active` shape (array; client filters by known types), staff/admin CRUD routes, and what "active" means (started, not ended, vs a status column).
- How start/end transitions run: sweeper twin of `sweepQuarantine` + lazy check — what each transition does (post pinned start broadcast, recall/soften it at end, post end broadcast).
- Timestamp convention (write ISO, compare via `datetime()`), and enforcement of "at most one active contest".
- Client behavior for unknown event types (forward compatibility for old clients).
- Acknowledge semantics: does the start modal's acknowledge = the broadcast's message_states read/dismiss, or separate client-local state?

## Answer

Three grilling rounds, 2026-08-20. Settled convention (not asked): events **write ISO timestamps; every comparison goes through `datetime()`** — the documented server trap.

### Schema — one table, nullable per-type columns

`events`: `id` (uuid PK), `type` ('contest'|'announcement'), `title`, `banner_text`, `body` (modal), `rules_text` NULL, `starts_at`, `ends_at`, `cancelled_at` NULL, `start_message_id` NULL FK→messages, `end_message_id` NULL FK, `winner_world_id` NULL FK→worlds (contest-only), `winner_message_id` NULL FK (contest-only), `created_by` FK→users, `created_at`, `updated_at`. Matches the `worlds` precedent (one table, kinds, nullable quarantine columns); future types add columns via idempotent `add*.js` scripts.

**No status column.** Scheduled/active/ended derive from timestamps via `datetime()`; `cancelled_at` is the only stateful stamp. Active = `starts_at ≤ now < ends_at` ∧ not cancelled. The sweeper fires transitions; it doesn't own state.

### Read surface

- `GET /api/events/active` — optionalAuth, public. Array of all currently-active events, every type; client filters what it understands. DTO carries `startMessageId` (and `endMessageId` once ended) so the client can `markRead`.
- `GET /api/events` — optionalAuth, public. Started events including ended (the contest-archive source). Future-scheduled rows visible only to staff (viewer-dependent, like quarantined worlds). Cancelled events drop out of both public lists.

### Write surface

- `POST /api/events`, `PUT /:id`, cancel, `DELETE /:id` — **admin**.
- `PUT /:id/winner` — **any staff** (honors "staff pick"; the broadcast is posted by the system, not the picker).
- **Live edits:** after start, `starts_at` is immutable (400); everything else (`ends_at`, banner, body, rules) editable, overlap check re-run on `ends_at` changes. Edits never re-fire broadcasts — wording changes reach players via the existing message-edit route (renotify optional).
- **Delete:** hard DELETE only while `starts_at` is in the future; started events can only be cancelled. No orphaned message ids or entry refs.
- **One active contest:** POST/PUT reject (409) a type-'contest' event whose `[starts_at, ends_at)` overlaps any other non-cancelled contest — invariant guaranteed by construction, nothing policed at runtime.

### Transitions (sweeper twin: hourly unref'd interval + boot run + lazy check in front of the events read path)

| Transition | Actions |
|---|---|
| **Start** | Post pinned broadcast (auto-templated from title/banner/body; `sender_as: 'team'`, `sender_id` = event creator); store `start_message_id` |
| **End** | Recall the pinned start message (generic, every type — banner/pin never outlive the window); **contest-only**: post scope-'new' dismissible end broadcast + end modal |
| **Cancel** | If started: recall pinned + auto-post scope-'new' cancellation notice. If never started: nothing was announced, nothing posted |
| **Winner** | Post winner broadcast; store `winner_message_id` (entry-side effects → ticket 04) |

Broadcast text is auto-templated server-side (no new form fields); admins polish the sent message afterward via the existing edit route. `Message.update` accepting `scope` and `recall` were both verified in `src/models/Message.js`.

### Forward compatibility

Banner + acknowledge modal render purely from generic fields — an unknown future type degrades gracefully to announcement behavior on old clients. `type` only unlocks extras (contest tab, publish toggle).

### Acknowledge

Per-device localStorage keyed by event id + phase (works signed-out; matches intro/tutorial seen-state). When signed in, acknowledging additionally calls `markRead` on the linked broadcast so the inbox badge agrees. New device re-shows the modal — accepted.

### Timing

Server: hourly sweeper, exact `sweepQuarantine` twin. Client: poll `/active` ~5 min + refetch on window focus, piggybacking the unread-count refetch; interval gated on `COMMUNITY_ENABLED`, callbacks held in refs (the MessagesTab incident). Transitions land within ~5 min of deadline whenever anyone is online.

### Spec details flowing from these (not decisions)

- Cancel as its own route (e.g. `POST /:id/cancel`), distinct from DELETE.
- New `AuditLog.ACTIONS`: event create/edit/cancel/delete/winner.
- Indexes: `events(type)`, `events(starts_at)`, `events(ends_at)`.
