# 03: Give the Code Editor a Surface and JSON Highlighting

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

A prefactor. The stat-code editor and everything that reads its name list take a **surface** as input: the list of reachable names with their kinds and hints. Completions, diagnostics, the Variable menu and the "what's available" hint all read that one list. Stat code passes the surface it uses today and behaves exactly as before.

The read-only highlighter gains a language option. JSON highlighting reuses the existing `tok-*` classes so both themes work without new colors. Add the JSON language package at the version current on npm at build time, checked live.

Model rationale: Sonnet at medium effort suits a mechanical parameterization with an existing test suite to keep green.

## Acceptance criteria

- [ ] The editor, analysis, completion and Variable-menu code take a surface parameter; no stat-code-specific list is assumed inside them.
- [ ] Stat code tests pass unchanged; the stat-code editor shows the same completions, diagnostics and hint as before.
- [ ] The read-only highlighter renders JSON with token classes that read correctly in both themes; a test covers a JSON sample in each theme.
- [ ] The package version is verified live from npm and recorded in the commit body.
- [ ] Four gates green.
