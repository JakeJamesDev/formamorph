# 02: Collapse All on the Other Tree Tabs

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: six adapters plug into machinery ticket 01 built, each with a noun and a bench test.

## What to build

Entities, Stats, Traits, Placeholders, Dictionary and Scripts get the Collapse All button from ticket 01 (Q2). Each tab uses its own collapsed set in the World Editor's per-tab store. Nouns (Q6): entities, stats, traits, placeholders, entries, scripts.

- Each adapter supplies its noun and whether its tree has parent rows.
- Collapsing one tab leaves every other tab's collapsed set alone (Q1).
- Changelog: fold into ticket 01's entry if it is still unreleased, through a fragment `docs-internal/changelog.d/tree-collapse-all-02.md`.

## Acceptance criteria

- [x] On each of the six tabs, Collapse All hides child rows, Expand All shows them, and the tooltip names the tab's noun (editor-bench test per tab) — `WorldEditor.treeCollapseTabs.test.tsx`, `describe.each` over the six tabs
- [x] Collapsing Entities leaves the Locations tree open, and the reverse (editor-bench test) — "leaves the Locations tree open when Entities collapses, and the reverse"
- [x] A tab whose tree has no parent rows shows the button disabled (editor-bench test) — "is disabled on a world with no parent rows", per tab

## Landed

**Not verified:** no Simple-mode test (a Simple-mode world has no groups, so every tab shows the button disabled). Outside-navigation reveal is tested on Dictionary only; the other tabs share ticket 01's `requestReveal` path.

**For you:**

- Open the World Editor on a world with groups and press Collapse All on each of the six tabs. On Dictionary, one press closes the book and its Background/Foreground zones; opening the book by hand leaves the zones closed.
