# 03: Give the Code Editor a Surface and JSON Highlighting

Status: ready-for-human
Base: 5f80e245
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

## Comments

- **2026-09-25, implementation.** Built in `e400dc24`, with review fixes in the commit after it. Notes for the next tickets:
  - `CodeSurface` lives in `src/lib/codeSurface.ts`: globals, hidden globals, built-ins, a `members` map keyed by the exact expression before a dot (use one key per nested path, such as `world.scene`), language names, the Variable-menu snippets, the message `label` and the `missingReturn` warning.
  - The `stats`, `self`, `placeholders` and `traits` rules still live in the analysis. They apply only when a surface lists that global. A Tool surface must not list those names.
  - The "what's available" hint does not read the surface yet. Stat code's hint is the editor's placeholder text and did not change. Ticket 08 owns the Tool hint and should build it from `surface.globals`.
