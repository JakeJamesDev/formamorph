# 10: Raw Load Remaps the Chosen Avatar

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: low

Opus at low: route one load branch through the remap that the normal branch already runs.

## What to build

A save loads with its chosen Avatar remapped on every load path (spec: Saves; T03-5). When a save's conversion fails, the game falls back to a best-effort raw load. That path skips the game-load step, so the chosen-Avatar remap never runs and an old save loses its Avatar. The same branch already skipped the stat backfill before this effort. Found by the close review.

## Acceptance criteria

- [ ] A pre-change save that takes the raw-load fallback shows the same Avatar as through the normal load.
- [ ] The remap stays idempotent on that path.
- [ ] A test drives the fallback branch and fails when the remap is removed from it.
