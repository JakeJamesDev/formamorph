# Trait Panel Tabs

Status: ready-for-agent
Status note: No prototype round. The Panel Tab Strip is an approved pattern, the grouping had no real alternative, and the three earlier panels settled every shared mechanism this one needs. Fourth panel to take the strip after entities, locations, and stats.

## Problem Statement

In the World Editor, selecting a trait fills the right panel with one flat column: name, two description editors, the two checkboxes, the Stat Changes rows, the Stat Availability rows with their conflict notes, and the placeholder pins. It is the shortest of the list panels, but it mixes three kinds of thing: what the trait is, what it does to stats, and what it pins. The two stat lists grow by a row per effect and push the pins off screen, and the pins push nothing because they are last. The entity, location, and stat panels moved to tabs; the trait panel is the last one that still reads as a single column.

## Solution

The trait panel becomes a tabbed form with three tabs in Advanced mode:

- **Details** — what the trait is. Name, Player-Facing Description, AI-Facing Description, then the Enabled by Default and Player Can Toggle In-Game checkboxes.
- **Stats** — what the trait does to stats. Stat Changes, then Stat Availability with its conflict notes.
- **Pins** — Placeholder Pins. Advanced mode only, like the pins themselves.

Simple mode shows Details and Stats, with Stats holding Stat Changes alone, so the strip stays in both modes.

The tab an author picks stays picked while they move through the trait tree. Find and the Test Bench still land on any field: navigating to a hit opens the tab that holds it. A rival trait named in a conflict note still opens that trait. The tree side of the Traits tab and the trait group panel are unchanged.

## User Stories

1. As a world author, I want the trait panel split into Details, Stats, and Pins, so that I see one kind of thing at a time.
2. As a world author, I want Name and the two descriptions first on Details, so that writing the trait is the first thing the panel offers.
3. As a world author, I want the Enabled by Default and Player Can Toggle In-Game checkboxes under the descriptions, so that the trait's own switches stay with its record.
4. As a world author, I want Stat Changes and Stat Availability together on one tab, so that everything the trait does to stats is edited in one place.
5. As a world author, I want the Stat Changes rows to keep their stat picker, value, kind picker, delete, and Add controls unchanged, so that effects work exactly as before.
6. As a world author, I want the Stat Availability rows to keep their stat picker, Enable or Disable picker, delete, Add, and conflict notes unchanged, so that availability works exactly as before.
7. As a world author, I want a rival trait named in a conflict note to still open that trait, so that the Stats tab keeps its cross-navigation.
8. As a world author, I want the trait that opens from a conflict note to show the tab I was on, so that I can compare its Stats tab with the one I came from.
9. As a world author, I want Placeholder Pins on their own tab, so that the pin rows have room.
10. As a world author, I want the tab I chose to stay chosen when I select another trait, so that I can review every trait's stat effects in a row.
11. As a world author, I want the panel to fall back to Details when the current tab disappears, so that switching to Simple mode while on Pins never leaves me on an empty panel.
12. As a world author using Find, I want a hit inside a description to open Details and ring the field, so that navigation still reaches text that is not on screen.
13. As a world author using Find, I want a hit in a pinned value to open Pins, so that every searchable trait field is reachable.
14. As a world author using Find and Replace, I want replacement to work on fields in a tab that is not showing, so that the tab split does not change what Replace covers.
15. As a world author using the Test Bench, I want Open on a trait finding to land on that trait with its tabs intact, so that triage flows into editing.
16. As a world author, I want selecting a trait group to show the group panel with no tab strip, so that groups keep their own shape.
17. As a world author, I want the tree filter to keep working, so that selecting a trait from the filtered list shows the same tabs.
18. As a Simple-mode author, I want two tabs, Details and Stats, so that the panel matches the mode's promise of just the essentials.
19. As a Simple-mode author, I want Stats to hold Stat Changes alone, so that nothing the mode hides today appears.
20. As a mobile author, I want the three tabs to fit the detail view without horizontal page scroll, so that the panel works on a phone.
21. As a mobile author, I want each Stat Changes row to stay usable at 375px, so that the tab split does not make the rows worse than today.
22. As a keyboard author, I want the tab strip to move focus with the arrow keys and keep the shared focus ring, so that the panel matches every other strip.
23. As a world author, I want the placeholder palette bar to stay above the tabs, so that inserting a chip works on every tab that has a chip field.
24. As a world author, I want all four list panels to use the same tab strip shape, so that the editor reads as one tool.
25. As a developer, I want a dev-router entry for the trait panel's tabs, so that a test or a session can land on Stats in one call.
26. As a developer, I want the trait panel to use the shared tab-for-field helper and item guard, so that it adds a map and nothing else.
27. As a developer, I want the tab layout covered by tests at the World Editor level, so that Find, Bench, and mode switching are proven against the real panel.
28. As a reviewer, I want the Design System guide's Panel Tab Strip entry to cover the trait panel once the mobile form is approved, so that the pattern's record is complete.

## Implementation Decisions

