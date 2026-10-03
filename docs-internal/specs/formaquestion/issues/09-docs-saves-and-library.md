# 09: New pages, Saves and Backup, and Library

Status: done
Base: cf0a2553
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A player can read how progress is kept and how the main-menu library works. Two new docs pages cover them.

**Saves and Backup** covers: save, load, Quick Start, autosave, the save list, export and import of a save, backup and restore of all data, and where data lives on web, desktop and Android. It also covers the Update Required dialog and the desktop updater, or links to the install pages for them.

**Library** covers: the Worlds, Entities, Dictionaries and Avatars tabs; the board, tiles and zoom; folders and Groups; card menus; import and export of a world, an entity card and a dictionary; the library editors. Link to the linked content page for linked copies; do not repeat it.

Add "How to…" sections: save a game, load a game, back up everything, restore a backup, import a world, export a world, make a folder, move a tile.

Recommended model rationale: two contained surfaces with clear UI; the volume is moderate.

## Acceptance criteria

- [x] Both pages exist, follow the writing guide and use exact control names
- [x] Every main-menu library tab and every save or backup dialog maps to a heading
- [x] Storage statements are checked on each platform's code path
- [x] The sidebar and the home index list both pages
- [x] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [x] Four gates green
