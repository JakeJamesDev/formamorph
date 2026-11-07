# 01: Pick and flag Hidden Gems

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Rulings; Implementation Decisions › Server). Full server detail: the server half, `docs-internal/specs/hidden-gems/spec.md` in FormamorphServer (Download log, Population, Window, Score, Eligibility, Rotation, Catalog).

Model rationale: three new tables, a score over a 60-day window with percentile cutoffs, a timed rotation, and a read-time flag that must match the population rule for every reader. A slip leaks a contest rank or flags a world staff took out.

## What to build

Every download is logged by UTC day. Every 12 hours the server picks up to 3 Hidden Gems from the population by the smoothed score, skipping worlds picked in the last 7 days. `GET /api/worlds` gives every row `hidden_gem`, which is `true` only for a world in the newest rotation that is still in the population. A guest, an author and staff all get the same flags.

## Acceptance criteria

- [ ] A download through any of the three content routes adds to that world's bucket for the current UTC day, in the same transaction as the counter.
- [ ] A world-content request for a missing id still returns 404.
- [ ] The population, window, score, percentile and eligibility rules match the server half exactly, with the constants in one config module.
- [ ] `rotateHiddenGems(now)` makes a new rotation only when none exists or the newest is 12 hours old or older. It runs at boot and through the `hourly` helper, in try/catch with a logged failure.
- [ ] A rotation with no eligible world is recorded with no picks, and the catalog then flags nothing.
- [ ] Ties break by world id. Two runs on the same data pick the same worlds.
- [ ] A world picked less than 7 days ago is not picked, and is eligible at 7 days.
- [ ] A picked world that becomes quarantined, unlisted, pinned or Supporter-only loses its flag at once, for a guest, for staff and for its author.
- [ ] A contest entry with hidden likes is never picked, and its likes never enter `p`.
- [ ] The catalog `ETag` changes after a rotation that changes the picks.
- [ ] Rotations older than 7 days are pruned, except the newest.
- [ ] Tests drive the routes and `rotateHiddenGems(now)` with a set clock, and check the catalog response. They don't read the new tables or compute a score by hand.
- [ ] `docs-internal/server.md` names the new tables and the rotation job.
