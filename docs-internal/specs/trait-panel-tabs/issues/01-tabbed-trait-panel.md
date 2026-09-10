# 01: Tabbed Trait Panel

Status: in-progress
Base: 5d4bdd7c
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

The whole spec in one unit. Every shared mechanism is on `main` from the entity, location, and stat efforts, so this is a tab module, a field map, a ledger entry, the layout, and its tests, plus the mobile form with the guide extension on approval.

## What to build

Selecting a trait in the World Editor shows the shared Panel Tab Strip, named "Trait Fields", with Details, Stats, and Pins in Advanced mode, under the placeholder palette bar. Selecting a trait group still shows the group panel with no strip.

Details stacks Name, Player-Facing Description, AI-Facing Description, both resizable as today, then the Enabled by Default and Player Can Toggle In-Game checkboxes with their notes. Stats stacks Stat Changes, then Stat Availability with its conflict notes; every row, Add button, help control, and note keeps its current shape. Pins holds the Placeholder Pins label, its help control, and the pin rows. Stat Availability and Pins are Advanced only, so Simple mode shows two tabs, Details and Stats.

The chosen tab survives selecting another trait for the life of the editor session and is held by the editor in the same slot shape as the other three panels; when the chosen tab is unavailable the panel shows Details. A Find hit opens the owning tab before the reveal timer runs, through the shared tab-for-field helper and item guard with the trait panel's own map: `name`, `playerDescription`, `aiDescription` open Details; `placeholderPins[].value` opens Pins. Bench Open and the rival-trait link in a conflict note both go through item navigation with no hint and land on the persisted tab. The dev-router gains a `subtab` ledger entry for `details`, `stats`, `pins`.

There was no prototype. Check desktop in the preview beside the entity and location panels for strip parity. Show the mobile form at 375px in context with static evidence and ask for approval; on approval, extend the Panel Tab Strip guide entry and showcase with the trait composition.

## Acceptance criteria

- [x] Advanced: three tabs. Details shows Name, the two descriptions, Enabled by Default, and Player Can Toggle In-Game and nothing else. Stats shows the Stat Changes and Stat Availability labels with their Add buttons. Pins shows Placeholder Pins with its help control.
- [x] Simple: two tabs. Stats shows Stat Changes and its Add button; no Stat Availability.
- [x] Selecting a trait group shows the group panel with no tab strip.
- [x] The tab persists across selecting another trait, including one in a different group; on Pins, switching to Simple lands on Details.
- [x] A Find hit in AI-Facing Description from Stats opens Details and rings the field; a hit in a pinned value from Details opens Pins.
- [x] Bench Open on a trait finding lands on the trait with the persisted tab.
- [x] Clicking a rival trait in a Stat Availability conflict note lands on that trait on the Stats tab.
- [x] The dev-router `subtab` ledger covers `details`, `stats`, `pins`, and the drift test passes.
- [x] The existing trait manager suite passes inside its tabs.
- [x] World Editor bench-harness tests cover every criterion above.
- [x] Changelog: one 👤 entry in the In-Progress bucket.
- [x] Desktop verified in the preview at 1600x900 beside the entity and location panels; no export-shape change.
- [x] Mobile evidence at 375px presented and approval recorded in the spec's Comments; guide entry and showcase extended together after approval.
- [x] Four gates green; graph updated.

## Blocked by

- None (can start immediately)
