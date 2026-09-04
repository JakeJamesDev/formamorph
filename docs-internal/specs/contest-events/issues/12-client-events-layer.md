# 12 — Client: events service, banner & acknowledge modal

Type: task
Status: done
Repo: formamorph (buildable against the spec contract with mocked service; live server optional)

## Scope

The generic client layer, per [spec.md](../spec.md) §"Client — generic events layer". Grounding
(file/line detail): [research/client-surfaces.md](../research/client-surfaces.md) §3–4. Visual
target: the picked variants in [assets/05-player-ui-prototype.html](../assets/05-player-ui-prototype.html)
(banner = card B, ack modal = poster B, dismissed state = named chip).

- Events service + polling hook: `/api/events/active` every ~5 min + window-focus refetch,
  piggybacking an unread-count nudge. First interval in the app: community-flag gated, callbacks
  in refs (the MessagesTab incident), fails silent/hidden.
- Banner card (Dismiss | View Entries) as a shrink-0 row on the main menu + a second instance in
  the Community Creations header; Dismiss collapses to a chip naming the contest; chip opens the
  contest tab (tab arrives in 13 — until then the action can open Community Creations). Severity
  tokens only; both themes; mobile truncation; visible signed-out; gone when no active event.
- Acknowledge modal (start + end phases), explicit-acknowledge-only close; localStorage seen-state
  keyed event id + phase; signed-in acknowledge also calls markRead on the linked broadcast.
- Unknown event types render as announcements (generic fields only).
- Dev-router: canned-fixture entries for the banner and ack modal (changelog-sample precedent);
  drift-guard tests updated.

## Done

Component/hook tests per spec §Testing Decisions (banner states, dismiss→chip, ack persistence +
markRead, hook gating/refs). verify-ui pass on real viewport sizes, both themes. Four gates green.

## Outcome (2026-08-20)

Built. `EventService.fetchActive` + `useActiveEvents` (5-min interval, focus refetch with a 60s floor,
`COMMUNITY_ENABLED`-gated, callback in a ref, silent failure) feed `EventBanner` (main menu + Community
Creations header) and `EventAckModal` (acknowledge-only close, localStorage keyed event id + phase,
`markRead` on the linked broadcast when signed in). Unknown types render as announcements. Dev route
`#dev?view=mainMenu&modal=eventAck&tab=start|end` serves a canned event for both surfaces; ledger and
drift guard updated.

Deferred to 13: the banner/chip/poster all open Community Creations, not a contest tab, and the `end`
phase only reaches the client through an active event carrying a winner — `GET /api/events` (the archive
feed) is 13's.
