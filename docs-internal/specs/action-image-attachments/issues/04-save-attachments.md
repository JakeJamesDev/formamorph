# 04: Save Attachments

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A playthrough's attachments go into its save, so a loaded save shows the thumbnails under past actions, also on another machine. The save is always self-contained. This is not an opt-in like scene images. A loaded save's thumbnails show even when Image Attachments is off.

⚠️ Export-shape change (additive): the save envelope gets an optional attachment map keyed by turn id. A save without it loads with no attachments. The feature is unreleased, so there is no migration.

## Acceptance criteria

- [ ] Saving writes the turn-id map when it has entries.
- [ ] Loading restores it, and the thumbnails render on the right actions.
- [ ] A save with no map loads cleanly.
- [ ] Map entries for turns that no longer exist are pruned, following the scene images pruning.
- [ ] Tests: an attachment store save round trip; a load of a save without the map.
