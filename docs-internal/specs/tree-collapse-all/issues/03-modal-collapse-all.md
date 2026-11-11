# 03: Collapse All in the Entity and Dictionary Editor Modals

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: two modals reuse ticket 01's List Editor button with modal-owned state.

## What to build

The Entity Editor modal's tree lists and the Dictionary Editor modal's book tree get the Collapse All button (Q2). Each modal owns its collapsed sets while it is open (Q4). The Entity Editor's lists use their own item noun (Q6). The disabled rules from ticket 01 apply unchanged.

- Changelog: a fragment `docs-internal/changelog.d/tree-collapse-all-03.md`, folded into the same entry.

## Acceptance criteria

- [x] In the Entity Editor modal, Collapse All hides a list's child rows and Expand All shows them (existing modal test file) — `EntityEditorModal.stats.test.tsx` and `.traits.test.tsx`
- [x] In the Dictionary Editor modal, Collapse All hides the book tree's child rows and Expand All shows them (existing modal test file) — `DictionaryEditorModal.entryTabs.test.tsx`
- [x] Closing and reopening a modal starts with every row expanded (modal test) — Stats and Dictionary tests; removing the reset fails the Stats test

## Landed

**Not verified**
- The Placeholders tab in both modals has the button but no test: its fixtures hold no parent rows, so the button would read disabled.
- No visual check in the live preview.

**For you**
- Entity Editor modal, Stats, Traits and Placeholders tabs: the button sits right of the search and keeps its folds across tab switches.
- Dictionary Editor modal, Dictionary tab: close both zones by hand and the button reads Expand all.
- The Dictionary Editor modal's Placeholders tab also got the button (not in the ticket; Q2 says every List Editor tree).
