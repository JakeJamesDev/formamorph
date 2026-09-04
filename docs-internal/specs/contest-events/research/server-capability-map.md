# FormamorphServer capability map (scouted 2026-08-20)

Repo: `D:\Documents\GitHub\FormamorphServer` (Node 18+, Express 4, better-sqlite3 12, CommonJS). Entry `src/server.js` → `src/app.js`. Prod: `https://workshop.fierylion.com/api`. Default port 8797.

## 1. Database schema

All DDL in `src/utils/initDb.js` (`createTables` / `createIndexes`). No schema.sql, no migration framework — column additions are one-off idempotent scripts in `src/utils/add*.js`, run in order at boot by `server.js`.

| Table | Columns |
|---|---|
| `users` | `id` PK (uuid), `username` UNIQUE, `password` (bcrypt), `email`, `status` ('normal'\|'flagged'\|'suspended'), `account_type` ('normal'\|'mod'\|'dev'\|'admin'), `avatar_file`, `avatar_updated_at`, `feed_seen_at`, `token_version` INT default 0, `created_at`, `updated_at` |
| `worlds` | `id` PK, `name`, `description` NOT NULL, `author_id` FK→users, `thumbnail_file` NOT NULL, `preview_data` NOT NULL, `content_file` NOT NULL, `downloads` INT, `comment_count` INT, `tags` (JSON text array), `spoiler` INT 0/1, `kind` NOT NULL default 'world' ('world'\|'entity'\|'dictionary'), `quarantined_at`, `quarantine_expires_at`, `quarantine_extended` INT, `created_at`, `updated_at` |
| `comments` | `id` PK, `content`, `world_id` FK CASCADE, `author_id` FK, `created_at`, `updated_at` |
| `messages` | `id` PK, `sender_id` FK SET NULL, `sender_as` ('team'\|'username'), `recipient_id` FK CASCADE (NULL ⇒ broadcast), `subject`, `body`, `severity` ('info'\|'warning'\|'urgent'), `scope` ('existing'\|'new'\|'pinned'), `recalled_at`, `edited_at`, `created_at` |
| `message_states` | PK(`message_id`,`user_id`), `read_at`, `dismissed_at` |
| `policies` | `id` PK (only `upload_gate`, `tag_notice`), `enabled` INT, `title`, `body`, `tags` JSON, `acceptance_version` INT, `updated_at` |
| `policy_acceptances` | PK(`policy_id`,`user_id`), `accepted_version`, `accepted_at`, `response` ('accepted'\|'declined') |
| `feedback` | `id` PK, `type` ('bug'\|'suggestion'), `reporter_id` FK SET NULL, `reporter_role`, `title`, `category`, `body`, `status`, `diagnostics` JSON, `locked_at`, `edited_at`, `created_at`, `updated_at` + CHECK coupling status/category to type |
| `feedback_comments` | `id` PK, `feedback_id` FK CASCADE, `author_id` FK SET NULL, `body`, `created_at`, `edited_at`, `author_role` |
| `feedback_reads` | PK(`feedback_id`,`user_id`), `last_seen_at` |
| `feedback_votes` | PK(`feedback_id`,`user_id`), `created_at` |
| `world_likes` | PK(`world_id`,`user_id`), `created_at` |
| `follows` | PK(`follower_id`,`followed_id`), `created_at` (load-bearing: feed window) |
| `audit_log` | `id` INTEGER PK, `action`, `actor_id`, `actor_username`, `actor_was_admin`, `actor_role`, `target_user_id`, `target_username`, `target_kind`, `target_name`, `snippet`, `created_at`. Append-only |

Indexes: worlds(name/author/tags/kind/quarantine_expires_at), world_likes both directions, follows both directions, comments(world/author), messages(recipient,created_at)(recalled), message_states(user), policy_acceptances(user), feedback(reporter,created_at)(type,status), feedback_comments(thread), feedback_reads(user), feedback_votes(thread), audit_log(action,id).

**Timestamp trap:** `worlds`/`users`/`messages` mix SQLite `CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`) and ISO-with-ms strings in the same column. Every comparison goes through `datetime()` or `strftime('%Y-%m-%dT%H:%M:%fZ', …)` (see `src/models/Follow.js` `AS_INSTANT`, `src/models/Message.js` `VISIBLE_WHERE`). Any contest start/end window must do the same, or write ISO consistently.

## 2. Route list

Mounted in `src/app.js`. Auth: **public**, **user** (`protect`), **user+** (`protectAllowSuspended`), **optional** (`optionalAuth`), **staff** (mod/dev/admin), **admin**.

### `/api/auth` (`src/routes/auth.js`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | public (20/15min) | Create account, return JWT |
| POST | `/login` | public (20/15min) | Sign in (suspended may sign in, read-only) |
| GET | `/me` | user | Current account DTO |
| POST | `/change-password` | user (20/15min) | Change password; bumps `token_version` |

