# 06: New pages, How to Play and Starting a Game

Status: done
Base: 618cf31e
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A new player can read how a game starts and how a turn works. Two new docs pages cover it, and the How to Play help topic links to the first.

**How to Play** covers what the player does in a game:

- typing an action, choosing a choice, Ctrl+click on a choice, Continue the Story
- `[bracket]` direction to the narrator
- image attachments on an action
- regenerate, edit narration, rewind
- the side panel tabs: Notes and Logs (Memory and Entities have their own pages; link to them)
- changing location and the Map
- the game menu, export, the AI Context inspector
- narration layout (Pages or Chat), quote color and narration fonts, with the Settings path
- Error Details and Report Bug
- the Demo AI notice and the Like prompt

**Starting a Game** covers Enter World as one flow: pick a world, pick or make a persona, trait pages for each Bearer, Library Additions, Starting Location, the dictionary step, Start.

Write from the code and the UI labels. Use "How to…" sections with numbered steps (Q20). Add both pages to the wiki sidebar and the home page index.

Recommended model rationale: the game view is the largest surface in the app and has no docs to start from.

## Acceptance criteria

- [ ] Both pages exist, follow the writing guide and use exact control names
- [ ] Every in-game dialog and side-panel tab that a player can open maps to a section on one of the pages
- [ ] The How to Play help topic links a heading on the new page
- [ ] The sidebar and the home index list both pages
- [ ] The known-gaps entries for these surfaces are removed, and the coverage test passes
- [ ] Four gates green
