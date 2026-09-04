# 15 — Client: admin Events tab & winner pick

Type: task
Status: done
Status note: shipped 2026-08-20 (commit fa64953)
Blocked by: 12
Repo: formamorph

## Scope

Per [spec.md](../spec.md) §"Client — admin Events tab". Grounding:
[research/client-surfaces.md](../research/client-surfaces.md) §5 (tab plumbing, keep-mounted
template, dev-router lockstep) — with one deliberate deviation settled in ticket 06: the tab is
**staff-visible** (winner pick = any staff), not admin-only; create/edit/cancel/delete and
cancelled rows are admin-only within it. Visual target: the picked variants in
[assets/06-admin-ui-prototype.html](../assets/06-admin-ui-prototype.html) (list = grouped-by-state
B, form = single form A with Feedback-style type-picker tab strip, winner = gallery dialog A).

- Events tab appended to the admin tab enum + grids + dev-router ledger; keep-mounted,
  fetch-on-active (Broadcasts template).
- List grouped: Happening Now card / Scheduled / Past.
- One create/edit form, type picker as a full-width two-column tab strip; contest type adds
  rules text. Broadcast composer untouched. Cancel with confirm; delete only for scheduled.
- Winner pick gallery dialog: entry grid → auto-broadcast preview → announce; own-entry and
  quarantined cards unpickable with reason shown.
- Role gating by hiding: staff see read-only groups + Pick Winner only.

## Done

Component tests per spec §Testing Decisions (grouping, role matrix, form type switch, winner
guards). verify-ui both roles via dev fixtures. Four gates green.
