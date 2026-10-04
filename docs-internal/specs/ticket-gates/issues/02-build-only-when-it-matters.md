# 02: Build only when it matters

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A tests-only change skips the Vite build in prepare; every other change still builds.

- A project script takes `{base}`, lists the changed files since Base plus untracked files (the affected-tests script's list), and classifies them. It replaces the bare `npm run build` in the ticket worktrees gate list.
- Skip set, exactly: test files (`*.test.*`), helpers under the test folder, spec and notes folders under `docs-internal/`, and the ticket worktrees config. Any other changed path forces the build. Docs always build, because the help index bundles them.
- The script prints the decision: the paths that forced a build, or "build skipped: tests-only change" with the count.
- The classifier is a pure function tested on tests-only, docs-only, mixed and source lists.
- A source test asserts no skip-set pattern matches a path the Vite entry graph or the help docs bundle reads.
- The ticket's Answer records a tests-only prepare's total time, measured with no other prepare running.

Spec: Implementation → Build gate; Testing Decisions.

Recommended model rationale: a small classifier with a clear skip set and a source test as the net.

## Acceptance criteria

- [ ] A tests-only diff skips the build and says so; a mixed diff builds and names the paths that forced it.
- [ ] A docs-only diff builds.
- [ ] Classifier tests cover the four list shapes; the skip-set source test passes and fails when a source pattern is added to the skip set.
- [ ] Tests-only prepare total in the Answer.
- [ ] The four gates are green.
