# 01 — Charting interview

Type: grilling
Status: done

## Question

Name the destination and settle the top-level scope of the Server Events & Contest effort.

## Answer

Four AskUserQuestion rounds, 2026-08-20:

**Round 1 — destination & scope**
- Destination: **spec ready to build** in `docs-internal/specs/contest-events/` — decisions + sliced tickets; building is follow-on work.
- Generality: **typed events, contest first** — generic `events` table (type, start/end, message); contest behavior keys off `type: 'contest'`.
- Event admin: **in-app admin UI** (Contests/Events tab in AdminPanelDialog territory), staff-gated.
- Judging: **staff pick + announcement** is in scope.

**Round 2 — player-facing behavior**
- Message UX: **banner + acknowledge modal** — modal at start and end, closable only via explicit acknowledge; compact persistent banner (no X) for the event's duration, linking to the contest section.
- Surfaces: **main menu + Community Creations tab**. Not in-game.
- Entry model: **flagged publish, dual-listed** — publish flow offers an "Enter into <contest>" toggle during the window; entries are normal published worlds carrying the event id, visible in both the regular catalog and the contest section. (Entering already-published worlds: ruled out.)
- Event end: **lock entries, showcase persists** — no new entries after end; section stays browsable as an archive; winner highlighted once picked.

**Round 3 — architecture & entry rules**
- Event arch: **events table + auto-broadcast** — `events` table is the source of truth; server auto-posts a pinned broadcast at start (and a normal one at end) so inbox/badge/acknowledge machinery is reused; banner + contest UI read `GET /api/events/active`.
- Entry limit: **one per user per contest**.
- Entry edits: **editable until deadline** — after end, server refuses updates to entered worlds until the winner is picked; owner can withdraw to unlock.
- Rules: **shown, not gated** — event carries rules text displayed in the entry UI and contest section; entering implies agreement; no acceptance records in v1.

**Round 4 — showcase & finishing touches**
- Winner: **auto-broadcast + highlight** — picking the winner auto-posts a broadcast; showcase pins the winner with a badge; badge also shows on the card in the normal catalog.
- Showcase sort: **shuffled per visit** while running (likes visible); after winner picked: winner first, then likes.
- CC placement: **event tab** beside Worlds/Entities/Dictionaries, visible only while a contest is active or archives exist; the CC banner links to it.
- Concurrency: **multiple active events allowed, at most one active contest** (server-enforced). V1 also ships a plain **announcement** event type (banner + modal, no contest behavior) to prove the generic layer.
