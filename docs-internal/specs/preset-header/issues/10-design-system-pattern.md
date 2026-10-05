# 10: Design System pattern

Status: done
Blocked by: 01, 05, 06, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Design System documents the preset header as a pattern with a live reference.

- A "Pattern: Preset Header" section: composition, production mapping, responsive behavior, state reference (editable, built-in, narrow, each reachability state) and writing review.
- A showcase reference renders the header in both widths and every state, plus the Reset and Compare pair in its footer and label-row placements.
- The design-system e2e smoke covers the reference.

Spec: Implementation → Design System.

Recommended model rationale: documentation and a static reference built from finished components.

## Acceptance criteria

- [ ] The pattern section is in the Design System doc with every subsection.
- [ ] The showcase reference renders both widths and every state.
- [ ] The design-system e2e smoke passes on the reference.
