# 03: Retire the Overview Openings Tab

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: Find, undo reveal and Take Me There each route openings through the Overview place today, and every route has to move without stranding an old history origin.

## What to build

Openings get one home in the tab strip (Q1, user story 26).

- The Overview right column keeps Details and Custom Prompts. Its Openings tab and the "Use These Openings" checkbox go away. The Overview place loses its Openings value.
- **Find**: an opening field key opens the Openings tab with its owner selected. This World's openings select This World.
- **Undo and redo**: an opening edit reveals the Openings tab with its owner selected, wherever the edit was made. An Overview history origin that recorded Openings now reveals on the new tab.
- **Take Me There**: the help window's openings route points at the Openings tab. The Overview tab ledger loses Openings. The help baseline case for adding an opening still names the Overview surface (left by 01); move it to the Openings tab too.
- The old world-level Openings panel code goes away when nothing uses it. The entity and location Openings tabs keep the list they share with the new tab.
- The World Editor Overview docs and the help topics that mention Overview → Openings point at the new tab.

## Acceptance criteria

- [x] Overview shows Details and Custom Prompts only (editor-bench test): `WorldEditor.overviewPanel.test.tsx` "splits the right column into Details and Custom Prompts".
- [x] Find on an opening match lands on the Openings tab with that owner selected, for This World, a location and an entity (editor-bench test, mutation-tested): `WorldEditor.openingsTabRoutes.test.tsx` "a Find hit in an opening"; routing the targets back to `overview` turns all three red.
- [x] Undo of an opening edit, from another tab, opens the Openings tab on that owner (editor-bench test, mutation-tested): same file, undo and redo for all three owners; dropping `openings` from the reveal tabs turns all three red, and dropping the This World place fallback turns the This World case red. An edit on an entity's own Openings tab still returns there (Q22).
- [x] The help window's openings route opens the Openings tab (route-table test): `surfaceRoute.test.ts` "opens a world's openings on the World Editor's Openings tab, not on Overview".
- [x] Docs and help topics updated; a changelog fragment is written: Overview and Openings wiki pages, Design System strip table, both help baseline openings cases; `docs-internal/changelog.d/openings-tab-03.md`.

## Landed

**Not verified**

- Nothing unticked. No browser frame: the change removes a tab and reroutes, and the bench reads cover it.

**For you**

- The unreleased changelog entry "The World Editor's Overview tab puts Custom Prompts and Openings on tabs of their own." still names the Overview Openings tab and its checkbox. A fragment can't edit it; it needs rewording on main.
- Between this landing and ticket 04, a world with a stored off flag has no switch to turn its openings back on (accepted, Q23).
