# 18: Drop Item Script Hits in Simple Mode

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one mode filter on one kind of hit, with existing search tests beside it.

## What to build

In Simple mode the item's Scripts panel tab is hidden. A **Search World** hit in an item script still counts, but it opens the item on Profile and marks nothing. Ruling Q13: that hit drops in Simple mode. It returns in Advanced mode. Every other Items hit stays in both modes.

Spec: Q13, Implementation Decisions "Search World".

## Acceptance criteria

- [ ] A test that searches text found only in an item script in Simple mode fails today (one hit), then passes with no hits
- [ ] The same search in Advanced mode finds the hit and opens the item's Scripts panel tab (test)
- [ ] An item's name and description hits stay in Simple mode (test)
- [ ] The WorldEditor page's search sentence says item scripts are searched in Advanced mode only; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
