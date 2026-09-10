# Stat Panel Tabs

Status: ready-for-agent
Status note: Shape settled by prototype on branch `prototype/stat-panel` (see Further Notes). Third panel to take the Panel Tab Strip pattern after entities and locations; it reuses their editor-held tab slot, tab hint, and focus-field handling, and it is the point where the duplicated find-focus path becomes one helper.

## Problem Statement

In the World Editor, selecting a stat fills the right panel with one flat column: name, type, description, the availability checkboxes with two paragraphs of help, the Min/Max/Initial/Regen grid, the Body Sliders picker, the four Prevent AI Changes checkboxes, the descriptor bar with one row per band, and the code editor with its Templates and Test Code controls. In Advanced mode that is two screens tall. The two sections an author spends the most time in, descriptors and code, sit at the bottom under everything else, and each grows on its own: descriptors by one row per band, code by however much an author writes. Simple mode is short and fine. The entity and location panels moved to tabs; the stat panel should follow with a grouping that fits what a stat is.

## Solution

The stat panel becomes a tabbed form with three tabs in Advanced mode:

- **Details** — what the stat is and how it behaves. Name and Type on one row, Description, the range as one row of Min, Max, Initial Value, Regen, then Body Sliders. Below that, Availability as a compact Enabled and Hidden pair with one shared help line, then Prevent AI Changes.
- **Descriptors** — the Stat Descriptors section whole: the unit toggle, the coverage bar with its start marker, one row per band, and the add row.
- **Code** — the Dynamic Value Calculation section whole: the heading with its help control and Templates button, the code editor, and Test Code with its result line.

Body Sliders stays on Details on purpose. It is part of what the stat is, the way Locations is part of an entity's Profile, not a rule about it. Availability and Prevent AI Changes also stay on Details rather than taking a Rules tab of their own: the prototype showed a Rules tab holding two checkbox rows on an otherwise empty screen, and Details still fits one screen with both blocks under the sliders.

Simple mode shows only the Details field set: Name, Type, Description, the range row, and Body Sliders. With one tab left there is no strip; the panel renders the Details body bare, so Simple reads as the flat panel it always was.

The tab an author picks stays picked while they move through the stat list. Find and the Test Bench still land on any field: navigating to a hit opens the tab that holds it. The list side of the Stats tab is unchanged.

## User Stories

1. As a world author, I want the stat panel split into Details, Descriptors, and Code, so that I see one kind of thing at a time instead of a two-screen column.
2. As a world author, I want Name and Type on one row at the top of Details, so that the identity line is short and the rest of the record starts right under it.
3. As a world author, I want Min, Max, Initial Value, and Regen in one row, so that the stat's range reads as one line of numbers.
4. As a world author, I want Body Sliders under the range on Details, so that the binding sits with the value that drives it.
5. As a world author, I want Enabled and Hidden as one compact pair with a single help line, so that Availability takes two lines instead of a screen's worth of paragraphs.
6. As a world author, I want Prevent AI Changes under Availability on Details, so that every switch about how the stat behaves is on the tab I open first.
7. As a world author, I want the descriptor bar, its start marker, the unit toggle, and every band row on a tab of their own, so that a stat with many bands has room to grow without pushing anything else off screen.
8. As a world author, I want the code editor, Templates, and Test Code on a tab of their own, so that writing and testing code has the whole panel.
9. As a world author, I want Test Code results to appear under the editor as today, so that the split changes nothing about how I check code.
10. As a world author, I want the Templates dialog to keep inserting into the code field, so that the Code tab works exactly as the section did.
11. As a world author, I want the tab I chose to stay chosen when I select another stat, so that I can review every stat's descriptors in a row.
12. As a world author, I want the panel to fall back to Details when the current tab disappears, so that switching to Simple mode while on Code never leaves me on an empty panel.
13. As a world author using Find, I want a hit in a descriptor's text to open Descriptors and ring the field, so that navigation still reaches text that is not on screen.
14. As a world author using Find, I want a hit in Name or Description to open Details, so that every searchable stat field is reachable.
15. As a world author using Find and Replace, I want replacement to work on fields in a tab that is not showing, so that the tab split does not change what Replace covers.
16. As a world author using the Test Bench, I want Open on a stat finding to land on that stat with its tabs intact, so that triage flows into editing.
17. As a world author, I want a Percentage stat to show the same three tabs with its pinned Min and Max, so that the type change does not change the panel's shape.
18. As a world author, I want a placeholder chip in a descriptor to insert on the Descriptors tab, so that the palette bar keeps working on every tab that has a chip field.
19. As a world author, I want descriptor pins to keep their popover on the Descriptors tab, so that the tab split does not remove a control.
20. As a Simple-mode author, I want no tab strip, so that the panel does not offer a single tab as if it were a choice.
21. As a Simple-mode author, I want Name, Type, Description, the range, and Body Sliders, so that nothing the mode hides today appears.
22. As a mobile author, I want the three tabs to fit the detail view without horizontal page scroll, so that the panel works on a phone.
23. As a mobile author, I want the name row and the range row to stack, so that nothing is clipped at 375px.
24. As a keyboard author, I want the tab strip to move focus with the arrow keys and keep the shared focus ring, so that the panel matches the entity and location panels.
25. As a world author, I want the stat, entity, and location panels to use the same tab strip shape, so that the editor reads as one tool.
26. As a developer, I want a dev-router entry for the stat panel's tabs, so that a test or a session can land on Code in one call.
27. As a developer, I want one helper for "which tab holds this field" and one guard for "is this hint for the item I am showing", so that the third panel does not add a third copy of each.
28. As a developer, I want the tab layout covered by tests at the World Editor level, so that Find, Bench, and mode switching are proven against the real panel.

