# Picker Categories

Status: done
Status note: closed 2026-10-25. Tickets 01–02 done; last landing d25a0bea4, then perf fix 424154a05. Review: spec text corrected. Closed red: GameViewer.editorExit, MainMenu.surfaceRequest, WorldEditor.autoSave, WorldEditor.historyOrigin, WorldEditor.overviewPanel, PlaceholderSectionList, Formaquestion.settings, FormaquestionMascotTab, SettingsModal.landing, SettingsModal.promptOptions (timeouts under load).
Spec session: picker-categories — spec

## Problem Statement

The **Requires** picker shows every target in one long list. An author adds a Condition from a trait's Requires field, an image's Visibility rules, or a location rule. The popover lists every trait, every group, a separate stats section for each owner, Time of Day, and Playing As.

In a world with many entities and traits, that list runs to hundreds of rows. An author who doesn't know a target's name has to scroll past every other owner's stats to find it. The section headings scroll away, so the author loses track of which owner they are in.

## Solution

When the picker has more than 15 rows, it opens on a short list of categories: Traits, Any Trait in a Group, Stats, Time of Day, and Playing As. Each category row shows how many targets you can still add. Clicking a category opens its page. Traits, groups, and stats open an owner page first, then the flat list for that owner.

Search at the root still reads every target and shows the same flat list with full breadcrumbs as today. Search on a category page reads only that page. A picker with 15 rows or fewer looks the same as today.

The drill-down is an option on the shared Breadcrumb Picker. Only the requirement picker turns it on for now.

## Rulings

Settled in the grill on 2026-10-25.

- **Q1 Scope.** The drill-down is an opt-in option on the shared Breadcrumb Picker. Only the requirement picker turns it on for now.
- **Q2 Root search.** Typing at the root searches every target in all categories and shows one flat list with full breadcrumbs, as today.
- **Q3 Stats.** Stats opens an owner level with one row for each owner that has stats. Each owner row opens that owner's stats.
- **Q4 Short pickers.** A short picker skips the categories and shows today's flat list.
- **Q5 Cutoff.** The picker shows categories only when it has more than 15 rows in total.
- **Q6 Traits.** Traits and Any Trait in a Group open an owner level (World, then each owner), then a flat list. Rows keep their group breadcrumbs.
- **Q7 One choice.** A level with only one choice opens straight through to the next level. The page title still names the level it skipped.
- **Q8 One target.** A category with one target, such as Time of Day, stays a row you pick directly at the root.
- **Q9 Page search.** On a category or owner page, search reads only what is under that page.
- **Q10 After a pick.** After a pick, the picker stays on the page it was picked from. Going back from the owner choice page also returns there.
- **Q11 Reopen.** The picker always opens at the root.
- **Q12 Counts.** Category and owner rows show a count in the hint slot.
- **Q13 Breadcrumbs.** On an owner page, rows drop the owner segment from their breadcrumb. Root search keeps the full breadcrumb.
- **Q14 What counts.** A count includes only targets you can still add. Disabled rows (already listed or exhausted) don't count.
- **Q15 Owner order.** The owner level keeps today's order: the host's own first, then Global, then Persona, then each entity.
- **Q16 Look.** Drill rows reuse DrillPicker's look: the name, then a chevron. Pages reuse the owner page's back-arrow header. This adds no new visual pattern.

Settled for ticket 01 on 2026-10-25.

- **Q17 One row on any page.** Q8 applies on every page, not only the root. A page with one leaf row shows as that row on its parent, with its full breadcrumb.
- **Q18 One root category.** Q7 applies to the root too. A root with one category opens straight into it. The header names the category and shows no back arrow, since back would land on the same page.
- **Q19 Back key.** Backspace in an empty search goes back one level. Escape still closes the popover.
- **Q20 Page row name.** A page row's accessible name reads "Traits, 12 available, opens a page".
- **Q22 Owner split.** Requirement options carry their owner (id and name; none for the world). The field builds Traits and Any Trait in a Group owner pages from that field, not from the breadcrumb, so the breadcrumb text doesn't change. This replaces ticket 02's "split by the first breadcrumb segment".
- **Q23 Stat page names.** A Stats owner page is titled with the owner's name, without the " Stats" suffix ("Ash", "Global", "Persona"), so the header reads "Stats › Ash". The leaf section keeps its "Ash Stats" heading for the flat list.
- **Q24 Lifted rows keep their place.** A row lifted onto its parent by Q17 shows the titles of the pages it skipped as the start of its breadcrumb, unless its breadcrumb already starts with them (Q13 in reverse). A lone stat "Mood" on Persona shows the breadcrumb "Persona". A skipped title equal to the row's own name is dropped. The flat list is unchanged.
- **Q25 Search survives the owner page.** Back from the owner choice page, and after a pick there, the list keeps the search text it had (Q10, and each page keeps its own search). This replaces the old behavior, where the search cleared on return, for every Requires picker, small ones included.
- **Q21 Counts and cutoff.** The cutoff counts every leaf row, disabled ones included. A page with no leaf rows doesn't show. A page whose rows are all disabled still shows, with a count of 0 (Q14).

## User Stories

