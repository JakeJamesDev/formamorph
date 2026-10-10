# 01: Close Tips on Scroll

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: one listener and one wrapper in a small module, with focused tests at an existing seam.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

A scroll anywhere closes the open tip, so a tip never slides off the screen with its control (Q1, Q2). The tooltip module gets one dismissal hook. `TooltipProvider` uses it for the shared root that every `Tip` uses. The exported `Tooltip` root becomes a wrapper that uses the same hook, so the three hand-built rich tips get the rule with no call-site edits. Later tickets add triggers to this hook.

## Acceptance criteria

- [ ] A scroll on the document closes an open `Tip`.
- [ ] A scroll on a nested scroll container closes an open `Tip`.
- [ ] A rich tip built on the exported `Tooltip` root closes on scroll.
- [ ] A tip opens normally again after the scroll.
- [ ] Tests at the tooltip seam. Each fails when its listener is removed.
