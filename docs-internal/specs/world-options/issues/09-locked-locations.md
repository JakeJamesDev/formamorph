# 09: Locked Locations

Status: ready-for-agent
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

- [ ] Travel-gate tests: refused from the List, the Map, the chip, the router and the start pick; allowed for `location.move`.
- [ ] A script writing an Option that the Lock gate tests unlocks the location at that write's timing.
- [ ] The AI context still includes a locked location and its entities.
- [ ] The lock line never names a hidden Option; the guard bites when 04's filter is bypassed.
- [ ] Playwright: clicking a locked location on the List and on the Map leaves the player where they were.
- [ ] Frames: `.scratch/frames/locked-list.png` and `.scratch/frames/locked-map.png`, light and dark, 1280 px.

For you: whether the locked state reads clearly on the List and the Map.
