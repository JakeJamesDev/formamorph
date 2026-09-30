# 04: Save Attachments

Status: ready-for-human
Base: 69487fd3
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A playthrough's attachments go into its save, so a loaded save shows the thumbnails under past actions, also on another machine. The save is always self-contained. This is not an opt-in like scene images. A loaded save's thumbnails show even when Image Attachments is off.

⚠️ Export-shape change (additive): the save envelope gets an optional attachment map keyed by turn id. A save without it loads with no attachments. The feature is unreleased, so there is no migration.

## Acceptance criteria

- [x] Saving writes the turn-id map when it has entries.
- [x] Loading restores it, and the thumbnails render on the right actions.
- [x] A save with no map loads cleanly.
- [x] The save writes the map as it is. Ticket 01 already prunes it against history whenever no turn runs, so it holds no orphans.
- [x] Verify on the dev route `#dev?view=gameViewer&fixture=whiteRoom&attach=sample`, which stages two pending images and two on the latest turn.
- [x] Tests: an attachment store save round trip; a load of a save without the map.
