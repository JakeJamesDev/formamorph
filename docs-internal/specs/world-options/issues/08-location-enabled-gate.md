# 08: Location Enabled Gate

Status: ready-for-agent
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

- [ ] Resolver tests: subtree removal, the standing exemption ending when the player leaves, a stranded entity offstage with stats still running.
- [ ] The parity harness with a disabled parent location shows neither it nor its children in any reader output.
- [ ] A new game never starts in a disabled starting location.
- [ ] Frames: `.scratch/frames/location-enabled-gate.png`, light and dark, 1280 px.
