# Spec: Setup Nav Fallthrough

Status: ready-for-agent
Spec session: setup-nav-fallthrough — spec

The Enter World setup screen shows one trait group per page. A world with many characters, each with nested trait groups, makes the player click every group to see its traits. This spec makes a parent row in the setup nav open its whole subtree on one page, and makes the nav collapsible. The nav collapses itself, level by level, when it would otherwise scroll.

## Problem Statement

On the Enter World screen, each trait group is its own page in the left-hand category nav. A group that holds only child groups is a label the player can't click. For a world with a large cast, where every character owns nested groups (Appearance › Hair, Background › Origin), the player clicks through dozens of pages to see their choices. The nav itself also grows long enough to scroll, so the player loses track of where they are.

## Solution

Clicking an entity or a parent group in the nav opens one page with the whole subtree. The page shows the parent's own traits first, then each descendant group under a `LABEL ———` separator. Clicking a leaf group still opens only that group.

Every nav row with children gets a leading chevron that collapses or expands it. A collapsed row still shows the summed count of its subtree, and it marks a child group that needs more picks. When the screen opens, the nav collapses its deepest level of parents, checks whether it still scrolls, and repeats one level up until it fits. A Collapse All / Expand All button on the Starting Traits separator line is the manual fallback.

## Rulings

Settled in the grill and the prototype on 2026-11-17.

| # | Ruling |
|---|---|
| Q1 | A parent page shows its whole subtree: its own traits, then every descendant group in authored order, each under a separator. A leaf group shows only itself. Groups that are labels only today become clickable pages. |
| Q2 | The Starting Traits separator stays a plain label. Entities and top-level groups are the highest pages. No page lists every trait in the world. |
| Q3 | Only the nav collapses. Sections on the main panel are always expanded. |
| Q4 | Auto-collapse runs when the screen opens and again on every window resize, until the player toggles any chevron or the Collapse All / Expand All button. After that, the player's state stands. |
| Q5 | Auto-collapse never collapses an ancestor of the current page, so the highlighted row stays visible. |
| Q6 | Collapse state lasts for one Enter World setup and resets the next time the screen opens. |
| Q7 | A parent row shows the summed selected / total count of its whole subtree. If any group in the subtree is short of its minimum picks, the row shows a short marker. |
| Q8 | The row and its chevron are separate targets. The row navigates and the chevron toggles. Opening a collapsed parent does not expand it. |
| Q9 | Auto-collapse works one depth level at a time. It collapses every parent at the deepest remaining level together, then checks the fit again. |
| Q10 | On mobile the same rule fits the nav into its drawer, which is capped at 45% of the screen height. |
| Q11 | The Collapse All / Expand All button is an icon button at the right end of the Starting Traits separator line. It shows only when some row has children. |
| Q12 | A parent row shows the summed count even while expanded, because its page shows the whole subtree. |
| Q13 | One toggle button. It reads Collapse All while any parent is expanded, and that folds the nav to the top-level rows. Otherwise it reads Expand All, which opens every level. |
| Q14 | Each section on a subtree page keeps what that group's own page shows today: the player description, the pick rule, the "Choose N more" hint and the gates. |
| Q15 | A manual collapse beats Q5. If the player collapses an ancestor of the current page, it stays collapsed, and the collapsed row shows the current-page highlight. |
| Q16 | The loop stops at the top level. If the nav still scrolls with every parent collapsed, it scrolls. Top-level rows are never hidden. |
| Q17 | Nav style is prototype Variant A: a leading chevron slot on every row (empty on leaves), indentation by depth, and the count at the right end. The user approved the chevron row and the separator button as new patterns by picking Variant A. |
| Q18 | The short marker is the prototype's small dot on the `warning` theme token, labeled "Needs more picks" for screen readers, before the "N of M selected" count. (Ticket 01) |
| Q19 | The first section of a page keeps today's path descriptions (ancestors plus itself), so a leaf page is unchanged. Every later section shows only its own group's description. (Ticket 01) |
| Q20 | The trait cascade notice stays at the end of the page, as today. (Ticket 01) |
| Q21 | When the category index changes from outside (the host, the dev-router or the tour), the page becomes the nav node whose own category is that index. A page chosen by a click stays while the index is inside its subtree. (Ticket 01) |
| Q23 | A later section also shows the descriptions of the label-only groups between the page and it (the groups its separator names), each one once, on the first section under it, before its own. Follows Q14: nothing is lost by not clicking in. (Ticket 01) |
| Q24 | In auto, the protected set is fixed at each fit (open and resize). A later page change only opens ancestors the new page needs, and never re-collapses a row, so a row click never folds a row the player could see. (Ticket 02) |
| Q25 | Every row in the Starting Traits block gets the leading slot, General included. World Options, Persona, Starting Location and Library Additions stay as today. (Ticket 02) |
| Q26 | On mobile the fit runs on Enter World open and on resize, whether the drawer is open or closed, against 45% of the window height. The drawer opens already fitted. (Ticket 02) |
| Q22 | Ticket 01 exports the nav nodes on the trait workspace (group, depth, category index, whether it has children, ancestor ids, subtree category indices) and a pure subtree rollup. Ticket 02 builds on these. |

