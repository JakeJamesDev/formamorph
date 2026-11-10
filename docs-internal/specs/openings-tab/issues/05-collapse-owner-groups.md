# 05: Collapse Owner Groups

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one tab's list loses a filter and gains collapsible rows, with the Collapse All button already built.

## What to build

The Openings tab trades its Starting Location filter for collapsible groups (Q24, Q25).

- **Drop the filter** (Q24): remove the Starting Location select, its "None of these openings come up at …" pane note, and the `filter` argument of `openingsEditorView`. A row's count is the owner's authored openings (supersedes Q17). In a world with more than one start, an Others opening shows a dash for its chance. A single-start world keeps its percentages.
- **Collapsible rows** (Q25): every row with children gets the tree chevron, owner rows and dim context rows alike, in both the location and entity trees. This World and the rule between the trees do not collapse.
- **Collapse All**: `CollapseAllButton` right of the search, noun "groups" ("Collapse all groups"). It folds every parent when any is open, and opens them all otherwise.
- **State**: collapsed rows are session editor state, like the selection. The list opens with every row expanded.
- **Search**: while search has text, a collapsed parent with a matching row inside shows that row, so a match is never hidden.
- **Selection**: collapsing a parent keeps a selected owner inside it selected, with its pane, as Q16 does for search.
- Docs and the changelog fragment drop the filter and describe the collapse. Add a fragment as `docs-internal/changelog.d/openings-tab-05.md`.

## Acceptance criteria

- [ ] No Starting Location filter in a world with several starts; counts are authored openings; an Others card shows a dash in a multi-start world and a percentage in a single-start world (editor-bench test)
- [ ] A parent's chevron hides and shows its rows, for a location and an entity folder (editor-bench test)
- [ ] Collapse All folds every parent, then opens them all, and its name follows (editor-bench test)
- [ ] Search shows a match inside a collapsed parent (editor-bench test, mutation-tested: dropping the search rule turns it red)
- [ ] Collapsing the selected owner's parent keeps the selection and pane (editor-bench test)
- [ ] Frame at 1280×800 dark on Fantasy Futanari with some groups collapsed
- [ ] Openings wiki page updated; changelog fragment written
