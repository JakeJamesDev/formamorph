# 08: Game World Pick Prompt

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a one-line prompt change that must ship with probe numbers.

## What to build

The world pick request tells the model its sections are "the parts of the world open in the World Editor". The game sends the same line over Player View rows. In game, the line names what the list really holds: what the player has met. The editor line stays as it is, so editor picks don't move.

Found in the close review. Spec: "Player View rows form a game World Index, ranked like the editor pool (keyword, its own pick request, semantic)".

## Acceptance criteria

- [ ] A game world pick request carries a game line; an editor world pick request is byte-equal to today's
- [ ] The guide pick request is byte-equal with and without a world open
- [ ] `probe:world-question` game arm, before and after, cloud default, 5 runs per arm, recorded in the ticket
