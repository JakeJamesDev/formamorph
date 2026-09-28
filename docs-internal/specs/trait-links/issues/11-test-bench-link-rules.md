# 11: Test Bench link rules

Status: ready-for-human
Base: 93424d0d
Blocked by: 05 — Gates per bearer; 06 — Pins per bearer
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: three rules and one lens change on the existing pure `runRules` seam, with the gate and pin rules as prior art.

Parent: [Trait Links spec](../spec.md)

## What to build

The Test Bench warns when a linked trait can never unlock for its bearer, when a link has no value for a bearer-relative pin, and when a bearer-relative pin names no placeholder on the bearer or the world. Each finding jumps to the link. The lens checks every bearer as if picked.

## Acceptance criteria

- [x] The never-unlockable rule runs per bearer and names the bearer in its finding, such as "Albus links Smite but has no Faithful".
- [x] A new rule reports a link with no value for a bearer-relative pin, with a jump to the link.
- [x] A new rule reports a bearer-relative pin whose name matches no placeholder on the bearer or the world.
- [x] A new rule reports a redundant link: one whose original another link on the same bearer already reaches through a linked group (Q64). The resolver already yields each original once per bearer; if ticket 01's module does not, add that there in this ticket.
- [x] The lens reads bearer trees through the bearer-resolution module and checks every bearer as if picked: world personas, persona-only entities, and Custom Persona as the None player with the root traits.
- [x] Rule tests cover each finding and its jump target, with the pin rules as prior art. Lens tests cover a persona-only bearer and Custom Persona.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
