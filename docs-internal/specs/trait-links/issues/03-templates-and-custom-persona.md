# 03: Templates and Custom Persona

Status: ready-for-human
Base: cb4b8820
Blocked by: 02 — Links in the editor
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: two system nodes with clear rules, layered on the link row from ticket 02. Moderate editor work, little new logic.

Parent: [Trait Links spec](../spec.md)

## What to build

An author adds a Templates group and a Custom Persona node from the Traits tab's **+** menu. Traits under Templates are never offered directly and reach play only through links. Custom Persona holds links that become the player's traits under None or a library persona. Each node exists at most once, shows in Basic when non-empty, and removes cleanly.

## Acceptance criteria

- [ ] The **+** menu gains **Add Templates Group** and **Add Custom Persona** in Advanced, each hidden once its node exists.
- [ ] Templates holds originals only. Nothing under it is offered at enter-world or in play, and the drop projection never places a link inside it.
- [ ] Custom Persona accepts links only, by drag and by the drop projection. Its links resolve to the player under None and under a library persona through the bearer-resolution module.
- [ ] Removing Templates moves its contents to the root, the same as removing a group, and the confirmation says those traits become offered to the player. Removing Custom Persona deletes its links after a confirmation that names the count.
- [ ] With Advanced off, a non-empty system node still shows and stays editable. Creating one stays Advanced-only.
- [ ] Component tests cover both menu entries, the at-most-one rule, both removals and Basic visibility.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