## User Stories

1. As a player, I want to click a character in the setup nav and see all of their trait groups on one page, so that I don't click through each group.
2. As a player, I want to click a group that holds only child groups, so that I can see all of its children at once.
3. As a player, I want each child group on a subtree page to have a labeled separator, so that I can tell where one group ends and the next begins.
4. As a player, I want a nested group's separator to name its path below the page (Martial / Weapon Style), so that I know which branch it belongs to.
5. As a player, I want a leaf group to still open on its own, so that I can focus on one choice.
6. As a player, I want each section to show its description and pick rule, so that I don't lose information by not opening the group alone.
7. As a player, I want each section to tell me when it needs more picks, so that I can fix it before I start.
8. As a player, I want to collapse a character or group in the nav, so that the nav stays short.
9. As a player, I want the nav to start collapsed just enough to fit my screen, so that I see the whole list without scrolling.
10. As a player on a large screen, I want the nav fully expanded when it fits, so that I see every group.
11. As a player, I want the deepest groups to collapse first, so that the top-level structure stays visible longest.
12. As a player, I want a collapsed row to show how many traits I picked across its subtree, so that I don't need to expand it to check.
13. As a player, I want a collapsed row to warn me when a group inside it needs more picks, so that collapsing never hides a blocker.
14. As a player, I want the page I'm on to stay visible in the nav, so that I keep my place.
15. As a player, I want to collapse the current page's parent by hand if I choose, so that the nav does what I tell it.
16. As a player, I want one button to collapse or expand everything, so that I can reset the nav quickly.
17. As a player, I want my manual collapse choices kept while I switch pages, so that the nav doesn't jump around.
18. As a player, I want a fresh layout the next time I open Enter World, so that old choices don't follow me to a different world.
19. As a player who resizes the window before touching the nav, I want it to refit, so that it still fits.
20. As a player who has toggled the nav, I want a resize to leave my choices alone, so that my layout isn't undone.
21. As a mobile player, I want the category drawer to fit without scrolling where possible, so that I can reach every character.
22. As a player, I want clicking a collapsed parent to open its page without expanding it, so that the nav stays as short as I left it.
23. As a keyboard or screen reader user, I want each chevron to say what it expands or collapses, so that I know what it does.
24. As a keyboard or screen reader user, I want each count to read as "N of M selected", so that the numbers make sense without the layout.
25. As a world author, I want my authored group order kept in the nav and on the subtree page, so that players see my structure.
26. As a world author with a small world, I want the nav unchanged when nothing has children, so that simple worlds look the same.

## Implementation Decisions

