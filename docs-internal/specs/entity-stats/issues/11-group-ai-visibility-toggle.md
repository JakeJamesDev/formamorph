# 11: Group AI-Visibility Toggle

Status: done
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: touches the Traits chip that every prompt carries, so the probe must cover traits as well as stats.

Parent: [Entity Stats spec](../spec.md)

## What to build

An author can group for their own tidiness without telling the AI. Trait groups and stat groups gain a toggle that lets the AI see the group's heading, on by default. With it off, the AI loses only the heading and description; the group's members still reach the AI as if ungrouped, and a nested group keeps its own heading and moves up one level. Rulings Q31, Q32, Q28.

## Acceptance criteria

- [ ] Trait groups and stat groups have the toggle in the editor, on by default.
- [ ] With it off, the Traits chip, stats chips, the Entities chip and the stat request skip that group's heading and description and keep its members.
- [ ] A nested group under a group with the toggle off keeps its heading, one level up.
- [ ] Migration fills existing groups with the toggle on; export and import round-trip it.
- [ ] Help copy for the toggle follows the Writing Guide.
- [ ] Probes for the Traits chip and the stat request show no regression on the cloud default model and Cydonia. Numbers go in the commit body.
- [ ] Response carries the export-shape reminder.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
