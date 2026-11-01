# 07: Search World Covers Items, Scripts and Tools

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: three new search sources, each with its own fields and its own jump-to target in the editor.

## What to build

**Search World** skips the Items, Scripts and Tools tabs. Add them to the search sources. Items search their name, descriptions, unidentified name and description, and image tags. Scripts search their name and code. Tools search their name, description and parameter descriptions. Each hit opens its row through the editor's existing search-target navigation, as hits on other tabs do. Media holds no text of its own and stays out.

Spec: Implementation Decisions "Search World". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [ ] A world-search test with text only in an item, a script and a Tool fails today (no hits), then passes with one hit on each tab
- [ ] A hit on each new tab opens that tab with its row selected (component test)
- [ ] Each new field obeys the current Simple/Advanced mode, as the other tabs' fields do (test)
- [ ] The WorldEditor page's search sentence lists the searched tabs and says Media holds no searchable text; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
