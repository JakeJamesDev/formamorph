# Dictionary Panel Tabs

Status: ready-for-agent
Status note: No prototype round. The Panel Tab Strip is an approved pattern and the split was agreed from the grounding. Fifth and last list panel to take the strip. Unlike the earlier four, the split is by cadence rather than height, and the panel has a second host in the library's dictionary editor.

## Problem Statement

In the World Editor, selecting a dictionary entry fills the right panel with one column: name, the trigger keywords, an options block with five checkboxes, the scan depth, and the secondary keywords with their two modes, then the value. The panel is not tall, but the value, which is the text the entry exists to inject, sits last under the matching settings. An author sets the matching rules once when the entry is created and then spends the rest of the entry's life refining its keywords and its value. Every visit after the first scrolls past settings that are already right. The same panel serves the library's dictionary editor, where the same loop happens.

## Solution

The entry panel becomes a tabbed form with two tabs in Advanced mode:

- **Details** — the loop an author iterates in. Name, Trigger Keywords with the Whole words and Case-sensitive switches beside them, then Value.
- **Matching** — the rules set once. Always inject, Regex, Recursive, Scan depth, and Secondary Keywords with Require all and Exclude.

Whole words and Case-sensitive stay on Details on purpose. They are the two matching switches Simple mode shows, they modify the keywords they sit next to, and keeping them there leaves Simple with one tab. Simple mode therefore shows Details bare with no strip, under the one-tab rule the stat panel introduced.

The library's dictionary editor gets the same tabs on its entry panel, with the chosen tab held by the modal for its session. The book panel in both hosts is unchanged.

The tab an author picks stays picked while they move through the dictionary tree. Find and the Test Bench still land on any field: navigating to a hit opens the tab that holds it.

## User Stories

1. As a world author, I want the entry panel split into Details and Matching, so that the settings I set once stop sitting between my keywords and my value.
2. As a world author, I want Name, Trigger Keywords, and Value together on Details, so that refining an entry is one tab with nothing else on it.
3. As a world author, I want Whole words and Case-sensitive beside the keywords they modify, so that the quick switches stay in reach while I edit keywords.
4. As a world author, I want Value directly under the keywords, so that the text I came to write is on screen without scrolling.
5. As a world author, I want Always inject, Regex, Recursive, Scan depth, and Secondary Keywords on a Matching tab, so that the rules I set once are out of the way once they are right.
6. As a world author, I want the Secondary Keywords block to keep its Require all and Exclude switches and its plain-English hint, so that the gate reads the same as today.
7. As a world author, I want turning Regex on to still drop the chip vocabulary from the keyword and value fields, so that a pattern is never mangled by the placeholder typeahead.
8. As a world author, I want the Name and keyword help lines to stay with their fields, so that the tab split does not remove guidance.
9. As a world author, I want the tab I chose to stay chosen when I select another entry, including one in another book, so that I can review every entry's value in a row.
10. As a world author, I want the panel to fall back to Details when the current tab disappears, so that switching to Simple mode while on Matching never leaves me on an empty panel.
11. As a world author using Find, I want a hit in a keyword or the value to open Details and ring the field, so that navigation still reaches text that is not on screen.
12. As a world author using Find, I want a hit in a secondary keyword to open Matching, so that every searchable entry field is reachable.
13. As a world author using Find and Replace, I want replacement to work on fields in a tab that is not showing, so that the tab split does not change what Replace covers.
14. As a world author using the Test Bench, I want Open on an entry finding to land on that entry with its tabs intact, so that triage flows into editing.
15. As a world author, I want selecting a book to show the book panel with no tab strip, so that books keep their own shape.
16. As a world author, I want the tree filter to keep working, so that selecting an entry from the filtered list shows the same tabs.
17. As a world author, I want the placeholder palette bar to stay above the tabs, so that inserting a chip works on Details and on Matching's secondary keywords.
18. As a library author, I want the same Details and Matching tabs in the dictionary editor, so that an entry is edited the same way wherever I open it.
19. As a library author, I want the chosen tab to stay chosen while I move through the book's entries, so that the library editor behaves like the World Editor.
20. As a library author, I want the palette bar above the tabs in the dictionary editor, so that chips insert on both tabs there too.
21. As a Simple-mode author, I want no tab strip, so that the panel does not offer a single tab as if it were a choice.
22. As a Simple-mode author, I want Name, Trigger Keywords, Whole words, Case-sensitive, and Value, so that nothing the mode hides today appears.
23. As a mobile author, I want the two tabs to fit the detail view without horizontal page scroll, so that the panel works on a phone.
24. As a mobile author, I want the keyword chips and their two switches to wrap cleanly at 375px, so that Details stays usable.
25. As a keyboard author, I want the tab strip to move focus with the arrow keys and keep the shared focus ring, so that the panel matches every other strip.
26. As a world author, I want all five list panels to use the same tab strip shape, so that the editor reads as one tool.
27. As a developer, I want a dev-router entry for the entry panel's tabs in the World Editor, so that a test or a session can land on Matching in one call.
28. As a developer, I want the entry panel to use the shared tab-for-field helper and item guard, so that it adds a map and nothing else.
29. As a developer, I want the tab layout covered by tests at the World Editor level and at the library modal level, so that both hosts are proven against the real panel.
30. As a reviewer, I want the Design System guide's Panel Tab Strip entry to cover the dictionary panel once the mobile form is approved, so that the pattern's record is complete for every list panel.

