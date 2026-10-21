# 08: User Tool Convergence

Status: ready-for-agent
Blocked by: 01, 03, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shipped sandbox changes its whole surface, the runtime builds the script shapes from a different snapshot, and the Tool editor's tree and cards follow.

## What to build

A user Tool script reads the script surface, read-only: `args`, `entities`, `locations`, `location`, `memories`, `clock`, `persona`, `dictionaries`, `stats`, `traits`, `placeholders`, `notes`, `console` (spec: Surface, User Tool scripts after convergence). Every entry has the shape the Scripts surface gives it, with every verb absent, so a call is an ordinary not-a-function error (Q24). `world` and `scene` are gone (Q26). `notes`, the player's notes, is a string global on both surfaces. `clock` always exists; outside a game it reads the opening. The user Tool runtime builds the shapes from its Tool Snapshot, including the memories entries from the snapshot's memories. The user Tool surface composes from the script surface minus writes plus `args` and `console`; the Tool editor's Variable menu and cards show it; the guide links move with it. Formaquestion Tools, which share the sandbox, read the same surface. A World Tool script is unchanged beyond gaining `notes`.

Spec: Q22, Q24, Q26, stories 16, 20.

## Acceptance criteria

- [ ] A user Tool script reads `entities.Mira.location`, `location.present.length`, `memories.at(-1).text`, `dictionaries.Lore.entries` and `notes` from a Tool Snapshot; a test builds one snapshot and asserts each
- [ ] `memories.add`, `memories[0].pin`, `location.move`, `entities.Mira.move` and `diary` are absent; a call fails as not a function and the Tool returns the error
- [ ] `world` and `scene` are undefined in the sandbox and marked unknown in the editor
- [ ] `clock` reads the opening on a screen with no game; a world script reads `notes`
- [ ] The Tool editor's Variable menu and cards list the converged globals and no old ones
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)
- 06 (Dictionary Entries)
