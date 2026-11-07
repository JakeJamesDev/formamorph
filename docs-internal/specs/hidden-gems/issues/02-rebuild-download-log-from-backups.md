# 02: Rebuild the download log from backups

Status: ready-for-human
Base: 366855a
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: ../spec.md (Rulings Q7). Full server detail: the server half, `docs-internal/specs/hidden-gems/spec.md` in FormamorphServer (Backfill).

Model rationale: a one-off script with edge cases (gap spreading, deleted worlds, zstd input, run-once marker). It runs against production once, so a mistake is permanent.

## What to build

The operator runs one script after the deploy, giving it the production backups in order with the pre-deploy backup last. It fills the daily download log for the time since 2026-09-06, so the first rotation already scores worlds on 60 days of downloads.

## Acceptance criteria

- [x] The script reads plain `.db` and `.db.zst` backups, each opened read-only, in the order given. Fixtures mix both; the first test checks the backup bytes are unchanged; an out-of-order list is refused.
- [x] Each world's download difference between two backups is spread evenly over the UTC days after the earlier backup's day, up to and including the later one's. The remainder goes to the last day. Test "spreads a gap evenly…": 7 over 3 days reads 3/5/7 as the window slides; a mutation to remainder-first went red.
- [x] A world missing from the earlier backup counts from 0. A negative difference counts as 0. Test "counts a new world from 0…".
- [x] Ids no longer in the live `worlds` table are skipped without error. First test: `skipped: 1`.
- [x] The script adds to existing buckets and never replaces them. Test "adds to buckets the live log already holds" (route download + backfill = 3); a replace mutation went red.
- [x] A second run is refused. The marker is a setting declared `internal: true`. Test "writes nothing on a dry run, and refuses a second run"; marker `hidden_gem_backfill`.
- [x] A test runs the script on fixture backups into a fixture live database, then calls `rotateHiddenGems(now)` and checks the pick outcome in the catalog. A world whose downloads all came before the window is picked as a low-download world. First test; per Q18 the backfill's own rotation makes the pick, and a later `rotateHiddenGems` keeps it.
- [x] An `npm run` script runs it, and `docs-internal/server.md` gives the PowerShell steps to run it after the deploy. `npm run backfill-download-days`; server.md "Backfilling the download log (once)". The command's quoting ran through Windows PowerShell 5.1 into bash on sample backup names and listed them in time order.
- [x] The deploy skill names the backfill as a one-time step for this deploy. Edited in the main checkout's untracked `.claude/skills/deploy/SKILL.md`.

## Landed

**Not verified**
- The script has not run on production backups. Only fixture snapshots of the test schema were used.

**For you**
- After the deploy, run the dry run in server.md "Backfilling the download log (once)" and check that the last listed file is this deploy's pre-deploy backup before you run `--write`.
- `--write` runs the rotation inside the same transaction as the buckets (Q18). A failed rotation rolls back the whole backfill, so it can run again.
