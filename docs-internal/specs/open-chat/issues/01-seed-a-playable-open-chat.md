# 01: Seed a Playable Open Chat

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

Open Chat appears on the Main Menu as a bundled default world and plays. The world is a neutral harness: no premise, zero stats, one near-empty location with no connections, no authored entities, no dictionary. The world player setting is Open. One world Opening of kind Player Action holds neutral text that the player can edit before submitting. The openings of a picked entity still win.

The world joins the bundled default list with a stable id, so the existing seeder and tombstones cover install, update, and delete. It uses existing world fields only. The thumbnail slot stays empty (ticket 06).

Author the file with a script, as the default worlds refresh did. Never dump a bundled world file raw.

## Acceptance criteria

- [ ] Open Chat seeds on a clean profile and on an existing profile, checked live through the dev-router
- [ ] Deleting Open Chat keeps it deleted after a Main Menu remount
- [ ] A content test loads the bundled file through the world migration, runs the Test Bench rule runner, and asserts zero findings
- [ ] The same test asserts: zero stats, one location, Open player setting, one Player Action opening, no entities
- [ ] A turn-plan test with the counts of this world and default settings asserts the pass list is narration plus choices
- [ ] The default-world id tests cover the new id
- [ ] One full turn runs live with a picked library entity
- [ ] No export-shape change; the response says so
- [ ] Four gates green
