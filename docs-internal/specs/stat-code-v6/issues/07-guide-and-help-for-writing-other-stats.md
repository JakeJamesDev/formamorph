# 07: Guide And Help For Writing Other Stats

Status: done
Blocked by: 02, 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Docs only, written against behavior that has landed. Sonnet at medium effort.

## What to build

The Stat Code Guide gains a section on writing other stats: the four writable fields, same owner only, stat order and last write wins, the same-run snapshot rule, the Blueprint per-owner note, and the Test Bench finding. The existing lines that call `entities[x].stats` and `persona.stats` read-only stay. The in-app help for the Code tab gets the matching line in the help voice. Each code ticket carries its own changelog fragment, so this ticket adds none unless a line is still missing.

## Acceptance criteria

- [ ] The guide's new section covers the four fields, same owner only, stat order, the snapshot rule, the Blueprint note, and the finding
- [ ] The guide still says `entities[x].stats` and `persona.stats` are read-only
- [ ] The Code tab help line follows the help voice
- [ ] Help retrieval returns the new section for a player-worded question about moving another stat from code
- [ ] Four gates green

## Blocked by

- 02 (Code Writes Another Stat)
- 03 (Editor Follows The Write Side)
- 04 (Test Bench Two-Writers Finding)
