# 13 — Client: Contest tab in Community Creations

Type: task
Status: done
Blocked by: 12
Repo: formamorph

## Scope

Per [spec.md](../spec.md) §"Client — contest tab". Grounding:
[research/client-surfaces.md](../research/client-surfaces.md) §2 (the not-a-CatalogKind decision
and its five traps: persisted filter slot, dev-router ledger, mobile icon row, aria stubs,
kind-label guards). Visual target: contest tab variant C in
[assets/05-player-ui-prototype.html](../assets/05-player-ui-prototype.html).

- Conditional Contest tab (icon needed — tabs are icon-only <1040px), modeled as a pre-filter
  view over the catalog (quarantined-view precedent), own filter slot, own aria stub, visible
  while a contest is active or archives exist.
- Slim bar: title, dates, Rules button → rules dialog. No shuffle copy anywhere player-facing.
- Grid states: live = shuffled per visit, likes visible; winner picked = winner pinned first with
  badge, then by likes; archive = same layout, entry affordances off. Winner badge also on the
  card in the normal catalog.
- Archive selector: once >1 ended contest exists, a dropdown in the slim bar switches archives;
  active contest is default.
- Dev-router `'contest'` entry + drift guard.

## Done

Component tests per spec §Testing Decisions (tab visibility, three grid states, selector,
kind-label guards don't throw). verify-ui at mobile preset for the tightened tab row. Four gates
green.
