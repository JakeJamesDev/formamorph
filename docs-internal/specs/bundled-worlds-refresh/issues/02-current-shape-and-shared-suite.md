# 02: Current Shape and Shared Suite

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q5, Q10, Q11; Testing Decisions › Shared suite)

## What to build

The prefactor. After it lands, every bundled world is stored in the shape the editor saves, and a shared suite keeps it that way.

- Save each of the eight worlds through `migrateWorld`. No content change. Ids and images are preserved. Review the stripped diff: it holds only migration rewrites.
- Add one shared Vitest suite over every bundled world, in the pattern of the bundled gates test:
  - Current shape: `migrateWorld` changes nothing but what it always stamps.
  - The Test Bench reports no finding on any rule. Fix a finding in the data only when the fix is mechanical. Otherwise list it in comments and route it to the spec session.
  - Old saves (Q10): a save made against the world revision before this ticket loads against the current world and commits one turn without error. The fixture is built in the test from that revision. Pick a mechanism that works in a shallow CI clone, and route the choice to the spec session if it needs a stored file.
  - Coverage: a table of assigned features per world, empty at first. Each world ticket adds its row.
- Regenerate the bundled fingerprints.
- Add the one Major changelog entry for the refresh as a fragment.

## Acceptance criteria

- [ ] All eight world files are in the current shape. The stripped diff shows only migration rewrites.
- [ ] The shared suite passes, and each check is shown to fail once (the old file for shape, a broken reference for the Test Bench, a removed stat for the old save).
- [ ] Fingerprints are regenerated and committed with the worlds.
- [ ] The changelog fragment is in place.
- [ ] Four gates are green.
