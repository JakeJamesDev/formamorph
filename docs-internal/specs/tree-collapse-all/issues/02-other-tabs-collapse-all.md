# 02: Collapse All on the Other Tree Tabs

Status: ready-for-agent
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

- [ ] On each of the six tabs, Collapse All hides child rows, Expand All shows them, and the tooltip names the tab's noun (editor-bench test per tab)
- [ ] Collapsing Entities leaves the Locations tree open, and the reverse (editor-bench test)
- [ ] A tab whose tree has no parent rows shows the button disabled (editor-bench test)
