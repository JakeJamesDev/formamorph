# 02: Build only when it matters

Status: done
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

## Answer

Landed: `scripts/buildDecision.mjs` (pure classifier), `scripts/buildGate.mjs` (the gate), `scripts/buildDecision.test.mjs` (classifier and skip-set source test).
The skip-set patterns anchor `*.test.*` to source extensions. Deleted files count as changes, so deleting a doc or a source file builds.

Run by hand in the worktree (Q4: the spec session flips the `.claude/ticket-worktrees.json` line after this lands on main):

```
$ node scripts/buildGate.mjs HEAD          # one untracked src/zzGateProbe.test.ts
build skipped: tests-only change (1 changed files since HEAD)      exit 0

$ node scripts/buildGate.mjs 5cf34ed3      # this ticket's diff
building: 4 of 5 changed files force the build:
  docs/Changelog.md
  scripts/buildDecision.mjs
  scripts/buildGate.mjs
  scripts/testSelection.mjs
... vite build, 5282 modules transformed                           exit 0, 27.8 s
```

A tests-only prepare total is not measured here: prepare reads the old gate list until the spec session swaps the line. The changelog line each ticket adds is in `docs/`, which always builds, so a ticket with a changelog line never skips the build. Only a ticket with no changelog line can.
