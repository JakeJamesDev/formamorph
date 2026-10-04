# 03: Changelog skips the build

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A ticket that changes only tests and its changelog line skips the Vite build.

- `docs/Changelog.md` joins the build gate's skip set (Q6). Every other docs file still builds.
- The skip-set source test asserts no skip pattern matches a bundle input. The changelog is a bundle input by design, so the test carries that one named allowance and still refuses any other docs path in the skip set.
- The gate's skip message names the changelog when it was among the changed files.
- The ticket's Answer records a tests-plus-changelog prepare total, measured with no other prepare running, next to the 232 s ticket 01 measured with the full build.

Spec: Q6; Implementation → Build gate.

Recommended model rationale: a one-pattern change with a test allowance to word precisely.

## Acceptance criteria

- [ ] A diff of test files plus the changelog skips the build and says so.
- [ ] A diff with any other docs file builds.
- [ ] The source test allows only the changelog and fails when another docs path is added to the skip set.
- [ ] Prepare total for a tests-plus-changelog ticket in the Answer.
- [ ] The four gates are green.

## Answer

Landed: `docs/Changelog.md` joins `SKIP_PATTERNS` in `scripts/buildDecision.mjs`, and `describeSkip` words the skip line. `scripts/buildDecision.test.mjs` carries one named allowance (`ALLOWED_BUNDLE_INPUTS`) and refuses any other docs path.
The allowance holds because the bundle takes only the released slice of the changelog (`changelogSlice.test.ts` and `bundledDocsIndex.test.ts` assert In Progress stays out). A ticket that edits a released section would skip the build wrongly; the gate classifies by path, not by hunk.

Gates run by hand against a synthetic tests-plus-changelog diff (one test file and the changelog), 48 test files selected, no other prepare started by this session:

```
$ npm run typecheck                         exit 0,   9.4 s (seeded)
$ node scripts/changedLint.mjs <base>        exit 0,   1.2 s
$ node scripts/affectedTests.mjs <base>      exit 0,  34.2 s (715 tests)
$ node scripts/buildGate.mjs <base>          exit 0,   0.2 s
build skipped: no bundle file changed, docs/Changelog.md among them (2 changed files since <base>)
```

Gate total about 45 s, against the 232 s ticket 01 measured with the full build. This is the sum of the four gates, not a prepare run: the squash and rebase are extra, and this ticket itself builds because it edits scripts. Peer sessions were busy, so the affected-tests time may run high.