### `/api/worlds` (`src/routes/worlds.js`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | optional | Catalog: `page,limit,search,tags,searchByAuthor,sort,order,kind`; sweeps quarantine first |
| GET | `/:id` | optional | One listing (+`includeComments`) |
| GET | `/:id/content` | optional | Download content; increments `downloads` |
| POST | `/` | user + upload-gate | Publish (200MB cap; per-kind size rules) |
| PUT | `/:id` | user (owner or `canModerate`) + upload-gate | Update; `kind` immutable |
| PUT | `/:id/spoiler` | user (owner/staff) | Toggle spoiler flag |
| PUT | `/:id/like` | user | Like/unlike; own listing refused |
| PUT | `/:id/quarantine` | staff | Quarantine 1–90 days; audit-logged |
| DELETE | `/:id/quarantine` | staff | Release quarantine |
| DELETE | `/:id` | user (owner/staff) | Delete listing + files; audit-logged |
| GET | `/:worldId/comments` | optional | List comments |
| POST | `/:worldId/comments` | user | Add comment (≤1000 chars) |

### `/api/comments`
GET `/:id` public · PUT `/:id` user (author/admin) · DELETE `/:id` user (author, world owner, or admin).

### `/api/users`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | staff | Paged user table + `termsResponse`, `messageCount` |
| GET | `/me` | user | Own profile |
| GET | `/me/worlds` | user | Own listings (`?kind=`) |
| GET | `/me/following` | user | Who you follow |
| GET | `/me/notifications` | user | Follow feed; reading marks it seen |
| GET | `/me/notifications/unread-count` | user | Feed badge |
| PUT/DELETE | `/me/avatar` | user | Set/clear avatar |
| GET | `/:id/profile` | optional | Public profile + likes/downloads totals |
| PUT/DELETE | `/:id/follow` | user | Follow / unfollow |
| GET | `/:id/worlds` | optional | Someone's listings |
| DELETE | `/:id/avatar` | staff | Moderate avatar off; audit-logged |
| PUT | `/:id/status` | staff (role change = admin only) | Suspend/reinstate + role change; revokes sessions |

### `/api/messages`
GET `/unread-count` user · GET `/sent` staff · PUT `/sent/:id` staff (own or admin) · DELETE `/sent/:id` staff (recall) · GET `/` user (inbox) · POST `/` staff (broadcast = admin only) · POST `/:id/read` user+ · DELETE `/:id` user+ (dismiss; pinned refused).

### `/api/policies`
GET `/manage` admin · POST `/upload-gate/accept|decline` user · POST `/upload-gate/reset` staff/admin · POST `/tag-notice/match` user · GET `/` user · PUT `/:id` admin.

### `/api/feedback`
GET `/meta`, `/unread-count`, `/` user · POST `/` user (10/hr) · GET `/:id` user · comments CRUD · PUT `/:id/vote` user · PUT `/:id` user · PUT `/:id/status|lock` staff · DELETE `/:id` staff.

### `/api/audit`
GET `/meta` staff · GET `/` staff. No write route by design.

### Static
GET `/api/thumbnails/:filename`, `/api/avatars/:filename` public · GET `/` banner.

Global: helmet, CORS `*`, 1000 req/15min limiter keyed on `CF-Connecting-IP`, `trust proxy = loopback` (behind cloudflared). Body caps: 100kb default, 200mb world create/update, 2mb avatar.

## 3. Auth

- **Stateless JWT** `Authorization: Bearer`, claims `{ id, tv }`, `JWT_EXPIRE || '24h'`.
- **Revocation** via `users.token_version` — `protect` rejects stale `tv`; bumped on password change, suspend, role change.
- Middleware (`src/middleware/auth.js`): `protect`, `protectAllowSuspended`, `optionalAuth` (never rejects; keeps quarantined rows visible to author/staff), `admin`, `staff`.
- Roles (`src/config/roles.js`): `ROLES = ['normal','mod','dev','admin']`; `STAFF_ROLES = ['mod','dev','admin']`; `ASSIGNABLE_ROLES = ['normal','mod','dev']` (admin by hand only). `canModerate(actor,target)`: staff moderate the room, not each other. `badgeRole()` maps `normal`→null.
- Suspension enforced per request: non-GET refused.
- Client: `src/services/AuthService.ts` holds `API_URL` + token; other services read from it.

## 4. Announcements / moderation (closest analogue to server events)

**Messages** (`src/models/Message.js`): staff-authored, one-way. `recipient_id` NULL = broadcast (admin only). `scope`: `existing` → `new` → **`pinned`** (reaches later signups, **cannot be dismissed**, ignores prior dismissals). A pinned broadcast is the existing mechanism a "contest is live" notice would ride. `severity` drives badge color; `unread-count` returns `{unread, topSeverity}`. Edit with `renotify: true` → `resetReaderState` wipes `message_states` (fresh delivery). Recall = soft `recalled_at`, final. Receipts: read/dismiss stamps; broadcasts report `readCount`/`eligibleCount`. Caps: subject 120, body 4000. **Polling only — no websockets/SSE anywhere.**

