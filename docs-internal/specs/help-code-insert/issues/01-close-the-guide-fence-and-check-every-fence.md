# 01: Close the Guide Fence and Check Every Fence

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), ruling Q16.

## What to build

The last code example in the Stat Code guide is never closed, and the help window sends that section to the model verbatim. Close it. Then add a docs check that fails when any fenced block in any bundled guide page is left open, named by page and line, so a broken example never reaches the model again. The check sits beside the existing route check in the docs checks.

A player who asks about that example now gets a well-formed section in the answer's context, and the probe's control batch runs on clean docs.

Workload: one docs edit and one small check with a fixture. A mid-size model at medium effort is enough.

## Acceptance criteria

- [ ] The Stat Code guide's final fence is closed and the page renders in the help reader with the example highlighted
- [ ] A docs check fails on an unclosed fence, naming the page and the opening line
- [ ] Every bundled page passes the check
- [ ] Guard bites: reopen the guide's final fence once and the check goes red
- [ ] Changelog line under In Progress, Fixed, 🛠️
