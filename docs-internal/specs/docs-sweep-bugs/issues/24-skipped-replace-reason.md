# 24: A Skipped Tool Rename Names Its Reason

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: the check returns its reason and one notice shows it, under the Writing Guide.

## What to build

A single Replace that skips a Tool name reads "Skipped: <Tool> can't take that name", which doesn't say what is wrong. Ruling Q20: that notice names the reason from the **Save Tool** check, such as a duplicate name. Replace All keeps its count.

Spec: Q20. Evidence: docs-sweep-bugs standards findings.

## Acceptance criteria

- [ ] A find-bar test of a single Replace to a duplicate Tool name fails today (no reason), then passes with the check's reason
- [ ] Each reason the check can give reaches the notice (test)
- [ ] Replace All's skipped count is unchanged (existing test green)
- [ ] The notice follows the Writing Guide; the copy sweep ran on it
- [ ] A changelog fragment under Minor / Fixed / 👤
