# 11: Owned traits across library and import

Status: ready-for-agent
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Rationale: serialization rules with the entity file and adoption tests as prior art; the rules are exact and the failure is a silently open gate.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

A library entity's traits come with it into any world. Its requirements on that world's traits rebind by name when the name is unique, and stay locked otherwise. Old worlds and saves behave as before.

## Acceptance criteria

- [ ] An exported entity (entity file, library, character card) keeps a requirement into itself by id, and stores the target's name on a requirement that points out of it, including playing-as. This is an additive entity export change.
- [ ] Import rebinds an outward requirement only when exactly one trait, group, or persona in the new world carries that name. No match or two matches leaves it unresolved, locked, showing the stored name.
- [ ] A library persona's or added character's owned traits appear on its node at enter-world and in play.
- [ ] A world or save made before this change loads with every trait behaving as before.
- [ ] Entity file and adoption tests cover: self-owned ids kept, outward names kept, unique rebind, no match, two matches, playing-as rebind, legacy load.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
