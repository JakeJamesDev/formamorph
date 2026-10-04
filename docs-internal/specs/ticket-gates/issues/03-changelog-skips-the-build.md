# 03: Changelog skips the build

Status: ready-for-agent
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
