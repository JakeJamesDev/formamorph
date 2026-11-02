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

## Open blockers

- **03 — Stat request invents changes on Cydonia** (from Entity Stats, Q66). The shipped stat request scores 30% exact with 122 invented changes on Cydonia 24B; the cloud model clears its bar. Details in [03](issues/03-cydonia-stat-request.md).
- **04 — Supporter tier names are not decided** (from Formamorph AI). Names come from Patreon titles with "Member" as the fallback, and copy reads as a donation. Details in [04](issues/04-supporter-tier-names.md).
- **05 — Formamorph AI needs the Weekly Allowance first** (from Weekly Allowance). No member may start on a monthly allowance. Details in [05](issues/05-weekly-allowance.md).

_(none)_

## Fog

_(none)_
