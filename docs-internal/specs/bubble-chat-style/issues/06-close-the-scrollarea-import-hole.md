# 06: Close the ScrollArea import hole

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A native scroller fails the guard even in a file that imports ScrollArea.

- The guard drops the ScrollArea-import exemption. Every file with a native overflow scroller needs the one-line allow comment, named exception and reason, or it fails.
- The files that mix ScrollArea with native scrollers today (the editor instruments and the stat code template dialog among them) either move the scroller to ScrollArea or carry the comment with a reason.
- The Design System's Scroll guard section loses the sentence about the import.

Spec: Q21, Q29.

Recommended model rationale: a one-condition change in a pure check, a short sweep, and a doc edit.

## Acceptance criteria

- [ ] Fixture test: a file that imports ScrollArea and holds a native scroller with no allow comment fails; with the comment it passes.
- [ ] Guard bites: restoring the import exemption turns the fixture test red.
- [ ] The sweep leaves no mixed file without a comment or a migration.
- [ ] The Design System section matches. The four gates are green.
