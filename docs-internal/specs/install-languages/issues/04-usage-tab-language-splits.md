# 04: Language Splits On The Usage Tab

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/install-languages/spec.md` (Usage tab)

Model rationale: one more breakdown in an existing admin view, against a response shape the spec fixes.

## What to build

The Usage tab (`src/components/menu/UsageTab.tsx`) shows the Device Language and AI Language splits for each month, beside the existing breakdown, with the same collapsing segments. It reads the `languages` field the spec defines. A response without the field shows no language split.

## Acceptance criteria

- [ ] Each month shows a Device Language split and an AI Language split.
- [ ] A response without `languages` renders as before.
- [ ] Labels follow the writing guide and the design system.
- [ ] Verified on the dev-router in both themes.
