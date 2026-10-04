# Spec: Ticket Gates

Status: done
Status note: Closed 2026-10-04. Tickets 01-03 done, last landing 93e804b8. Closed without gates.
Spec session: ticket-gates — spec

## Problem Statement

Every ticket lands through a prepare step that runs four gates in its worktree: typecheck, changed-files lint, affected tests, and a full production build. The affected-tests gate scales with the change. The other three do not. A one-line fix with a two-test change pays about four minutes of fixed cost, most of it a cold full-project typecheck and a full Vite build. With several tickets landing in a day, the fixed cost is the bulk of the wait.

Research (2026-10-04, `docs-internal/notes/ticket-gates-research/notes.md`) found that the gate shape itself is standard: merge queues typecheck and test per change, then build the candidate. The savings are in making the per-change gates incremental and in not building when the change cannot change the bundle.

## Solution

Two changes to the gate commands, both inside the project. The prepare hook is unchanged.

1. **Incremental typecheck.** The typecheck gate runs `tsc --noEmit --incremental` with a build-info file inside the worktree, on the same drive as the sources, never inside the shared node_modules junction. A fresh worktree seeds its file from the main checkout's when one exists, so the first run is warm too. Measured on this machine: 24 s cold, 5 s warm.
2. **Build only when it can matter.** The build gate becomes a project script that reads the diff since Base and runs the Vite build only when a file in the bundle's input set changed. A tests-only change skips it. Docs changes do not skip it, because the help index bundles the docs.

## Rulings

Settled with the user on 2026-10-04.

| # | Ruling |
|---|---|
| Q1 | Incremental typecheck and the build classifier ship. The `isolate: false` vitest experiment and TypeScript 7 do not, until measured separately |
| Q2 | The build stays in prepare for source changes. Prepare is the merge candidate, so no "build after landing" |
| Q3 | After a clean run in a worktree, the typecheck script writes its build-info back to the main checkout (temp file, then rename), same drive only, so the next fresh worktree seeds warm. Nothing in the main checkout runs typecheck on its own, so without this the seed never exists (ticket 01 question) |
| Q4 | Tickets never edit the gate list. It is excluded from git and every prepare reads it from the main checkout, so a line naming a script not yet on main breaks every other prepare. The spec session flips each line after its script lands (ticket 02 question) |
| Q5 | The seed in the main checkout is its own file, apart from the main checkout's own build-info. tsc resolves the node_modules junction, so a worktree's build-info holds paths at worktree depth that fit only other worktrees; one shared file would make main's run and the next seed near-cold in turn. Slow, not a false green (ticket 01 review finding, refines Q3) |
| Q6 | `docs/Changelog.md` joins the build skip set. It is text behind a raw import and its format test runs on every prepare, so a tests-plus-changelog ticket skips the build. Every other docs file still builds. Ticket 03 (2026-10-04) |

## User Stories

1. As the author, I want a one-line ticket to prepare in under two minutes, so that landing small fixes is cheap.
2. As the author, I want the typecheck to reuse the last run's work, so that a small change checks in seconds.
3. As the author, I want a new worktree to start warm, so that the first prepare is not the slow one.
4. As the author, I want a stale cache to still report a real type error, so that a fast gate is still a gate.
5. As the author, I want a tests-only change to skip the build, so that test fixes land fast.
6. As the author, I want a docs change to still build, so that the bundled help index is checked.
7. As the author, I want the gate log to say when the build was skipped and why, so that a skip is never silent.
8. As the author, I want both changes to live in the project, so that the global prepare hook stays generic.
9. As a ticket session, I want the same four gate commands, so that nothing in the workflow doc changes.

## Implementation Decisions

### Typecheck gate

