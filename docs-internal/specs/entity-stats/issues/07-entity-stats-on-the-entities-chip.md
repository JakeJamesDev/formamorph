# 07: Entity Stats on the Entities Chip

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: one new chip piece following the stats chip's renderer; the work is the probe run.

Parent: [Entity Stats spec](../spec.md)

## What to build

The narrator, the choice writer and the planner know the present entities' stats. The Entities chip gains a stats piece, on by default, that lists each entity's AI-visible stats with value, status and meaning. Rulings Q14, Q28.

## Acceptance criteria

- [ ] The Entities chip has a stats piece, on by default, toggled in the chip editor like its other pieces.
- [ ] It renders each entity's enabled stats with value, status and meaning, in the chip's format (simple, markdown, xml).
- [ ] Hidden stats still render (hidden means hidden from the player); switched-off stats don't.
- [ ] An entity with no stats renders as before.
- [ ] The affected prompts' probes show no regression on the cloud default model and Cydonia, with the piece off as the in-batch control. Numbers go in the commit body.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
