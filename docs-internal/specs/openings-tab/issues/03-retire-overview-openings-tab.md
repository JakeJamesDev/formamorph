# 03: Retire the Overview Openings Tab

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: Find, undo reveal and Take Me There each route openings through the Overview place today, and every route has to move without stranding an old history origin.

## What to build

Openings get one home in the tab strip (Q1, user story 26).

- The Overview right column keeps Details and Custom Prompts. Its Openings tab and the "Use These Openings" checkbox go away. The Overview place loses its Openings value.
- **Find**: an opening field key opens the Openings tab with its owner selected. This World's openings select This World.
- **Undo and redo**: an opening edit reveals the Openings tab with its owner selected, wherever the edit was made. An Overview history origin that recorded Openings now reveals on the new tab.
- **Take Me There**: the help window's openings route points at the Openings tab. The Overview tab ledger loses Openings.
- The old world-level Openings panel code goes away when nothing uses it. The entity and location Openings tabs keep the list they share with the new tab.
- The World Editor Overview docs and the help topics that mention Overview → Openings point at the new tab.

## Acceptance criteria

- [ ] Overview shows Details and Custom Prompts only (editor-bench test)
- [ ] Find on an opening match lands on the Openings tab with that owner selected, for This World, a location and an entity (editor-bench test, mutation-tested)
- [ ] Undo of an opening edit, from another tab, opens the Openings tab on that owner (editor-bench test, mutation-tested)
- [ ] The help window's openings route opens the Openings tab (route-table test)
- [ ] Docs and help topics updated; a changelog fragment is written
