# 01: Edge Rail On The Desktop Editor

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: a new navigation component, a registry change, the desktop layout's tab root moving outside the card, a Design System pattern with its showcase, and tests at three seams; the tab-root move has to keep thirty existing editor tests green.

The rail from the prototype branch `prototype/world-editor-tabs` at `?variant=E` (commit 45aeac43 and later). The prototype used plain buttons; this build makes the rail a true tab list (Q5).

## What to build

On desktop, the World Editor's top-level tabs leave the list card. A full-height rail on the editor's outer left edge, outside every card, shows one icon per tab in the order the registry gives: World (Overview, Stats, Entities, Locations, Traits), then a separator, then Text (Dictionary, and Placeholders in Advanced mode). Logic is in the registry but has no tab yet, so it draws nothing, not even its separator (Q2). The list card holds the toolbar and the tab panels and no strip (Q1).

The rail is the tab root's vertical tab list; each icon is a tab trigger named by its tab label; arrow keys move along it (Q5). Hovering or focusing an icon flies out "Group · Tab", for example "World · Entities"; the flyout takes no pointer events (Q3). The active icon carries a primary accent bar on the rail's edge and foreground color; the others are muted (Q4). While the Test Bench is embedded in the list card, the rail stays drawn with every trigger disabled (Q9).

Mobile keeps its horizontal scrolling strip, rendered from the same registry (Q6).

The tab registry carries a group id and an icon per tab and exports the ordered groups with a helper that returns the groups for a mode with their visible tabs, dropping empty ones. The dev-router guard keeps checking its ledger against the registry.

The Design System guide gains "Pattern: Edge Rail" with a showcase entry, landed with the rail (Q11). The World Editor guide's wording changes from a strip to the rail where it names the strip. One changelog fragment, Minor Added, 👤.

Desktop verified in the preview at 1600x900 with both themes; mobile checked at 375px to confirm the strip is unchanged.

## Acceptance criteria

- [ ] Desktop Advanced: the rail shows seven triggers in registry order with one separator between Traits and Dictionary and none after Placeholders; the list card has no tab strip.
- [ ] Desktop Simple: six triggers; Text holds Dictionary alone.
- [ ] Each trigger's accessible name is its tab label; the active one is selected and carries the accent marker.
- [ ] Hovering or focusing the Entities trigger shows "World · Entities".
- [ ] Clicking a trigger shows that tab's list; arrow keys move selection along the rail.
- [ ] With the Bench embedded, every rail trigger is disabled and the editor's active tab is unchanged.
- [ ] Mobile: the horizontal strip renders as before from the same registry.
- [ ] Registry test: groups for Simple and Advanced as ruled; Logic absent in both; the dev-router ledger guard passes unchanged.
- [ ] Rail component tests cover triggers, separators, flyout text, active marker, change handler, and disabled state.
- [ ] Existing World Editor tests that select a top-level tab by role pass unchanged.
- [ ] Guard bites: a Logic group with no tabs rendered draws nothing; reinstating the separator turns the empty-group test red.
- [ ] "Pattern: Edge Rail" in the Design System guide with a showcase entry.
- [ ] World Editor guide wording updated; changelog fragment written.
- [ ] Desktop verified at 1600x900 in both themes; mobile at 375px; no export-shape change.
- [ ] Gates green; graph updated.

## Blocked by

- None (can start immediately)
