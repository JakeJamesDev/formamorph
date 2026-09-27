# 07: Persona-only entities

Status: ready-for-human
Base: bc1fc8d3
Blocked by: 01 — Link data and bearer resolution
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: one flag and one filter applied at every cast reader. The list of readers is the work; the logic is small.

Parent: [Trait Links spec](../spec.md)

## What to build

An author marks a persona as persona-only. That entity exists only while it is the picked persona. When the player plays someone else, it is absent from the roster, the scene, the planner, diaries, discovery and the opening pool.

## Acceptance criteria

- [x] The entity editor shows a Persona-only switch under the Persona mark, with a help line in the Writing Guide's voice. The flag reads only with the Persona mark.
- [x] The persona cast filter, read through the bearer-resolution module, leaves out an unpicked persona-only entity everywhere the cast is read: the roster, participation, diaries, discovery, scene tags, the planner, the entity panel, and the opening pool.
- [x] A persona-only entity's openings count only while it is picked.
- [x] Persona story 38 is amended: an unpicked persona-only entity does not return to the cast.
- [x] Tests cover the filter at each reader through the shared seam, and the openings pool with the entity picked and unpicked. Component tests cover the switch.
- [x] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
