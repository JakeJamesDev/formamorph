# 04: Gates Read Global Scope

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: gate semantics change, with bundled worlds to audit.

## What to build

Gates follow R0. A requirement naming a global item reads global scope, from any trait (Q10). **You** reads the played entity and is unmet with none (Q13). **Same Owner** pairs only items in one entity's tree; a global trait never counts as the persona's (Q6). A world group Condition counts global items only. A linked trait belongs to the entity that links it, and the root pick and the link are held separately (Q17); the "holds X as a player trait" held reason and the played-entity link dedup go away. The requirement picker's stat section reads **Global Stats** and offers no owner choice for a global item. The Test Bench warns on a Same Owner row that pairs a global trait with an entity trait (Q14). Each bundled world is audited and its data fixed where a gate relied on the fold.

Spec: R0, Q1, Q1b, Q6, Q10, Q13, Q14, Q17, stories 3, 5–9, 18.

## Acceptance criteria

- [ ] A requirement naming a global item reads global scope under every persona and from an entity trait
- [ ] You reads the played entity and is unmet with no played entity
- [ ] Same Owner never pairs a global trait with an entity trait; a world group ignores a placed entity's traits
- [ ] A linked trait the root also holds counts for both holders
- [ ] The picker shows **Global Stats** and no owner choice for a global item
- [ ] The Test Bench warns on a crossing Same Owner row and stays quiet on a same-entity pair
- [ ] Every bundled world's gates hold as authored
- [ ] Existing gate suites keep their values except where Q6, Q10, Q13 or Q17 changes them; each change names its ruling
- [ ] `traitForceScope` gives a persona's link to a root pick in the persona's own part, once the dedup is gone (from ticket 01's review)
- [ ] Four gates green

## Blocked by

- 01, 03
