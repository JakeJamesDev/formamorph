# 07: New page, Settings

Status: in-progress
Base: 618cf31e
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can look up any setting. One new docs page covers the Settings window tab by tab, except Prompts and Tools, which ticket 08 owns.

- **Display:** theme, fonts, narration layout, quote colors, and the rest of the tab.
- **Output:** every section: Turn Extras, Reasoning (the thinking modes and Limit Active Characters), Memory, Time, Lore, Characters, Choices, Attachments, Performance. State which sections show in Advanced mode only.
- **Endpoints:** the Text, image and other endpoint tabs. Link to the connect page for setup steps; do not repeat them.
- **Data:** backup, restore, the Authoring Tour entry, and the rest of the tab.

For each setting: its label, what it does, and the trade-off. Take the wording of the effect from the app's own settings copy so the page and the UI agree; do not paste the copy.

Add "How to…" sections for the common tasks: change the narration layout, turn on a thinking mode, limit active characters, turn memory summaries off, back up data.

If the page grows past what one page should hold, split Output into its own page and say so in the commit body.

The ticket 01 gate checks only ids in the dev-router ledger. The Endpoints sub-tabs have no id, so the gate does not enforce them. Add their ids to the ledger and the surface map, or check them by hand and list them in the commit body.

Recommended model rationale: the settings surface is wide, and each row's real effect must be read from code, not from its label.

## Acceptance criteria

- [ ] Every tab and section of Settings except Prompts and Tools maps to a heading on the page
- [ ] Every setting a player can see is named with its exact label
- [ ] Advanced-only sections and settings are marked
- [ ] The sidebar and the home index list the page
- [ ] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [ ] Four gates green