- A project script replaces the bare `tsc --noEmit` in the gate list and in the `typecheck` npm script. It runs `tsc --noEmit --incremental --tsBuildInfoFile <path>`, where the path is a gitignored file at the worktree root (`*.tsbuildinfo` is already ignored). The file never lives under node_modules, which worktrees share through a junction.
- Seeding: when the worktree has no build-info file and the main checkout (read from the worktree's git common dir) has one on the same drive, the script copies it first. Different drives skip the seed, since TypeScript stores absolute paths across drives.
- Write-back (Q3): after a clean run in a worktree on the same drive, the script copies its build-info to the main checkout's path through a temp file and a rename, so a reader never sees a partial file. The main checkout's own run writes in place.
- **Ticket 01 landed 2026-10-04 (`cce89f30`).** Script `scripts/typecheck.mjs` behind `npm run typecheck`, so the gate line did not change. Worktree file `typecheck.tsbuildinfo`; main-checkout seed `typecheck.seed.tsbuildinfo` (Q5). A failed seed copy runs cold; a half-written seed still fails a planted error (fixture test). Times on the app: cold 21.1 s, warm 3.6 s, seeded 4.0 s. The old minimal `tsconfig.tsbuildinfo` is unused and left in place.
- **Ticket 02 landed 2026-10-04 (`2202b571`).** `scripts/buildGate.mjs` over the pure classifier `scripts/buildDecision.mjs`; deleted files count as changes. The spec session flipped the gate line to `node scripts/buildGate.mjs {base}` the same day (Q4). Open finding: every ticket adds a changelog line in `docs/`, which always builds, so the skip fires only for a ticket with no changelog line. Ruled in Q6: it does, through ticket 03.
- The script prints whether the run was cold, warm or seeded, and the wall time.
- Correctness is proven, not assumed: a test plants a type error after a warm run and confirms a non-zero exit; a second test seeds from a build-info made on a tree where the erroring file was clean and confirms the error is still reported. Both run against a small fixture project, not the app.

### Build gate

- A project script replaces the bare `npm run build` in the gate list. It takes `{base}`, lists the changed files since Base plus untracked files (the same list the affected-tests script uses), and classifies them.
- The build runs when any changed path is outside the skip set. The skip set is exactly: test files (`*.test.*`), test helpers under the test folder, spec and notes folders under `docs-internal/`, and the ticket worktrees config. Everything else builds, docs included.
- The script prints the decision and the paths that forced a build, or "build skipped: tests-only change" with the count.
- A source test keeps the skip set honest: it asserts that no path in the skip set is reachable from the Vite entry graph or from the help docs bundle, by checking the patterns against the glob and raw imports the build uses.

### Config

- The gate list in the ticket worktrees config points at the two scripts. The prepare hook reads command strings and is unchanged. The spec session makes that edit after each ticket lands (Q4); the typecheck line stays `npm run typecheck`, which ticket 01 repoints in package.json.

## Testing Decisions

- The typecheck script's two correctness tests run on a fixture project under a temp folder: warm run after a planted error exits non-zero; a seeded stale file still reports the error.
- The build script's classifier is a pure function over a path list, tested with tests-only, docs-only, mixed and source lists.
- The skip-set source test guards the classifier against the bundle's inputs.
- Timing: the ticket's Answer records cold, warm and seeded typecheck times and a tests-only prepare's total, measured once with no other prepare running.

## Out of Scope

- `pool: 'threads'` with `isolate: false`, happy-dom, or any vitest config change. A separate measured experiment.
- TypeScript 7 native tsc. Blocked on typescript-eslint's API.
- Changes to the global prepare hook or the lock.
- Project references.
- Skipping the build for docs-only changes, the changelog excepted (Q6).

## Review 2026-10-04

All three tickets landed (`cce89f30`, `2202b571`, `93e804b8`) and match the spec. Both script test files pass (24 tests); the planted-error guards fail as required. A tests-plus-changelog ticket's gates: typecheck 9.4 s seeded, lint 1.2 s, affected tests 34 s, build skipped, about 45 s against 232 s before. Findings, none blocking: the changelog skip is by path, so an edit to a released section would skip a build the bundle reads (the slice and format tests still run); `path.matchesGlob` is experimental below Node 22 and may print a warning there (unverified, this machine runs 24); the skip line's wording could be plainer.

## Further Notes

- The 69 s typecheck in the ticket 02 log was contention from a parallel prepare. The lock already serializes prepares; the cold run alone is 24 s.
- The existing root `tsconfig.tsbuildinfo` is the minimal `{root, errors, version}` form from a non-incremental run and reuses nothing. The script may delete it on first run.
