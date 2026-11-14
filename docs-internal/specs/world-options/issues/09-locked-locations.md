# 09: Locked Locations

Status: ready-for-human
Blocked by: 04, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author locks a location behind a gate; the player sees it but cannot enter until it unlocks.

- World shape: a Lock gate and optional Locked text on locations, using 07's editor and evaluation. A blank owner reads the played persona.
- One travel-gate function answers whether the player can be moved into a location. The List, the Map, the Move-to chip, the router's candidate walk and the start pick all call it. A script's `location.move` does not (Q3, Q12).
- The List and the Map show a locked location with the Locked text, or else the lock line with hidden Options left out (04's helper), or "Locked" when nothing remains (Q11).
- The AI still sees a locked location and who is inside (Q28).
- Write a new ADR: Lock binds player travel and supersedes that part of ADR-0006; navigation rules still bind only the AI.
- Glossary: Locked in its location sense. Docs: the wiki's location and travel pages. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q3, Q4, Q11, Q12, Q28.

## Acceptance criteria

- [x] Travel-gate tests: refused from the List, the Map, the chip, the router and the start pick; allowed for `location.move`. `GameViewer.lockedLocation.test.tsx` (List, router and narrated move, Move-to chip re-check, start pick, `location.move`), `LocationModal.test.tsx` (List and Map refusal), `inPlayWorld.locks.test.ts` (subtree, standing inside, walk waypoints, start fallback). Each guard bites when removed.
- [x] A script writing an Option that the Lock gate tests unlocks the location at that write's timing. `GameViewer.lockedLocation.test.tsx` "unlocks the place once a script writes the Option": an After the AI write opens the List at the turn's end.
- [x] The AI context still includes a locked location and its entities. `lockedPlaces.test.ts` (Reachable chips keep the place and Harrow; only destinations drop it) and `GameViewer.lockedLocation.test.tsx` (Known In reaches the narrator). The Test Bench gates its destinations under the lens too (`aiContext.test.ts`).
- [x] The lock line never names a hidden Option; the guard bites when 04's filter is bypassed. `inPlayWorld.locks.test.ts` "never names a hidden Option": red with `revealHidden: true`.
- [x] Playwright: clicking a locked location on the List and on the Map leaves the player where they were. `e2e/locked-locations.spec.ts` on the `lockedPlaces` dev fixture; both red with the List refusal removed.
- [x] Frames: `.scratch/frames/locked-list.png` and `.scratch/frames/locked-map.png`, light and dark, 1280 px. Playwright at 1280×800; dark copies end in `-dark`.

## Landed

**Not verified**

- Lock-line precedence when a child has a failing gate of its own and no Locked text: it shows its own gate line, not an ancestor's Locked text. Q53 names the child's own Locked text, else the nearest lock's line; the child is then its own nearest lock.
- Mobile: the Playwright spec runs desktop only; the Map's lock line lives in its tooltip, which a touch screen never opens. The List shows the line inline.

**For you**

- For you: whether the locked state reads clearly on the List and the Map. Frames: `.scratch/world-options-09/frames/locked-list.png`, `locked-list-dark.png`, `locked-map.png` and `locked-map-dark.png`. The row reuses the locked trait row's look (lock glyph, muted name, line under it); the Map box shows the lock and puts the line in its tooltip. Say whether it needs a Design System entry.
- World Editor → a location → **Presence**: the **Unlocked** rows and **Locked Text** sit under **Enabled**.
- ⚠️ Export shape: worlds gain `unlockedWhen` and `lockedText` on locations.
