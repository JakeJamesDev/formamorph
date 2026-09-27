# 01: Link data and bearer resolution

Status: ready-for-human
Base: 42a74462
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: the main seam of the effort. Five additive shapes and one pure module that every later ticket reads through, so the rules must be right the first time.

Parent: [Trait Links spec](../spec.md)

## What to build

The world can hold links, the two system nodes and persona-only entities, and one pure module answers "which traits does each bearer have" for every reader. Nothing renders yet. A test can build a small world, name a persona, and read back each bearer's tree, the cast and the gate input.

## Acceptance criteria

- [ ] An entity's owned tree gains link items with their own id, the original's id and kind, a stored original name, a place in the tree, and per-link data: default-on keyed by original trait id, and pin values keyed by original trait id and target placeholder name. Additive world, entity and card export change.
- [ ] The world gains an optional Templates group and an optional Custom Persona node, at most one of each. Custom Persona holds links only. An entity gains an optional persona-only flag, read only with the Persona mark. A requirement gains an optional bearer scope (You or an entity id with a stored name). A trait pin can target a placeholder by name relative to the bearer. All additive.
- [ ] A pure bearer-resolution module takes the world and the persona ref and returns every bearer's effective tree with links expanded to their originals' live subtrees, Templates left out, the cast with unpicked persona-only entities left out, and the gate input with one owner per bearer.
- [ ] Root traits outside Templates stay the player's whatever the persona. Custom Persona's links apply to the player under None and under a library persona. A world persona's bearer tree is its own owned traits and links.
- [ ] Expansion is one level: originals are world nodes only, and a linked group's subtree skips entity nodes placed inside it. A link whose original is missing resolves to nothing.
- [ ] The module exposes the one-original-per-bearer check that the editor, flyout and import call before adding a link.
- [ ] Table-driven tests cover: link to a trait, link to a group with a later-added child, a refused duplicate, a linked group with an entity node inside it, Templates hidden at root, Custom Persona under None and under a library persona, a world persona's tree, a persona-only entity in and out of the cast, and a missing original.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
