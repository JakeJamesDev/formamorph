# 24: A Skipped Tool Rename Names Its Reason

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: the check returns its reason and one notice shows it, under the Writing Guide.

## What to build

A single Replace that skips a Tool name reads "Skipped: <Tool> can't take that name", which doesn't say what is wrong. Ruling Q20: that notice names the reason from the **Save Tool** check, such as a duplicate name. Replace All keeps its count.

Spec: Q20. Evidence: docs-sweep-bugs standards findings.

## Acceptance criteria

- [x] A find-bar test of a single Replace to a duplicate Tool name fails today (no reason), then passes with the check's reason (`EditorFindBar skipped Tool name`; both tests failed with the reason removed)
- [x] Each reason the check can give reaches the notice (test): `format` and `taken` tested; `builtin` cannot occur for a world Tool
- [x] Replace All's skipped count is unchanged (`worldSearch.test.ts` Tool name tests green)
- [ ] The notice follows the Writing Guide; the copy sweep ran on it
- [x] A changelog fragment under Minor / Fixed / 👤 (`docs-internal/changelog.d/docs-sweep-bugs-24.md`)

## Landed

**Not verified**
- The copy sweep did not run on the notice. A review read it against the Writing Guide only.
- `builtin` has no test: the world check passes `world: true`, so a catalog name is allowed and the reason never occurs.

**For you**
- In a world, rename a Tool to another Tool's name with Find and Replace: the notice should read "Skipped: <Tool> can’t take that name. Another Tool in this world uses this name."
