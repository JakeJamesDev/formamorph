# 07: Migrate native scrollers to ScrollArea

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every pane the sweep tagged migration-candidate scrolls through the shared ScrollArea, with the Design System scrollbar, and the tag is gone.

- Work the files that carry the migration-candidate allow comment, the Minimal chat column and the dialog bodies among them. Each one moves to ScrollArea and drops its comment.
- Each pane gets a static browser check on the dev-router at a realistic viewport: the content scrolls, the header and footer stay put where the pane had them, focus and keyboard scrolling still work, and the top fade or sticky parts the pane had are kept. Known traps: the ScrollArea viewport is the scroller, and a ScrollArea needs a definite height.
- A pane that cannot move keeps a comment under one of the other named exceptions with the reason. No file keeps migration-candidate.
- The exception table in the Design System drops migration-candidate, or keeps it only for new work with that stated.

Spec: Q21, Q30.

Recommended model rationale: many unrelated panes, each with its own layout constraint and a browser check; regressions are visual and easy to miss.

## Acceptance criteria

- [ ] No source file carries the migration-candidate comment; the guard stays green.
- [ ] Each migrated pane has a verify-ui check recorded in the ticket thread: scrolls, header and footer kept, keyboard scroll works.
- [ ] Existing render tests for the migrated panes pass without weakening; a test that targeted the native scroller now targets the viewport.
- [ ] The Design System table matches. The four gates are green.
