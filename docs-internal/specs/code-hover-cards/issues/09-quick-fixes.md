# 09: Quick Fixes

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Structured fixes through about ten diagnostic sites plus three UI paths. Opus at high: it touches every name check.

## What to build

An error with a fix offers it three ways: a button in the error card, Ctrl+. at the caret, and a lightbulb in the gutter in full screen only. A diagnostic gains a machine-readable fixes list, and the "did you mean" suggestion becomes the first fix. Every check that puts a suggestion into its message text routes it through the plumbing that tags a missing name. A suggested name with a space rewrites a dot form into a bracket form with the rename offer's key splice, exported for this. The lightbulb has its own gutter beside the lint gutter.

Spec: Q5, Q7; Implementation Decisions: Fixes in diagnostics, Lightbulb.

## Acceptance criteria

- [ ] Each suggestion site yields a fix with the right replacement; one test per site
- [ ] `stats.Helth` offers Change to Health; a name with a space rewrites to bracket form
- [ ] The card button, Ctrl+. and the full-screen lightbulb apply the same fix; the compact box shows no lightbulb
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
