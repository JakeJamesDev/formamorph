# 24: Entity Nodes in the Stats Tree

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: brings the Traits tab's entity nodes, cross-owner drags and drag-to-link to the stat tree; the refusal rules for a moved stat are the hard part.

Parent: [Entity Stats spec](../spec.md)

## What to build

Today the World Editor's **Stats** tab shows world stats and Blueprints only. An entity's own stats show only on that entity's **Stats** tab. The **Stats** tab's tree now matches the **Traits** tab's tree for owned stats (ruling Q79, from Q7 and Q16):

1. **Entity nodes.** An entity that owns a stat, a stat group or a stat Link shows as a node, with the user icon and "Entity" or "Playable" as meta. An entity that owns none shows no node. Selecting a node shows the entity's name and **Open Entity**, as on the **Traits** tab.
2. **Placement.** The author drags an entity node into their own stat groups and reorders it. A node can't sit under Blueprints. Which entities get nodes (Custom Persona included) matches the **Traits** tab.
3. **Cross-owner drags.** A stat or a stat group drags between the world and an entity, or between entities, with every id kept. Refusals follow the trait rules, with the same dismissible note. A move is refused when something reads the stat on its current owner and the move would break that reference. The ticket session brings the exact list to the spec session before building.
4. **Drag to link.** A Blueprint stat dropped on an entity node links it. Refusals match **Link Stat** (Q61, Q73).

## Acceptance criteria

- [ ] Entity nodes show in the **Stats** tab tree only for entities that own a stat, a stat group or a stat Link, with the trait node's icon and meta.
- [ ] Entity nodes place and reorder inside stat groups, and their placement saves with the world. A placement that names Blueprints reads as top level.
- [ ] Cross-owner drags of stats and stat groups keep ids. Each refusal shows the dismissible note with its reason.
- [ ] Dropping a Blueprint stat on an entity node creates a stat Link. A refused link shows the note.
- [ ] The **Stats** tab's search keeps matching world stats only, as Q12 of entity-traits-mirror rules for traits.
- [ ] Tree tests extend the trait tree's entity node cases to stats. An e2e drag spec mirrors `trait-entity-nodes`.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