1. As an author, I want the Requires picker to open on a short list of categories, so that I don't scroll through hundreds of targets.
2. As an author, I want each category to show how many targets I can still add, so that I know where to look before I open it.
3. As an author, I want Traits to open a page for each owner, so that I see one owner's traits at a time.
4. As an author, I want Any Trait in a Group to open a page for each owner, so that groups sort the same way as traits.
5. As an author, I want Stats to open a page for each owner, so that one entity's stats don't bury another's.
6. As an author, I want the host's own owner first on the owner level, so that the most likely target is at the top.
7. As an author, I want owners in the same order as the old section headings, so that the picker still feels familiar.
8. As an author, I want a page with one owner to open straight through to its list, so that I don't click a page with one row on it.
9. As an author, I want the page title to name the owner even when the level is skipped, so that I know whose targets I see.
10. As an author, I want Time of Day to stay a row I pick at the root, so that a one-target category costs one click.
11. As an author, I want a back arrow on every page, so that I can return one level.
12. As an author, I want root search to find any target by name, so that a known name is still one step away.
13. As an author, I want root search results to show full breadcrumbs, so that I can tell two targets with the same name apart.
14. As an author, I want search on an owner page to read only that owner, so that matches from other owners don't crowd the list.
15. As an author, I want an owner page's rows to show only the group path, so that the owner name doesn't repeat on every row.
16. As an author, I want the picker to stay on the page after I pick, so that I can add several Conditions from one owner.
17. As an author, I want the owner choice page to return me to the page I came from, so that I keep my place.
18. As an author, I want the picker to open at the root every time, so that it behaves the same on every row.
19. As an author of a small world, I want a picker with 15 rows or fewer to stay a flat list, so that small worlds get no extra clicks.
20. As an author, I want a category whose targets are all added to read 0, so that I know nothing new is there.
21. As an author, I want disabled rows to stay visible on their page, so that I can see what I already added.
22. As an author, I want the drill-down in an image's Visibility rules and in location rules too, so that every Requires picker works the same.
23. As an author working off-world, I want the picker to show only the categories that have targets, so that empty categories don't show.
24. As a keyboard user, I want to open a category with Enter and go back with a key, so that I don't need the mouse.
25. As a screen reader user, I want category rows to announce their count and that they open a page, so that I know a row isn't a target.
26. As a developer, I want the drill-down as an opt-in option on the Breadcrumb Picker, so that other pickers can turn it on later.
27. As a developer, I want pickers that don't opt in to stay as they are, so that the change doesn't affect them.
28. As a developer, I want the design-system showcase to show the drill-down, so that the pattern stays documented.

## Implementation Decisions

- **Breadcrumb Picker.** The picker gains an optional tree input beside today's flat sections. A tree node is a page (a heading and its child nodes) or a leaf section of rows. With no tree, the picker behaves as today.
- **Cutoff.** The picker counts every leaf row in the tree. At 15 or fewer, it renders the flat list it would render today, from the same rows, with full breadcrumbs (Q4, Q5).
- **Drill state.** The picker owns a stack of open pages. The stack resets to the root each time the popover opens (Q11). A pick leaves the stack as it is (Q10).
- **Pass-through.** A page with one child opens that child at once. The header names the page it skipped, for example "Stats › Ruby" (Q7). A category with one leaf row renders that row at the root (Q8).
- **Counts.** A page row's hint is the count of enabled leaf rows under it (Q12, Q14).
- **Search.** Root search runs over every leaf row in the tree and shows the flat list with full breadcrumbs (Q2). Page search runs over the leaf rows under the open page (Q9). Each page keeps its own search text, also across the owner choice page (Q25). Opening a page starts with an empty search.
- **Breadcrumbs on a page.** On an owner page, a row's breadcrumb drops the segments the page path already shows (Q13). Root search shows the full breadcrumb.
- **Caller page.** The caller's `page` (the requirement field's owner choice page) still replaces the list. When it closes, the picker returns to the page on top of the stack (Q10).
- **Look.** A page row uses DrillPicker's row look: the name, then a chevron. The page header uses the owner page's back-arrow header (Q16).
- **Requirement Rows field.** The field builds the tree from the sections it builds today. Traits and Any Trait in a Group split by each option's owner id, World first (Q22). Stats split by the existing stat sections, in today's order (Q3, Q6, Q15). Time of Day and Playing As are categories of their own. Empty categories and owners drop out.
- **No data change.** No world, save, or export shape changes. The Condition a row adds is the same as today.
- **Showcase.** The Breadcrumb Picker reference in the design-system showcase gains a drill-down example.

## Testing Decisions

- A good test renders the component, drives it as a user does (click, type, keys), and reads the DOM. It never reads the picker's internal state or the tree builder's output.
- **Breadcrumb Picker seam.** Extend the existing rendered picker tests. Cover the cutoff on both sides of 15, page rows with counts that leave out disabled rows, pass-through on a one-child page, a one-row category picked at the root, back navigation, root search over the whole tree with full breadcrumbs, page search limited to the page, a pick that keeps the page, reopen at the root, a caller page that returns to the open page, and keyboard drill and back.
- **Requirement Rows field seam.** Extend the existing rendered field tests. Cover the categories it shows for a large world, the owner order on the stats page, the owner name dropped from breadcrumbs on an owner page, off-world showing only the categories that have targets, and an owner choice page that returns to the drilled page. Each test checks that it fails when its rule is broken.
- **Prior art.** The Breadcrumb Picker tests for search, keyboard, and caller pages. The Requirement Rows field tests for owner choice, stats, and time. The DrillPicker tests for drilling and the way back.

## Out of Scope

- Turning on the drill-down in the Variable Menu, the Stat Code template dialog, backup restore, or any other Breadcrumb Picker.
- A group tree drill inside an owner's traits. Groups stay as breadcrumbs (Q6).
- Remembering the last page used between openings (Q11).
- Changing DrillPicker in Chip Options.
- Any change to how Conditions resolve or are stored.

## Further Notes

- The owner choice page that already exists is the second-step pattern the drill pages copy. Keep the two behaving the same.
- The 15-row cutoff is a constant on the picker, not a setting.