## Implementation Decisions

- **Tabs live in the World Editor's stat manager.** The stat manager renders the tab strip and its three panels. The list side is untouched.
- **Tab set and order.** Details, Descriptors, Code. Descriptors and Code appear only in Advanced mode. The tab list is one exported constant with value, label, icon, and an Advanced-only flag, mirroring the entity and location tab modules, and it feeds both the strip and the dev-router ledger. Icons from the prototype: a gauge for Details, an ordered list for Descriptors, the code glyph for Code.
- **The strip is the shared Panel Tab Strip.** Same component as the entity and location panels, same label breakpoints, named "Stat Fields".
- **One tab means no strip.** When the mode leaves a single tab, the manager renders that tab's body without the Tabs wrapper. This is the first panel to hit that case, so the decision is recorded in the shared strip's guide entry rather than in the stat manager alone. Prototype shape:

  ```tsx
  const shown = tabs.filter((t) => advanced || !t.advancedOnly);
  if (shown.length === 1) return <div className="space-y-4">{panels[shown[0].value]}</div>;
  ```

- **Details composition.** At `sm` and wider, Name and Type share one row: the name field takes the flexible width and the type select keeps a fixed width of about eleven rem. Then Description. Then the range as a four-column row: Min, Max, Initial Value, Regen; a Percentage stat keeps its read-only 0 and 100 there. Then Body Sliders with its help line and picker. In Advanced mode, then Availability as a two-column pair, Enabled and Hidden, with one help line that carries both meanings, then Prevent AI Changes with its four checkboxes, unchanged. Below `sm`, the name row stacks and the range row drops to two columns.
- **Availability copy.** The two paragraphs collapse to one line: a disabled stat is inert until a trait switches it on; a hidden stat never shows to the player but the AI still reads it and its regen and code keep running. The dice-roll and cooldown examples move to the help topic if they are wanted anywhere.
- **Descriptors composition.** The existing Stat Descriptors section whole, unchanged in behavior: unit toggle, bar, start marker, band rows with pins and delete, add row.
- **Code composition.** The existing Dynamic Value Calculation section whole, unchanged in behavior: heading, help control, Templates button and dialog, code editor, Test Code with its result, error, and problem lines.
- **Type change.** Switching Number and Percentage rewrites the range fields in place on Details, as today. No tab moves.
- **Tab persistence.** The chosen tab survives the per-stat remount for the life of the editor session and is held by the editor, in the same slot shape as the entity and location panels. When the chosen tab is unavailable, the panel shows Details.
- **Find navigation opens the owning tab.** The stat manager accepts the same focus-field hint the Overview, entity, and location panels take from Find. Field keys map to tabs: `name` and `description` open Details; `descriptors[n].description` opens Descriptors. The tab switch happens before the existing reveal-and-ring timer runs.
- **Consolidate the find-focus path.** Entity and location each carry a tab-for-field map and a call-site item-id guard in the editor. This spec introduces one helper that takes a field key and a panel's map and answers the tab, and one guard in the editor that pairs a hint with the item it is for, and moves the entity and location panels onto them. The focus-field shape gets a named type in the shared types module while it is being touched, as entity ticket 04 recorded.
- **Replace is unaffected.** Replace edits the record through the search target's writer, not the DOM.
- **Bench navigation.** Bench findings pass no tab hint and land on the persisted tab, through the optional tab hint the entity effort added to item navigation.
- **Dev-router coverage.** A `subtab` ledger entry for the stat panel (`details`, `descriptors`, `code`) beside the entity and location entries, guarded by the same drift test.
- **No export-shape change.** Nothing about the stat record changes. This is a rendering change only.
- **Design authority.** The Panel Tab Strip is an approved pattern. Desktop was approved in context through the prototype. The implementer shows the mobile form in context and, on approval, extends the pattern's guide entry with the stat composition and the one-tab rule rather than adding a second pattern.
- **Changelog.** One 👤 entry in the In-Progress bucket.

