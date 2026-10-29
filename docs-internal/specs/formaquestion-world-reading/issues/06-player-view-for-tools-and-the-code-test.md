# 06: Player View for Tools and the Code Test

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a narrow change at the open-world registration, on a leak path.

## What to build

In the game, a Formaquestion Tool and the code test read the **Player View** (ticket 01), not the full world. The game registers a Tool Snapshot and an authored world built from the Player View; the World Editor keeps registering the full world. A Tool's script state holds only visible stats. This holds whether or not the Read the World switch is on.

Spec: Q20; stories 37, 38.

## Acceptance criteria

- [ ] In game, a Formaquestion Tool that looks up an unmet entity gets nothing
- [ ] In game, a Tool returns player description, never AI description
- [ ] In game, a Tool's script state has no hidden or disabled stat
- [ ] In game, the code test's names hold no unmet entity or hidden stat or trait
- [ ] In the World Editor, the Tool and the code test still read the full world
- [ ] Each test fails when the game registers the full world again