**Policies**: `upload_gate` (blocking; `src/middleware/policy.js` `requireUploadTerms` on world create/update → 403 `code:'TERMS_REQUIRED'`) and `tag_notice` (advisory tag match). Acceptance invalidated by bumping `acceptance_version` (a counter, deliberately not a date). `POLICY_IDS` is a hard-coded two-element list.

**Moderation**: quarantine, suspend/flag, avatar removal, comment/thread deletion, feedback triage — all through `AuditLog.tryRecord` (never throws). `AuditLog.ACTIONS` is a fixed whitelist feeding the client filter dropdown — new moderation actions must extend it.

**Client surfaces** (`src/components/menu/`): `AdminPanelDialog.tsx` (tabs: ManageUsers, Messages, Broadcasts, SentMessageList, Policies, AuditLog, FeedbackQueue), `MessageComposerDialog.tsx`, `NotificationsTab`, `PolicyDialog`. Roles mirrored in `src/lib/roles.ts`.

## 5. World publish/storage

- Row in `worlds` + files: content JSON `<STORAGE_ROOT>/worlds/<id>.json`, thumbnail `<STORAGE_ROOT>/thumbnails/<uuid>.<ext>` (`src/utils/fileStorage.js`). `preview_data` stripped from responses.
- One table, three `kind`s; `?kind` defaults to `world` via `src/utils/kindQuery.js` — the stated compatibility contract with deployed clients.
- **Fields a contest entry could ride on:**
  - `tags` — JSON-in-TEXT matched with `LIKE '%tag%'`; **author-controlled and rewritten on every update** — not trustworthy as an entry flag.
  - `spoiler` — the precedent for a server-side boolean with its own endpoint (`PUT /:id/spoiler`) that deliberately doesn't touch `updated_at`. A `contest_id` + `PUT /api/worlds/:id/contest` would mirror it.
  - quarantine columns — precedent for **date-windowed state + sweeper**.
  - `created_at`/`updated_at` — usable for "published during window" but mixed-format (see §1).
  - `SORT_EXPRESSIONS` in `src/models/World.js` (`created_at, updated_at, downloads, name, likes`) — where a contest sort would be whitelisted; `likes` shows the computed-expression pattern.
  - Viewer-dependent visibility already exists (`getAll({viewer})`, `World.isVisibleTo`) — contest/judging visibility extends that predicate.
- No `status`/`visibility`/`featured` column today. Nothing resembling contest/event/prize/judging anywhere.

## 6. Deploy / update path

- **No deploy scripts/CI/Docker/pm2 in repo.** `npm start` = `node src/server.js`.
- Git: `origin` = JakeJamesDev fork, `upstream` = FieryLionite (live server owner). Workflow: work on fork → hand to FieryLion → they deploy. `HANDOFF.md` is the handoff artifact (Deploying / Rollback / What to look at first). **A contests feature ships with an equivalent HANDOFF section.**
- **Self-migrating boot**: `server.js` runs `createTables()` → every `add*Column` migration → `createIndexes()` in a try/catch that logs and starts anyway. New table = just add to `createTables`; new column on an existing table = idempotent `src/utils/addXColumn.js` wired into `server.js` (pattern: `addQuarantineColumns.js`).
- Ops scripts: `init-db`, `migrate-kind`, `update-tags`, `backup`/`restore`/`list-backups`/`cleanup-backups`, `snapshot`/`list-snapshots`/`cleanup-snapshots`.
- Env (`src/config/paths.js`): `DATA_DIR`, `DB_PATH` (`:memory:` honored — tests), `STORAGE_ROOT`, `BACKUPS_DIR`, `SNAPSHOTS_DIR`, `PORT`, `JWT_SECRET`, `JWT_EXPIRE`, `NODE_ENV`, `ADMIN_*`.
- Tests: vitest + supertest against `:memory:` SQLite; **must use `tests/context.js`** (ESM import of the CJS sources creates a second module graph = second in-memory DB). ~90 test files.
- `SERVER_PLANS.md` is stale (MongoDB era) — ignore.

## 7. Scheduled / timed logic

Exactly one precedent, the template to copy: **quarantine sweeper** (`src/utils/sweepQuarantine.js`). Hourly `setInterval`, **unref'd**; run at boot, on the timer, and **lazily in front of `GET /api/worlds`** so a missed tick never serves an expired listing. Never throws — per-row failures log and continue. No cron/job queue. Contest open/close transitions should follow the same pattern: unref'd interval + lazy check on the read path, ISO comparisons normalized through `strftime`/`datetime`.

## Shortest path sketch (scout's synthesis)

New `contests`/`events` table (+ `contest_entries` join or `contest_id` column via `addContestColumn.js`) in `createTables`; `/api/events` router; `optionalAuth` public listing, `staff`/`admin` create/judge; announcements via pinned broadcast; state transitions via a sweeper twin; new `AuditLog.ACTIONS`; leaderboard sort in `SORT_EXPRESSIONS`; Events tab in `AdminPanelDialog`; HANDOFF section for FieryLion.
