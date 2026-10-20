# 10: Planner Cast Contract

Status: ready-for-agent
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A default prompt change. Read the prompt-writing guide first and follow the probe skill.

## What to build

The planner stops casting nearby and known entities as present. Ticket 09's probe found that the default thinking prompt lists `<ENTITIES|reachable>` but its Cast rules never say those entities aren't here. In Emberwatch's Ashford Square, once Connections count as nearby, the plan for a neutral action put the captain, Mother Hesk and Wenna in the square in 8 of 8 runs (0 of 8 before). Every world with a non-empty reachable roster already has this gap.

## Acceptance criteria

- [ ] The default thinking prompt's Cast rules state, as a positive contract, that entities from the reachable and known rosters are elsewhere and join the cast only when the action brings them in.
- [ ] Any other default prompt that casts a scene and reads those rosters gets the same contract. Check the director prompt.
- [ ] Probe numbers on the cloud default, reusing ticket 09's `nearby-connections-probe.cli.ts`. Arms: the old prompt as the in-batch control, and the new prompt. Cases: plan-neutral cast-leak (target 0), plan-lore uptake (entities still named when the action asks about them), and narration present-leak. Use at least 8 runs per arm.
- [ ] A local Cydonia run confirms the result, in an agreed window.
- [ ] The parity suite is updated for the changed prompt text.
