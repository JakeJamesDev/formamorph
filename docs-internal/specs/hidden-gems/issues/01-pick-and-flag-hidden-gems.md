# 01: Pick and flag Hidden Gems

Status: ready-for-human
Base: e5b6c93
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Rulings; Implementation Decisions › Server). Full server detail: the server half, `docs-internal/specs/hidden-gems/spec.md` in FormamorphServer (Download log, Population, Window, Score, Eligibility, Rotation, Catalog).

Model rationale: three new tables, a score over a 60-day window with percentile cutoffs, a timed rotation, and a read-time flag that must match the population rule for every reader. A slip leaks a contest rank or flags a world staff took out.

## What to build

Every download is logged by UTC day. Every 12 hours the server picks up to 3 Hidden Gems from the population by the smoothed score, skipping worlds picked in the last 7 days. `GET /api/worlds` gives every row `hidden_gem`, which is `true` only for a world in the newest rotation that is still in the population. A guest, an author and staff all get the same flags.

## Acceptance criteria

- [x] A download through any of the three content routes adds to that world's bucket for the current UTC day, in the same transaction as the counter. Tests "counts world-content downloads", "counts Supporter-content downloads", "counts 4 dependency downloads"; one `db.transaction` in `World.incrementDownloads`.
- [x] A world-content request for a missing id still returns 404. Test "still answers 404 for a missing world". It returned 500 before this ticket (ruling Q17).
- [x] The population, window, score, percentile and eligibility rules match the server half exactly, with the constants in one config module. Window, likes, cutoff and exclusion tests in `tests/hiddenGems.test.js`; 16 of 17 guard mutations killed (the survivor is an equivalent mutant); constants in `src/config/hiddenGems.js`.
- [x] `rotateHiddenGems(now)` makes a new rotation only when none exists or the newest is 12 hours old or older. It runs at boot and through the `hourly` helper, in try/catch with a logged failure. Tests "makes a new rotation only at 12 hours", "runs hourly once started", "logs a failed rotation"; the boot call was read in `src/server.js`.
- [x] A rotation with no eligible world is recorded with no picks, and the catalog then flags nothing. Test "records a rotation with no eligible world".
- [x] Ties break by world id. Two runs on the same data pick the same worlds. Test "picks at most three … ties broken by id".
- [x] A world picked less than 7 days ago is not picked, and is eligible at 7 days. Tests at 7 d − 1 ms and at 7 d.
- [x] A picked world that becomes quarantined, unlisted, pinned or Supporter-only loses its flag at once, for a guest, for staff and for its author. The "flag at read time" tests.
- [ ] A contest entry with hidden likes is never picked, and its likes never enter `p`.
- [x] The catalog `ETag` changes after a rotation that changes the picks. Test "catalog ETag".
- [x] Rotations older than 7 days are pruned, except the newest. A throwaway probe on an in-memory database: a 7.5-day rotation went, an exactly-7-day one stayed.
- [x] Tests drive the routes and `rotateHiddenGems(now)` with a set clock, and check the catalog response. They don't read the new tables or compute a score by hand. Three fixtures write `worlds` directly (unlisted, unapproved, a dependency turned into a world), each with a comment; one test calls `World.incrementDownloads` on a missing id.
- [x] `docs-internal/server.md` names the new tables and the rotation job. New "Hidden Gems" section.

## Landed

**Not verified**

- Contest likes never enter `p`: the "never picks an entry whose likes are hidden" test covers the pick half. The `p` half follows from one population query feeding both `p` and the pick list. No test isolates `p`, because that needs a fixture whose expected pick depends on the score's arithmetic.
- Pruning has no catalog-visible effect, so the throwaway probe was the only check, and it was not committed.

**For you**

- Nothing to judge in the app here: this is server-only. The app placement is ticket 03.
