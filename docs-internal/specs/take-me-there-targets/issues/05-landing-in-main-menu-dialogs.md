# 05: Landing in Main Menu Dialogs

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5.

## What to build

Dialogs and tabs hosted by the main menu land targets with the shared hook: the Library tabs, Community, Avatars, Saves and Backup, Starting a Game, Install on Android, Connect Your Own AI, Personas and Profile. Every how-to section on those pages that ends at a control gets its target and registry entry.

## Acceptance criteria

- [ ] Each listed host lands a target: scroll, focus, pulse once; a missing target lands silently
- [ ] Every how-to section on the listed pages that ends at a control carries a target; the report-only check lists none for them
- [ ] Docs checks and existing surface tests stay green
