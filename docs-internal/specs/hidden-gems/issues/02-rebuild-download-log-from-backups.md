# 02: Rebuild the download log from backups

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Rulings Q7). Full server detail: the server half, `docs-internal/specs/hidden-gems/spec.md` in FormamorphServer (Backfill).

Model rationale: a one-off script with edge cases (gap spreading, deleted worlds, zstd input, run-once marker). It runs against production once, so a mistake is permanent.

## What to build

The operator runs one script after the deploy, giving it the production backups in order with the pre-deploy backup last. It fills the daily download log for the time since 2026-09-06, so the first rotation already scores worlds on 60 days of downloads.

## Acceptance criteria

- [ ] The script reads plain `.db` and `.db.zst` backups, each opened read-only, in the order given.
- [ ] Each world's download difference between two backups is spread evenly over the UTC days after the earlier backup's day, up to and including the later one's. The remainder goes to the last day.
- [ ] A world missing from the earlier backup counts from 0. A negative difference counts as 0.
- [ ] Ids no longer in the live `worlds` table are skipped without error.
- [ ] The script adds to existing buckets and never replaces them.
- [ ] A second run is refused. The marker is a setting declared `internal: true`.
- [ ] A test runs the script on fixture backups into a fixture live database, then calls `rotateHiddenGems(now)` and checks the pick outcome in the catalog. A world whose downloads all came before the window is picked as a low-download world.
- [ ] An `npm run` script runs it, and `docs-internal/server.md` gives the PowerShell steps to run it after the deploy.
- [ ] The deploy skill names the backfill as a one-time step for this deploy.
