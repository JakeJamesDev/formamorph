# 09: Affected-Only Ticket Gates

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: ~/.claude (prepare command) and formamorph (gate config, protocol, test classification)
Spec: ../spec.md (Rulings Q11, Q29, Q41, Q42, Q43)

Model rationale: a test-selection change where a wrong call lets a regression land silently. Deciding which tests escape the module graph needs judgment.

## What to build

A ticket's gates run only the tests that its change can affect. Ticket 16's prepare took 199 s of gates, and 137 s of that was the full `vitest run`. Over many tickets that adds up to hours with no benefit.

**Prepare fills in `{base}`.** In a gate command, `{base}` becomes the full `main` sha that prepare rebased onto. After the rebase, `main...HEAD` is exactly the ticket's change. This is the only change to the global prepare command.

**Formamorph's test gate uses vitest's `--changed`.** Vitest 3.2.6 runs only the test files that import a changed file, directly or through other files. It runs the full suite by itself when a file every test depends on changes: `setupFiles`, the vite config and everything it imports, `package.json`, and `.env` files.

**Tests outside the module graph always run.** Some tests read source files from disk instead of importing them, for example source scans, bundle-boundary checks, copy guards, and docs coverage. `--changed` never selects those. Classify every test file that reads files from disk:
- **Always-run:** its result depends on files it doesn't import. It goes on an always-run list that the test gate runs every time.
- **Graph-covered:** it reads only fixtures next to it, so the module graph is enough.

The list lives in one place, and a check fails when a new disk-reading test file is on neither list.

**Lint runs on the changed files only.** Typecheck and build stay full (Q41).

**The Implement protocol runs the gates once.** Step 4 no longer runs a separate full gate pass before the review. It uses the same affected-only gates, so a ticket never pays for the full suite twice.

**The full suite still runs at release time.** `ship-check` and `release` keep the full suite.

## Acceptance criteria

- [ ] `{base}` in a gate command is replaced with the full `main` sha that prepare rebased onto. A test proves it, and the guard is proven by mutation.
- [ ] Formamorph's gate config runs `vitest related --run` on the changed files, their path-trigger and CommonJS hits, and the always-run list (Q42, Q43), lint on the changed files, and full typecheck and build.
- [ ] Every test file that reads files from disk is classified, with a one-line reason for each always-run entry.
- [ ] A check fails when a disk-reading test file is unclassified, and that is proven by adding one.
- [ ] A change to `src/test/setup.ts` runs the full suite. A change to one component runs only its related tests plus the always-run list. Both are shown with real runs.
- [ ] Gate time for a small ticket is measured before and after, both on an idle machine, and reported.
- [ ] The Implement protocol's step 4 runs the gates once, and the FormamorphServer copy still matches.