## Testing Decisions

A good test drives the real World Editor with a loadable world and asserts what an author sees and where navigation lands. It never reaches into the tab component's state.

- **One seam: the World Editor bench harness.** The existing harness that renders the editor on a world in a chosen mode is the seam, as for the entity and location panels. Tests select a stat, click tabs, and assert on labels, on which fields are present, and on which tab is active. Prior art: the entity and location panel suites, the Bench suite, and the find-focus suite.
- **Cases at that seam.**
  - Advanced: three tabs. Details shows Name, Type, Description, Min, Max, Initial Value, Regen, Body Sliders, Enabled, Hidden, and the four Prevent AI Changes boxes, and nothing else. Descriptors shows the Stat Descriptors label, the unit toggle, and the band rows. Code shows the Dynamic Value Calculation heading, Templates, the code field, and Test Code.
  - Simple: no strip. Name, Type, Description, the range, and Body Sliders; no Enabled, Hidden, Prevent AI Changes, descriptors, or code.
  - Tab persists across selecting another stat.
  - On Code, switching to Simple lands on Details with no strip; switching back to Advanced restores the strip on Details.
  - Percentage stat: same three tabs; Min and Max read 0 and 100 and are disabled.
  - Find hit in a descriptor from Details opens Descriptors and rings the field; Find hit in Description from Code opens Details.
  - Bench Open on a stat finding lands on the stat with the persisted tab.
- **Consolidated helper.** The entity and location find-focus cases keep passing after they move onto the shared helper and guard; that is the proof the consolidation changed nothing.
- **Stat manager suites.** The existing stat manager suites, including the code tests, keep passing; their cases run inside the Details and Code tabs.
- **Dev-router.** The existing ledger drift test covers the new `subtab` entry.

## Out of Scope

- The remaining list tabs (Traits, Dictionary). Each comes as its own spec if it needs one.
- A Rules tab. Rejected by the prototype as too thin.
- Any change to the descriptor geometry, the code sandbox, or the export shape.
- Moving the availability examples into the help topic; noted, not required.
- Recording the mobile form in the Design System guide before it is approved.

## Further Notes

**Prototype.** Branch `prototype/stat-panel`, worktree `.claude/worktrees/prototype-stat-panel`, launch entry `proto-stat-panel` in the main checkout's launch file (Vite on port 5193 from the worktree). Variants switch with `?variant=` and a floating bar; `?variant=S3` is the winner. One commit, `9b0bb422`: four tabs with a stacked Details (S1), four tabs with a dense Details (S2), and three tabs with the rules folded into the dense Details (S3).

**Why the alternatives lost.** S1 and S2 both give Availability and Prevent AI Changes a Rules tab, which holds two checkbox rows and their help lines on an otherwise empty screen. S3's Details still fits one screen at 1600x900 with both blocks under the sliders, so the tab bought nothing. S2's dense Details is what S3 keeps.

**Why Body Sliders is on Details.** It is part of the stat's record, as Locations is part of an entity's Profile, so it goes with Name and Type rather than with the switches.

**Dependency on the earlier efforts.** The editor-held tab slot, the optional tab hint on item navigation, and the focus-field handling are all on `main` from the entity and location efforts. This spec reuses them and is the point where the two copies of the tab-for-field map and the item-id guard become one helper, as recorded on entity ticket 04.

**Measurements from the flat panel** (Health in the showcase world, Advanced, 1600x900): panel scroll height 1703px against an 873px viewport. Every tab of the winning variant fits without scrolling; Details is the tallest.