## Implementation Decisions

- **Tabs live in the entry manager, which both hosts share.** The entry manager renders the tab strip and its two panels and takes the chosen tab and its change handler as props, as the other panels do. The World Editor holds the tab in its per-panel slot; the library's dictionary editor holds it in its own state for the modal's session. Neither host duplicates the panel.
- **Tab set and order.** Details, Matching. Matching appears only in Advanced mode. The tab list is one exported constant with value, label, icon, and an Advanced-only flag, mirroring the other four tab modules, and it feeds both the strip and the dev-router ledger. Icons: a book or text glyph for Details, a filter or crosshair glyph for Matching. The strip is the shared Panel Tab Strip, named "Entry Fields".
- **One tab means no strip.** Simple mode leaves Details alone, so the manager renders the Details body without the Tabs wrapper, under the rule the stat panel introduced and the guide records.
- **Details composition.** Name with its help line. Trigger Keywords with its help line, and the Whole words and Case-sensitive switches as a wrapped row directly under the chips. Then Value, resizable as today. Stacked; nothing here needs a grid.
- **Matching composition.** Always inject, Regex, Recursive as a wrapped switch row. Scan depth. Secondary Keywords with its chips, the Require all and Exclude switches, and the hint. All Advanced only, as today. The Options label goes away; the two switch rows carry their own meaning where they sit.
- **Regex behavior.** Turning Regex on still removes the chip vocabulary from the keyword, secondary keyword, and value fields and turns off the comma split, as today. The switch lives on Matching and the fields it affects are on both tabs; that is fine because the effect is on the record, not the DOM.
- **Tab persistence in the World Editor.** The chosen tab survives the per-entry remount for the life of the editor session, in the same slot shape as the other four panels. When the chosen tab is unavailable, the panel shows Details.
- **Tab persistence in the library.** The dictionary editor holds the chosen tab in modal state, so it survives selecting another entry and resets when the modal closes. The library editor takes the same mode the entry manager reads today.
- **Find navigation opens the owning tab.** The World Editor passes the shared focus-field hint through the item guard, and the entry manager answers the tab through the shared tab-for-field helper with its own map: `name`, `key[]`, `value` open Details; `secondaryKeys[]` opens Matching. The tab switch happens before the existing reveal-and-ring timer runs. The library editor has no Find and passes no hint.
- **Replace is unaffected.** Replace edits the record through the search target's writer, not the DOM.
- **Bench navigation.** Bench findings pass no tab hint and land on the persisted tab.
- **Dev-router coverage.** A `subtab` ledger entry for the World Editor's entry panel (`details`, `matching`) beside the other four, guarded by the same drift test. The library modal's existing route is unchanged; its entry tabs are reached by selecting an entry.
- **Book panel.** Unchanged in both hosts. No strip.
- **No export-shape change.** Nothing about the entry or book record changes. This is a rendering change only.
- **Design authority.** The Panel Tab Strip is an approved pattern. There was no prototype; desktop is checked in the preview beside the other panels for strip parity, in both hosts. The implementer shows the mobile form in context and, on approval, extends the pattern's guide entry with the dictionary composition rather than adding a second pattern.
- **Changelog.** One 👤 entry in the In-Progress bucket, naming both hosts.

