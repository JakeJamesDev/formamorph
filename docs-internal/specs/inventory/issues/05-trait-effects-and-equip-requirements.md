# 05: Trait Effects And Equip Requirements

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

Opus at xhigh: a new trait source beside the trait runtime, and a fixed-point cascade that must terminate.

## What to build

Items grant traits and gate equipping. The item editor gets trait effect rows (a trait, a timing) and equip Requirement Rows.

An item-granted trait is an extra active source (Q52): the trait is on while any source holds, so losing the item never strips a trait the owner already had. Item grants ignore Pick Count and switch off no group siblings, and an item cannot grant an Automatic trait.

Equipping checks the item's equip requirements, ignoring the item's own effects in both directions (Q49). When an equipped item's requirement stops holding, it unequips on its own and its effects reverse (Q48). Cascades (an unequip fails another requirement, traits settle) settle to a fixed point under a cap, then stop with a diagnostic (Q66).

Spec: Q9, Q46, Q48, Q49, Q52, Q66; stories 18, 20, 31–34.

## Acceptance criteria

- [ ] Trait effect rows and equip Requirement Rows edit in the item editor; the trait picker excludes Automatic traits
- [ ] A While Owned trait grant turns the trait on; losing the item turns it off unless another source holds
- [ ] A trait the owner picked stays on when the granting item leaves
- [ ] An item grant does not count toward Pick Count and does not switch off a group sibling
- [ ] Equipping fails with a diagnostic when the requirement does not hold
- [ ] A +Strength sword cannot keep itself equipped, and a -Strength sword cannot unequip itself
- [ ] Losing Strength below an equipped item's requirement unequips it and reverses its effects
- [ ] A two-item cascade settles; a cycle stops at the cap with a diagnostic
- [ ] The item docs page describes trait effects and equip requirements; changelog fragment written
- [ ] Loading a save from another world reverses an orphaned Item Copy's effects at load, not at the next inventory change (Q60; from ticket 04's landing)

## Blocked by

- 04
