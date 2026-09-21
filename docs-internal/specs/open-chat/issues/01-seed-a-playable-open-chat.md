# 01: Seed a Playable Open Chat

Status: ready-for-human
Base: 212b9e81
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

Open Chat appears on the Main Menu as a bundled default world and plays. The world is a neutral harness: no premise, zero stats, one near-empty location with no connections, no authored entities, no dictionary. The world player setting is Open. One world Opening of kind Player Action holds neutral text that the player can edit before submitting. The openings of a picked entity still win.

The world joins the bundled default list with a stable id, so the existing seeder and tombstones cover install, update, and delete. It uses existing world fields only. The thumbnail slot stays empty (ticket 06).

Author the file with a script, as the default worlds refresh did. Never dump a bundled world file raw.

## Acceptance criteria

- [x] Open Chat seeds on a clean profile and on an existing profile, checked live through the dev-router
- [x] Deleting Open Chat keeps it deleted after a Main Menu remount
- [x] A content test loads the bundled file through the world migration, runs the Test Bench rule runner, and asserts the exact finding set: location-no-entities (by design, stays), world-empty-system-prompt (ticket 03 removes it), world-no-readme (ticket 05 removes it). This ticket writes no prompt text and no readme copy
- [x] The same test asserts: zero stats, one location, Open player setting, one Player Action opening, no entities
- [x] A turn-plan test with the counts of this world and default settings asserts narration and choices are due, and the stat-update pass and both location passes are absent (no exact-list assertion; player-setting passes such as the memory digest stay on)
- [x] The default-world id tests cover the new id
- [x] One full turn runs live with a picked library entity
- [x] No export-shape change; the response says so
- [x] Four gates green
