# 01: Edge Rail On The Desktop Editor

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: a new navigation component, a registry change, the desktop layout's tab root moving outside the card, a disclosure widget extracted from Enter World and shared, a Design System pattern with its showcase, and tests at four seams; the tab-root move has to keep thirty existing editor tests green.

The rail from the prototype branch `prototype/world-editor-tabs` at `?variant=E` (commit 45aeac43 and later). The prototype used plain buttons; this build makes the rail a true tab list (Q5).

## What to build

On desktop, the World Editor's top-level tabs leave the list card. A full-height rail on the editor's outer left edge, outside every card, shows one icon per tab in the order the registry gives: World (Overview, Stats, Entities, Locations, Traits), then a separator, then Text (Dictionary, and Placeholders in Advanced mode). Logic is in the registry but has no tab yet, so it draws nothing, not even its separator (Q2). The list card holds the toolbar and the tab panels and no strip (Q1).

The rail is the tab root's vertical tab list; each icon is a tab trigger named by its tab label; arrow keys move along it (Q5). Hovering or focusing an icon flies out "Group · Tab", for example "World · Entities"; the flyout takes no pointer events (Q3). The active icon carries a primary accent bar on the rail's edge and foreground color; the others are muted (Q4). While the Test Bench is embedded in the list card, the rail stays drawn with every trigger disabled (Q9).

Mobile drops the horizontal strip. Under the header a full-width **Sections** disclosure bar shows a tree icon, the label, the current tab's name at the right and a chevron; opening it expands the grouped tab list below with group captions, with the grid-rows reveal and `inert` while closed; picking a tab closes it (Q12). The bar is the Enter World flow's collapsed Categories widget, extracted to a shared component that both screens render; Enter World's behavior and tests are unchanged.

The tab registry carries a group id and an icon per tab and exports the ordered groups with a helper that returns the groups for a mode with their visible tabs, dropping empty ones. The dev-router guard keeps checking its ledger against the registry.

The Design System guide gains "Pattern: Edge Rail" with a showcase entry, landed with the rail (Q11). The World Editor guide's wording changes from a strip to the rail where it names the strip. One changelog fragment, Minor Added, 👤.

Desktop verified in the preview at 1600x900 with both themes; mobile at 375px with the Sections bar closed and open.

## Acceptance criteria

- [ ] Desktop Advanced: the rail shows seven triggers in registry order with one separator between Traits and Dictionary and none after Placeholders; the list card has no tab strip.
- [ ] Desktop Simple: six triggers; Text holds Dictionary alone.
- [ ] Each trigger's accessible name is its tab label; the active one is selected and carries the accent marker.
- [ ] Hovering or focusing the Entities trigger shows "World · Entities".
- [ ] Clicking a trigger shows that tab's list; arrow keys move selection along the rail.
- [ ] With the Bench embedded, every rail trigger is disabled and the editor's active tab is unchanged.
- [ ] Mobile: no strip. A Sections bar names the current tab; closed, its body is inert; open, it lists the grouped tabs with captions; picking Entities shows the Entities list and closes the bar.
- [ ] The Sections bar and Enter World's Categories bar render through one shared component; the Enter World workspace tests pass unchanged.
- [ ] Registry test: groups for Simple and Advanced as ruled; Logic absent in both; the dev-router ledger guard passes unchanged.
- [ ] Rail component tests cover triggers, separators, flyout text, active marker, change handler, and disabled state.
- [ ] Existing World Editor tests that select a top-level tab by role pass unchanged.
- [ ] Guard bites: a Logic group with no tabs rendered draws nothing; reinstating the separator turns the empty-group test red.
- [ ] "Pattern: Edge Rail" in the Design System guide with a showcase entry.
- [ ] World Editor guide wording updated; changelog fragment written.
- [ ] Desktop verified at 1600x900 in both themes; mobile at 375px closed and open; no export-shape change.
- [ ] Gates green; graph updated.

## Blocked by

- None (can start immediately)
