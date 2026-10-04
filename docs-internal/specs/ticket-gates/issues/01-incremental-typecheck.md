# 01: Incremental typecheck

Status: ready-for-agent
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

- [ ] `npm run typecheck` and the gate both run incrementally with a worktree-local build-info file.
- [ ] A fresh worktree on the same drive seeds from the main checkout and reports "seeded".
- [ ] Fixture tests: planted error after warm run fails; seeded stale file still fails on the error.
- [ ] Times in the Answer: cold, warm, seeded.
- [ ] The four gates are green.
