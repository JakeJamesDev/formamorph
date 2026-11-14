# 08: Location Enabled Gate

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author gives a location an Enabled gate, and a disabled location is absent with its subtree.

- World shape: an Enabled gate on locations, using 07's editor and evaluation. A blank owner reads the played persona (Q29).
- A disabled location is absent from the world with its whole subtree: graph, map, list, AI. Connections through it break; routines fall back as for a missing place (Q2).
- If the player stands in it, it and its children stay visible to them until they leave (Q10).
- An enabled entity whose every place is disabled is offstage: out of every scene and the AI's reach, with its stats still running (Q27).
- The new-game start pick skips disabled starting locations (Q12).
- Docs: the wiki's location pages. Changelog fragment.
- ⚠️ Export-shape change for worlds.

Spec rulings: Q2, Q10, Q12, Q27, Q29.

## Acceptance criteria

- [x] Resolver tests: subtree removal, the standing exemption ending when the player leaves, a stranded entity offstage with stats still running. `inPlayWorld.locations.test.ts` (subtree, exemption moving and ending, stranded in the running cast, blank owner reads the persona); stats running in `GameViewer.locationEnabledGate.test.tsx`. Each guard bites when reverted.
- [x] The parity harness with a disabled parent location shows neither it nor its children in any reader output. `GameViewer.locationEnabledGate.test.tsx`: every AI request, presence and the script globals, with an on-gate control. World Tools and the Player View read `getInPlayWorldData`, pinned by `personaReaders.test.ts`.
- [x] A new game never starts in a disabled starting location. `GameViewer.locationEnabledGate.test.tsx` start pick, `startingLocation.test.ts`, and the Enter World list and persona preselect in `EnterWorldFlow.test.tsx`.
- [x] Frames: `.scratch/frames/location-enabled-gate.png`, light and dark, 1280 px. Playwright at 1280×800; dark copy ends in `-dark`.

## Landed

**Not verified**

- New game: the opening cast placement reads the resolver's verdicts from before the seed, as 02 left it. An entity whose start is off at the opening stands there, unseen, until the first placement moves it.
- Location gates at Enter World and new game read the picked Options and the authored stats, not the picked traits (`startGateInput`).
- Generic Entity Instances in a place that turns off: their routines lose the place like a Unique's; no test.
- A runtime character is never stranded: its place is where it stands, not an authored place. In an off place it is simply in no scene.

**For you**

- World Editor → a location → **Presence**: the **Enabled** rows sit first, in Simple mode. Check the hint: `.scratch/world-options-08/frames/location-enabled-gate.png` and `-dark.png`.
- In play: gate a district on a global stat, stand in a room inside it, and drop the stat. You stay and still see the room; step out and the district is gone.
