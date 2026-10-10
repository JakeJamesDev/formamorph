# 05: Native-Title Lint on the Account Site

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Haiku 5.5 (`claude-haiku-5-5`)
Reasoning effort: low

Rationale: a lint scope change with no conversions expected.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

The native-title lint rule covers the account site as well as the game sources, so a browser tooltip can't come back there (Q6). A scratch run on 2026-10-09 found no violations.

## Acceptance criteria

- [ ] The rule runs on the account site's sources.
- [ ] A native `title` on a DOM element in the site fails lint. Check this once by hand, then remove the probe.
- [ ] Lint is green.
