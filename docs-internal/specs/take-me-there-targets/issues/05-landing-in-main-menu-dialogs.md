# 05: Landing in Main Menu Dialogs

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5.

## What to build

Dialogs and tabs hosted by the main menu land targets with the shared hook: the Library tabs, Community, Avatars, Saves and Backup, Starting a Game, Install on Android, Connect Your Own AI, Personas and Profile. Every how-to section on those pages that ends at a control gets its target and registry entry.

## Acceptance criteria

- [ ] Each listed host lands a target: scroll, focus, pulse once; a missing target lands silently
- [ ] Every how-to section on the listed pages that ends at a control present when its surface opens carries a target (Q8 gate rows included). The report-only check lists only sections that end at a menu item, a tile, or a dialog the request cannot open (Q11): Library#how-to-export-a-world, how-to-export-an-entity-or-a-dictionary, how-to-make-a-group, how-to-add-a-tile-to-a-group, how-to-remove-a-tile-from-a-group, how-to-move-a-tile, how-to-change-a-tiles-size, how-to-rename-a-group, how-to-delete-a-group; Avatars#how-to-export-an-avatar; Personas#how-to-make-a-persona, how-to-set-a-default-persona; Saves-and-Backup#how-to-load-a-game, how-to-export-a-save; Starting-a-Game#how-to-start-a-game, how-to-start-with-the-defaults; Install-on-Android#how-to-get-beta-builds; Connect-Your-Own-AI#how-to-use-the-desktop-engine. Community, Profile, Enter World and the Library dialogs register no target: their how-tos end in a world card, a nested dialog, or a dialog the request cannot open.
- [ ] Docs checks and existing surface tests stay green