## Testing Decisions

A good test drives a real host with a loadable dictionary and asserts what an author sees and where navigation lands. It never reaches into the tab component's state.

- **Primary seam: the World Editor bench harness.** The existing harness that renders the editor on a world in a chosen mode is the seam, as for the other four panels. Tests select an entry, click tabs, and assert on labels, on which fields are present, and on which tab is active. Prior art: the entity, location, stat, and trait panel suites, the Bench suite, and the find-focus suite.
- **Second seam: the library's dictionary editor modal.** The second host has no suite today, so one is added at the modal's own boundary: render the modal on a book, select an entry, click tabs, assert on fields. This is the only new seam and it exists because the panel has two hosts.
- **Cases at the World Editor seam.**
  - Advanced: two tabs. Details shows Name, Trigger Keywords, Whole words, Case-sensitive, and Value and nothing else. Matching shows Always inject, Regex, Recursive, Scan depth, and Secondary Keywords with Require all and Exclude.
  - Simple: no strip. Name, Trigger Keywords, Whole words, Case-sensitive, Value; no Always inject, Regex, Recursive, Scan depth, or Secondary Keywords.
  - Tab persists across selecting another entry, including one in another book.
  - On Matching, switching to Simple lands on Details with no strip; switching back restores the strip on Details.
  - Regex on: the keyword and value fields lose the chip vocabulary and the comma split, as today.
  - Find hit in a secondary keyword from Details opens Matching and rings the chip; Find hit in Value from Matching opens Details.
  - Bench Open on an entry finding lands on the entry with the persisted tab.
  - Selecting a book shows the book panel with no tab strip.
- **Cases at the library seam.**
  - Two tabs on an entry; the tab persists across selecting another entry; the book panel shows no strip.
- **Entry manager suite.** The existing entry manager suite keeps passing; its cases run inside the Details tab.
- **Dev-router.** The existing ledger drift test covers the new `subtab` entry.

## Out of Scope

- The book panel and the library's Overview and Placeholders tabs.
- Any change to keyword matching, the secondary gate, scan depth semantics, or the export shape.
- Changes to the dictionary tree or its virtualization.
- Recording the mobile form in the Design System guide before it is approved.

## Further Notes

**Why tabs for a panel that fits.** The earlier four panels split by height. This one splits by cadence: matching rules are set once and then become noise while the keywords and value are refined. A reorder alone, Value above Options, was considered and would fix the scroll, but it leaves the set-once block on every visit. The user chose the tabs.

**Why Whole words and Case-sensitive are on Details.** They are matching rules, but they are the only two Simple mode shows. On Matching they would give Simple a tab holding two checkboxes; on Details they sit beside the keywords they modify and Simple stays at one tab with no strip.

**Why the library gets the tabs.** The entity panel kept its library modal stacked because the tabs were built around a gallery column the modal did not have. The entry panel is the same in both hosts and a library author refines values the same way, so the tabs belong in both. The modal holds the tab itself since it has no editor slot.

**What this panel reuses.** The editor-held tab slot, the optional tab hint on item navigation, the named focus-field hint type, the shared tab-for-field helper, the item guard, and the one-tab rule are all on `main`. This panel adds a tab module, a field map, a ledger entry, the layout, tab state in the library modal, and a suite for that modal.
