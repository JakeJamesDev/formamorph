# 11: Files carry relationships

Status: ready-for-agent
Status note: PAUSED with the linked-world-content effort. Ticket 03 removes the `LINKING_ENABLED`
flag and is the resume point.
Blocked by: 01, 08
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: touches the export shape of worlds and components, three import paths, offline behavior, and an older-importer compatibility check; regressions here corrupt player files.

## Parent

[spec.md](../spec.md) — Export/import portability, Settled follow-up decisions (Portability), open question 11.

## What to build

Exported files keep enough to reconnect content later, and imports respect what the file says.

A world export bundles its content in the native collections as today and adds relationship metadata: each linked copy's source identity, held revision, and a local-replacement marker where the player's edits diverge. A component export carries the component and its world associations, never a world. Both are additive; today's importer preserves unknown fields, and a test proves a file with these fields loads in the previous shape's reader without loss.

Importing a world file lands in the world details window as today, with a **Link bundled content to My Library** choice in the preference strip. Linked, the bundled content becomes the installed version and later source revisions arrive through update review; unlinked, the components are embedded. A local replacement in the file stays a local replacement on import; the file's content wins over a library copy. Importing a component file reviews the content name, offers installed compatible worlds to link and online worlds to download, and imports standalone when none is chosen. When the component's source already has a library item, Import opens that item's update review with the file as the incoming revision. Offline import proceeds from the bundle; unverifiable relationships stay unresolved and are not treated as deletions.

This is an export-shape change. Say so in the response and do not bump the version.

## Acceptance criteria

- [ ] A world export contains relationship metadata for each linked copy and a marker on each local replacement; re-import restores both.
- [ ] A component export contains the component and its associations and no world data.
- [ ] Importing a world with Link bundled content on links the copies to library items; off embeds them.
- [ ] Importing a world whose local replacement conflicts with a library copy keeps the file's content as a local replacement.
- [ ] Importing a component whose source has a library item opens the update review; otherwise it offers compatible worlds and imports standalone when none is chosen.
- [ ] Offline import of the same files completes with associations left unresolved and nothing reported missing.
- [ ] A reader built to the previous shape loads the new file without dropping data, proven by a fixture test.
- [ ] Type check, lint, tests, and build pass; the response names the export-shape change.

## Blocked by

- 01 — Link metadata on world content.
- 08 — Component update review.
