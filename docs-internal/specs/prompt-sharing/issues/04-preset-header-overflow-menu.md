# 04: Preset Header Overflow Menu

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/prompt-sharing/spec.md`

## What to build

On a narrow screen the preset header row in Settings → Prompts shows the preset selector and one overflow
menu. Desktop keeps the full button row.

- Below the `md` breakpoint the row shows the `Preset` label, the selector, and one ⋯ menu button.
- Menu order: Rename, Export, then a separator, then Reset, Delete. Ticket 07 adds Publish after Export.
- An action that does not render on desktop for the current preset is absent from the menu. A built-in
  preset shows Export only.
- Reset and Delete keep their confirm dialogs. The menu closes before the confirm opens.
- Build the action list once and render it as buttons or as menu items, so ticket 07 adds Publish in one
  place.
- Follow the design system and the context menu grammar. The ⋯ button has an accessible name.

## Acceptance criteria

- [ ] Below `md`: selector plus ⋯ only; at `md` and above: the existing row, unchanged
- [ ] Menu items and order match the list; built-in shows Export only
- [ ] Reset and Delete still confirm and still work from the menu
- [ ] A rendered test covers the item set for a user preset and for a built-in
- [ ] Checked in the preview at mobile width on a touch profile, both themes
- [ ] Changelog In-Progress entry added; four gates green
