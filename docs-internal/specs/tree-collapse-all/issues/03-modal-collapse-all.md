# 03: Collapse All in the Entity and Dictionary Editor Modals

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: two modals reuse ticket 01's List Editor button with modal-owned state.

## What to build

The Entity Editor modal's tree lists and the Dictionary Editor modal's book tree get the Collapse All button (Q2). Each modal owns its collapsed sets while it is open (Q4). The Entity Editor's lists use their own item noun (Q6). The disabled rules from ticket 01 apply unchanged.

- Changelog: a fragment `docs-internal/changelog.d/tree-collapse-all-03.md`, folded into the same entry.

## Acceptance criteria

- [ ] In the Entity Editor modal, Collapse All hides a list's child rows and Expand All shows them (existing modal test file)
- [ ] In the Dictionary Editor modal, Collapse All hides the book tree's child rows and Expand All shows them (existing modal test file)
- [ ] Closing and reopening a modal starts with every row expanded (modal test)
