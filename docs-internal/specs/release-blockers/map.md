# Release blockers

Status: in-progress

Label: wayfinder:map

## Destination

Everything in `issues/` is closed, so nothing on this list stands between the current build and a release.

**Reached 2026-08-23** — both blockers resolved; the list stays open for whatever gets called a blocker next.

## Notes

- This is a **standing list**, not a one-off effort: entries land here whenever something is called a blocker, and leave when it's fixed. It does not close.
- Anything here blocks a release regardless of which effort it came from. Cross-link to the owning `docs-internal/specs/<effort>/` map when one exists.
- Ticket format follows `docs/agents/issue-tracker.md` — `Status:` line per `docs/agents/triage-labels.md`, answer appended under `## Answer` on resolve.

## Decisions so far

- **01 — Theme the time selection widget: resolved.** Already fixed by commit `4288c7d` (themed
  clock popover, native indicator hidden) before triage; verified 2026-08-23 — 42/42 tests, both
  themes checked live. Details in [01](issues/01-theme-time-picker.md).
- **02 — Update Available doesn't open an uncached world: resolved 2026-08-23.** One bug, two feeders
  (notification rows, profile listings): the open-listing lookup ran against a stale (or still-empty)
  catalog snapshot and misreported the listing as deleted. Fixed with `catalogSettled` in
  `useCatalogSync` — a miss only counts once a refresh lands during the current open. 9 new tests,
  mutation-proven. Details in [02](issues/02-update-available-uncached-world.md).
- **06 — Release builds still ship the Elaina Avatar** resolved 2026-11-02. Sei replaces Elaina on release builds, and a build with no bundled Avatar holds no `.vrm`. Details in [06](issues/06-release-avatar-license.md).
- **03 — Stat request invents changes on Cydonia: closed for 3.6.0 by user ruling, 2026-11-03.** The probe bar is not met, and the release ships with the gap. Details in [03](issues/03-cydonia-stat-request.md).
- **05 — Formamorph AI needs the Weekly Allowance first: resolved 2026-11-03.** Weekly budgets are live, and the Patreon tier descriptions say weekly. Details in [05](issues/05-weekly-allowance.md).
- **07 — Formamorph AI needs its limits enforced first: resolved 2026-11-03.** The enforcement effort is deployed, and the live turn call cap is set. Details in [07](issues/07-formamorph-ai-enforcement.md).
- **04 — Supporter tier names are not decided: resolved 2026-11-03.** The Patreon titles are set, the app and site read them, and the copy sweep is done. Details in [04](issues/04-supporter-tier-names.md).

## Open blockers

- [08 — Remove the doubled offer count address](issues/08-remove-doubled-funnel-address.md): do this with the next release.
- [09 — Remove the old spend report route](issues/09-remove-spend-report-route.md): do this with the next release.

## Fog

_(none)_