- **Tabs live in the World Editor's trait manager.** The trait manager renders the tab strip and its three panels. The tree, the filter list, and the trait group panel are untouched.
- **Tab set and order.** Details, Stats, Pins. Pins appears only in Advanced mode. The tab list is one exported constant with value, label, icon, and an Advanced-only flag, mirroring the entity, location, and stat tab modules, and it feeds both the strip and the dev-router ledger. Icons: a badge or tag glyph for Details, an activity or chart glyph for Stats, the pin for Pins. The strip is the shared Panel Tab Strip, named "Trait Fields", which also keeps its Stats tab from being confused with the editor's own Stats tab in the accessibility tree.
- **Details composition.** Name, Player-Facing Description, AI-Facing Description, both resizable as today, then the two checkboxes with their brief notes. Stacked, one per line; nothing here needs a row.
- **Stats composition.** Stat Changes, then Stat Availability, stacked and unchanged in behavior: the rows, the Add buttons, the help controls, and the conflict notes all keep their current shape. Stat Availability is Advanced only, as today.
- **Pins composition.** The Placeholder Pins label, its help control, and the pin rows, unchanged. The trait link in a pin conflict note keeps working.
- **Tab persistence.** The chosen tab survives the per-trait remount for the life of the editor session and is held by the editor, in the same slot shape as the other three panels. When the chosen tab is unavailable, the panel shows Details.
- **Find navigation opens the owning tab.** The trait manager takes the shared focus-field hint through the editor's item guard, and answers the tab through the shared tab-for-field helper with its own map: `name`, `playerDescription`, `aiDescription` open Details; `placeholderPins[].value` opens Pins. The tab switch happens before the existing reveal-and-ring timer runs.
- **Replace is unaffected.** Replace edits the record through the search target's writer, not the DOM.
- **Bench and conflict-note navigation.** Both go through the editor's item navigation with no tab hint and land on the persisted tab. The conflict note already uses that path.
- **Dev-router coverage.** A `subtab` ledger entry for the trait panel (`details`, `stats`, `pins`) beside the other three, guarded by the same drift test.
- **No export-shape change.** Nothing about the trait record changes. This is a rendering change only.
- **Design authority.** The Panel Tab Strip is an approved pattern. There was no prototype; desktop is checked in the preview against the entity and location panels for strip parity. The implementer shows the mobile form in context and, on approval, extends the pattern's guide entry with the trait composition rather than adding a second pattern.
- **Changelog.** One 👤 entry in the In-Progress bucket.

## Testing Decisions

A good test drives the real World Editor with a loadable world and asserts what an author sees and where navigation lands. It never reaches into the tab component's state.

- **One seam: the World Editor bench harness.** The existing harness that renders the editor on a world in a chosen mode is the seam, as for the other three panels. Tests select a trait, click tabs, and assert on labels, on which fields are present, and on which tab is active. Prior art: the entity, location, and stat panel suites, the Bench suite, and the find-focus suite.
- **Cases at that seam.**
  - Advanced: three tabs. Details shows Name, the two descriptions, Enabled by Default, and Player Can Toggle In-Game and nothing else. Stats shows the Stat Changes and Stat Availability labels with their Add buttons. Pins shows Placeholder Pins with its help control.
  - Simple: two tabs. Stats shows Stat Changes and its Add button; no Stat Availability.
  - Tab persists across selecting another trait, including one in a different group.
  - On Pins, switching to Simple lands on Details.
  - Find hit in AI-Facing Description from Stats opens Details and rings the field; Find hit in a pinned value from Details opens Pins.
  - Bench Open on a trait finding lands on the trait with the persisted tab.
  - Clicking a rival trait in a Stat Availability conflict note lands on that trait on the Stats tab.
  - Selecting a trait group shows the group panel with no tab strip.
- **Trait manager suite.** The existing trait manager suite keeps passing; its cases run inside the Details and Stats tabs.
- **Dev-router.** The existing ledger drift test covers the new `subtab` entry.

## Out of Scope

- The Dictionary panel. It comes as its own spec if it needs one.
- Any change to the Stat Changes or Stat Availability row layout, the conflict rule, or the export shape.
- Changes to the trait tree, drag nesting, or the group panel.
- Recording the mobile form in the Design System guide before it is approved.

## Further Notes

**Why no prototype.** The three earlier panels each ran a prototype round to settle the tab-versus-sections question, the picture's place, and the thin-tab problem. None of those apply here: the strip is the approved pattern, the trait has no picture, and every group is either prose or a row list. The grouping was agreed from the grounding alone.

**Why "Stats".** The tab holds everything the trait does to stats, and both sections on it are named for stats. "Effects" was the first proposal and read as vaguer. The editor's own strip has a Stats tab too; the panel strip's accessible name keeps them apart, as the location panel's Details already does against the entity panel's.

**What this panel reuses.** The editor-held tab slot, the optional tab hint on item navigation, the named focus-field hint type, the shared tab-for-field helper, and the item guard are all on `main` from the earlier efforts. This panel adds a tab module, a field map, a ledger entry, and the layout.

## Comments

**2026-09-10 — Mobile form approved.** Shown at 375x812 in the real editor over a bundled world, on the Details and Stats tabs. The strip renders three equal 105px columns across 323px, icon only, and the page does not scroll horizontally (`scrollWidth` 375 = `clientWidth` 375). A Stat Changes row keeps its three 94px controls plus the delete button, the same row the panel showed before the tabs. The user approved the form as shown and asked for the guide entry and showcase to follow.

Desktop was checked at 1600x900 beside the entity and location panels. All three strips measure 40px tall and 737px wide with 32px triggers; the trait and entity strips take three 243px columns and the location strip four 182.25px columns.
