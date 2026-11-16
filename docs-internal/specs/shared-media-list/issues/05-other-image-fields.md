# 05: Other Image Fields

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The rest of the world's images move onto the Media List (Q1): item images, map images, body backdrop images and the world cover. Each follows ticket 03's pattern and uses ticket 04's picker slot.

- The `migrateWorld` step from ticket 03 extends to these fields, merging identical files.
- Every reader of these fields resolves through the resolver: item rows and the doll, the map background, body backdrops, the world cover in the library, menu and publish.
- Their editor fields use the picker slot.
- Dictionary covers stay embedded.

## Acceptance criteria

- [ ] A world with item images, map images, a backdrop image and a cover migrates on load, idempotently, and shows the same in the editor and in play.
- [ ] An item and an entity using the same picture link one entry.
- [ ] Each of these fields can Import, Choose and Unlink through the picker slot.
- [ ] The world cover still shows on the library card and in the publish dialog.
- [ ] A dictionary cover is unchanged.

> ⚠️ Export shape: these fields now hold ids in world JSON. Remind the user.
