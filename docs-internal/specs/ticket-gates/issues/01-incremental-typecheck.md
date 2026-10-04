# 01: Incremental typecheck

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The typecheck gate reuses the previous run's work, and a fresh worktree starts warm.

- A project script runs `tsc --noEmit --incremental` with a build-info file at the worktree root, never under node_modules. It replaces the bare `tsc --noEmit` in the `typecheck` npm script and in the ticket worktrees gate list.
- With no local build-info file, the script seeds it from the main checkout's file when both sit on the same drive, then runs.
- The script prints cold, warm or seeded, and the wall time.
- Two correctness tests on a temp fixture project: a planted type error after a warm run exits non-zero; a seeded stale file still reports an error in a file that was clean when the seed was made.
- The ticket's Answer records cold, warm and seeded times on the app, measured with no other prepare running.

Spec: Implementation → Typecheck gate; Testing Decisions.

Recommended model rationale: a cache whose failure mode is a silent false green; the tests that prove it bites need care.

## Acceptance criteria

- [x] `npm run typecheck` and the gate both run incrementally with a worktree-local build-info file.
- [x] A fresh worktree on the same drive seeds from the main checkout and reports "seeded".
- [x] Fixture tests: planted error after warm run fails; seeded stale file still fails on the error.
- [x] Times in the Answer: cold, warm, seeded.
- [x] The four gates are green.

## Answer

`scripts/typecheck.mjs` runs `tsc --noEmit --incremental` with `typecheck.tsbuildinfo` at the checkout root; `npm run typecheck` calls it, so the gate list is unchanged (Q4). A distinct file name leaves the old minimal `tsconfig.tsbuildinfo` unused; the script does not delete it.

Per Q3, a clean worktree run on the main checkout's drive writes its file back to the main checkout (temp file + rename), and a fresh worktree seeds from it. The shared file is `typecheck.seed.tsbuildinfo`, apart from the main checkout's own `typecheck.tsbuildinfo`: tsc resolves the node_modules junction, so a worktree's file stores `../../../node_modules/...` paths that fit only checkouts at worktree depth. Keeping them apart stops the main checkout's own runs and the worktree seed from turning each other near-cold. A seed copy that fails (missing or busy file) runs cold.

Times on the app, 2026-10-04, no prepare lock held:

| Run | Wall time |
|---|---|
| Cold | 21.1 s |
| Warm | 3.6 s |
| Seeded | 4.0 s |

The seeded run read a seed written from this worktree's own tree, so it is the best case; a seed from an older tree rechecks the files that changed since.

Fixture tests in `scripts/typecheck.test.mjs` (6 tests): a planted error after a warm run fails; a seed made on a clean tree still fails on an error in an unchanged file whose dependency changed; a seed written back by one tree still fails another tree's planted error and the failing run does not overwrite it; a half-written seed still fails a planted error (tsc treats it as cold); the main checkout's own runs never read or write the seed. Mutations that ignore tsc's exit status, publish after a failed run, or share with the checkout itself each turn a test red.
