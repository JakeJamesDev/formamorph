# 07: Show the Tools Tab

Status: ready-for-agent
Blocked by: 01 — Store Tools in Presets and the Catalog; 04 — Detect Tool Support per Endpoint and Model
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

A **Tools** tab in Settings, Advanced only, between Prompts and Endpoints, following prototype variant D and the stat Code Templates dialog layout. It shows the same preset selector as the Prompts tab. The list on the left splits Built-In (the catalog, in every preset) from My Tools, with import and export and a dashed New Tool entry. Selecting a Tool shows a read view: name, one-line summary, Enabled checkbox stored per preset, description, and the schema folded. The footer offers Duplicate for built-in Tools and Edit and Delete for the player's own, with a confirmation before a delete.

On a built-in preset the Enabled checkbox is disabled and Duplicate tells the player to duplicate the preset first. Duplicate on a user preset copies the built-in into My Tools. Full screen reuses the Prompts panel's morph and shell, titled "Tools"; the selection survives the toggle. A notice line shows when the active text endpoint will not receive Tools. Panes use the shared ScrollArea with one scroller each. The dev router reaches the tab in one `goto`.

Edit mode's contents (the four tabs and Try It) belong to ticket 08; this ticket lands the Edit button opening an empty edit shell with Cancel.

Model rationale: Opus at medium effort for a screen assembled from existing production components, the Settings modal's tab and full-screen plumbing, and component tests with prior art.

## Acceptance criteria

- [ ] The tab appears in Advanced only, in the specified order, reachable via the dev router.
- [ ] Built-In shows the catalog in every preset; My Tools shows the active preset's user Tools.
- [ ] Enabled writes the per-preset override; it is disabled on a built-in preset.
- [ ] Duplicate copies into the active user preset; on a built-in preset it shows the duplicate-the-preset message.
- [ ] Delete asks for confirmation and removes only the chosen Tool.
- [ ] Import and export round-trip through the tab, with the Script notice on import.
- [ ] Full screen toggles with the selection kept; the endpoint notice shows when capability is unknown or false.
- [ ] Verified in the preview with static DOM evidence, both themes.
- [ ] Component tests cover list, read view, Enabled, Duplicate, Delete, full screen and the notice; four gates green.
