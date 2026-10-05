# 07: Migrate native scrollers to ScrollArea

Status: done
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

## Verification

Playwright in Chromium on the dev router, 1280x800, then with 28px root text to force overflow. "Scroll" is the viewport's reach in px; header and footer rects are unchanged after scrolling to the end in every row.

| Route | Scroll | Keyboard |
| --- | --- | --- |
| `ageGate` | 53 | Tab to the body, arrows: 53 |
| `privacyPolicy` | 130 | Tab to the body, arrows: 130 |
| `customCode` | 3462 | Tab to the body, arrows: 376 |
| `worldPrompts` | 3921 | Tab to the panel, arrows: 180 |
| `designSystem` | 6164 | Tab to a panel, arrows: 1462 |
| `modelDetails` | 282 | Tab to the last slider reveals it |
| `eventForm` | 1657 | Tab to the last field reveals it |
| `podium` | 408 | Tab to the last control reveals it |
| `feedbackForm` | 531 | Tab to the editor, arrows: 531 |
| `feedbackEdit` | 166 | Tab to the editor, arrows: 166 |
| `changelogEntry` | 2026 | Tab to the editor, arrows: 1676 |
| `fontTune` | 432 | Tab to the last slider reveals it |
| `revealDemo` | 562 | Tab to the last control reveals it |
| `presetImport` (Overview) | 702 | Tab to the Overview, arrows: 445 |
| `generateImage` | 148 | Tab to the last field reveals it |
| `placeholderPicker` | 1456 | Tab to the last row reveals it |
| Minimal chat (40-line answer) | 1012 | Follows the end; top fade and scroll arrow kept |

- `eventAck`: the canned body fits; `e2e/event-poster-fit.spec.ts` passes on the long body through the viewport's test id.
- `sentMessages`: loads from the server, so with none it shows its empty state and does not overflow. Its layout is the same header-plus-`flex-1 min-h-0` body as the rows above.
- e2e `formaquestion.spec.ts` passes (37). In `design-system.spec.ts` the mobile Prompt Chips width check fails at 923px on main too; the `formaquestion-mascot.spec.ts` failures wait for the Minimal column under the Bubble default, and `locations-reference.spec.ts` fails on a font fetch.
