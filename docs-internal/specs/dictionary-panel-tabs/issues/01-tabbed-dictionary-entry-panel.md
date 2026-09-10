# 01: Tabbed Dictionary Entry Panel

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

The whole spec in one unit. Every shared mechanism is on `main` from the earlier four panels, so this is a tab module, a field map, a ledger entry, the layout in a panel two hosts share, tab state in the library modal, the tests for both hosts, and the mobile form with the guide extension on approval.

## What to build

Selecting a dictionary entry in the World Editor shows the shared Panel Tab Strip, named "Entry Fields", with Details and Matching in Advanced mode, under the placeholder palette bar. Selecting a book still shows the book panel with no strip.

Details stacks Name with its help line, Trigger Keywords with its help line and the Whole words and Case-sensitive switches as a wrapped row under the chips, then Value, resizable as today. Matching stacks Always inject, Regex, and Recursive as a wrapped switch row, Scan depth, and Secondary Keywords with its chips, Require all, Exclude, and the hint. The Options label goes away. Turning Regex on still drops the chip vocabulary and the comma split from the keyword, secondary keyword, and value fields. Matching is Advanced only, so Simple mode leaves one tab and the panel renders the Details body with no strip, under the one-tab rule the stat panel introduced.

The entry manager takes the chosen tab and its change handler as props. In the World Editor the tab lives in the per-panel editor slot, survives selecting another entry in any book for the life of the session, and falls back to Details when unavailable. The library's dictionary editor mounts the same panel with the tab held in modal state, so it survives selecting another entry and resets when the modal closes.

A Find hit in the World Editor opens the owning tab before the reveal timer runs, through the shared tab-for-field helper and item guard with the entry panel's own map: `name`, `key[]`, `value` open Details; `secondaryKeys[]` opens Matching. Bench Open passes no hint and lands on the persisted tab. The library editor has no Find and passes no hint. The dev-router gains a `subtab` ledger entry for the World Editor's entry panel: `details`, `matching`.

There was no prototype. Check desktop in the preview beside the other panels for strip parity, in both hosts. Show the mobile form at 375px in context with static evidence and ask for approval; on approval, extend the Panel Tab Strip guide entry and showcase with the dictionary composition.

## Acceptance criteria

- [ ] Advanced: two tabs. Details shows Name, Trigger Keywords, Whole words, Case-sensitive, and Value and nothing else. Matching shows Always inject, Regex, Recursive, Scan depth, and Secondary Keywords with Require all and Exclude.
- [ ] Simple: no strip. Name, Trigger Keywords, Whole words, Case-sensitive, Value; no Always inject, Regex, Recursive, Scan depth, or Secondary Keywords.
- [ ] Selecting a book shows the book panel with no tab strip, in both hosts.
- [ ] The tab persists across selecting another entry, including one in another book; on Matching, switching to Simple lands on Details with no strip, and switching back restores the strip on Details.
- [ ] Regex on: the keyword and value fields lose the chip vocabulary and the comma split, as today.
- [ ] A Find hit in a secondary keyword from Details opens Matching and rings the chip; a hit in Value from Matching opens Details.
- [ ] Bench Open on an entry finding lands on the entry with the persisted tab.
- [ ] Library dictionary editor: two tabs on an entry, the tab persists across selecting another entry, and the palette bar sits above the strip.
- [ ] A new suite at the library modal's boundary covers the library cases above.
- [ ] The dev-router `subtab` ledger covers `details`, `matching`, and the drift test passes.
- [ ] The existing entry manager suite passes inside the Details tab.
- [ ] World Editor bench-harness tests cover every World Editor criterion above.
- [ ] Changelog: one 👤 entry in the In-Progress bucket, naming both hosts.
- [ ] Desktop verified in the preview at 1600x900 in both hosts beside the other panels; no export-shape change.
- [ ] Mobile evidence at 375px presented and approval recorded in the spec's Comments; guide entry and showcase extended together after approval.
- [ ] Four gates green; graph updated.

## Blocked by

- None (can start immediately)
