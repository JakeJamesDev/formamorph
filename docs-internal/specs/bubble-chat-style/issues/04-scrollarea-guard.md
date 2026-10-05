# 04: ScrollArea guard

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A native overflow scrollbar in a component fails the gates, so the Design System's scrollbar standard stops slipping.

- A lint rule or a small test flags a native overflow scroller (`overflow-auto`, `overflow-y-auto`, `overflow-x-auto`, or the inline style) in a component file unless that file uses the shared ScrollArea, or carries a one-line allow comment naming the Design System exception it relies on (editors, virtualizers, drag lists).
- Every existing offender either moves to ScrollArea or gets the allow comment with its reason. The sweep lands with the guard.
- The Design System doc's scrollbar section names the guard and the allow comment form.

Spec: Q21.

Recommended model rationale: a pattern check plus a mechanical sweep; prior art in the repo's other source-scanning tests.

## Acceptance criteria

- [ ] A fixture with a native overflow scroller and no ScrollArea or allow comment fails the guard; one with ScrollArea passes; one with the allow comment passes.
- [ ] Guard bites: reinstating a native scroller in a component turns the gate red.
- [ ] The sweep leaves no unexplained native scroller in components.
- [ ] The Design System doc names the guard. The four gates are green.