- **The trait workspace module** (the pure builder behind the setup screen's trait categories) gains the nav model. It already walks the groups in authored preorder with a depth for each one. It adds, for each nav node: whether it has children, its ancestor ids, and its subtree (the node plus every descendant category, in order). A label-only group becomes a node with a page, even though it has no category of its own.
- **Rolled-up counts** are a pure function over a node's subtree: summed shown traits, summed selected traits, and whether any group in the subtree is short. It uses the same visibility and pick-state rules that the per-group counts use today.
- **The fit function** is pure. Input: every nav row's measured height with the nav fully expanded, the space available, the parent depths, and the ids that must stay open (the current page's ancestors). Output: the cut depth. Parents at or below the cut collapse, except the protected ids. It walks the parent depths from deepest to shallowest and stops at the first cut where the visible rows fit, or after the top level (Q16). The prototype checked the fit by re-rendering and reading the scroll height at each step. The real version measures once and computes, so jsdom can test it and a resize costs one measurement.
- **The available height** is the nav's own height on desktop and 45% of the window height in the mobile drawer (Q10).
- **The workspace view** holds the collapse state for the life of the setup: either "auto" (a cut depth, recomputed on open and on resize) or "manual" (an explicit set of collapsed ids). The first chevron click turns the current effective set into the manual set, then toggles it. Collapse All and Expand All also switch to manual (Q4, Q13).
- **The page** becomes a nav node, not a category index. Clicking a node opens that node's page and keeps the category index pointed at the node's first category, so the Begin check and the other category kinds (World Options, Persona, Starting Location, Library Additions) keep working unchanged. The General category stays its own page.
- **A subtree page** renders one trait list per category in the subtree. The first section uses the page's own heading: the entity heading for an entity, or the group name. Every later section uses the separator style that the nav already uses for "Starting Traits", labeled with the path below the page. Each section passes only its own group's description, not its ancestors'. The trait cascade notice renders once per page.
- **Nav rows (Variant A):** a fixed-width leading slot holds the chevron on parent rows and stays empty on leaves. Indentation is 12 px per depth level, capped as today. The row button keeps today's states, icons and the You mark. The count sits at the right end, with a small short marker before it.
- **Accessibility:** each chevron has `aria-expanded` and an "Expand <name>" or "Collapse <name>" label. Counts keep their "N of M selected" label. A group's player description stays readable to screen readers on its row.
- **No export-shape change.** Nothing new is stored in the world or the save. Collapse state is component state only.

## Testing Decisions

- Tests check behavior a player or author can observe. They never assert internal state shapes.
- **Seam 1, the trait workspace module (unit):** the nav model (children, ancestors, a subtree in authored order, label-only groups becoming pages), the rolled-up counts (sums, the short marker, unseen traits excluded the same way as today), and the fit function. Fit cases: everything fits, so nothing collapses; one level is enough; the loop climbs to the top and stops (Q16); protected ancestors stay open (Q5); and wrapped rows of varied height. Prior art: the existing tests of the trait workspace module.
- **Seam 2, the Enter World workspace component:** clicking a parent shows every descendant section with its separator. A leaf shows only itself. A label-only group is clickable. Chevrons toggle without navigating, and rows navigate without expanding (Q8). Collapse All folds to the top level and Expand All opens everything (Q13). A collapsed row shows the summed count and the short marker. Manual state survives a page switch. jsdom has no layout, so these tests run with every row fitting and leave the fit to seam 1. Prior art: the existing Enter World workspace tests, such as the authored-hierarchy and phone-categories cases.
- Each guard must be shown to bite: reinstate the old behavior (for example, a parent page that shows only its own traits) and watch the test fail.

## Out of Scope

- Collapsing sections on the main panel (Q3).
- A page that lists every trait in the world (Q2).
- Keeping collapse state across visits or saving it per world (Q6).
- Any change to trait selection rules, gates, pick counts or the Begin check.
- The World Editor's trait tree.

## Further Notes

- **Prototype:** branch `prototype/setup-nav-fallthrough`, commit `07da61d2e`, worktree `.claude/worktrees/prototype-setup-nav-fallthrough`. To launch it, use the `proto-setup-nav-fallthrough` preview (port 5330) with `?variant=A`. The fixture world comes from `node .scratch/make-proto-world.cjs` on that branch. Question: which nav style. Verdict: Variant A.
- New user-facing strings (Collapse All, Expand All, the chevron labels) go through the Writing Guide and a copy sweep when built.
- The changelog entry goes under 👤 Added, for the Enter World setup screen.
