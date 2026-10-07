# 01: Filter Wording On Editor Lists

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a copy change across six list adapters, their tests, one glossary entry and two help pages; mechanical and contained.

## What to build

Each World Editor list box reads "Filter" and the plural of what the list holds: **Filter Stats**, **Filter Entities**, **Filter Locations**, **Filter Traits**, **Filter Dictionaries**, **Filter Placeholders**. Typing still filters the list and names the item the + adds. The Entity Editor and Dictionary Editor modals keep "Search or add new …".

The glossary's List Editor entry changes "a search box with the **+** control" to "a filter box with the **+** control (a search box in the Entity Editor and Dictionary Editor modals)". The Locations and Stats help pages name the new box text.

Changelog fragment: the World Editor's list boxes read Filter, apart from the coming header search (ticket 04 owns the lead for the header; this fragment folds into it if it lands first).

From the prototype branch `prototype/editor-header-search` (commit `354d08eb`).

## Acceptance criteria

- [ ] All six World Editor list boxes show their Filter text; typing filters and the + still adds the typed name.
- [ ] The two editor modals keep "Search or add new …".
- [ ] Every test that queried "Search or add new …" on a World Editor list queries "Filter …" instead; no assertion is weakened.
- [ ] The glossary entry and the Locations and Stats help pages match the new text.
- [ ] Four gates green.
