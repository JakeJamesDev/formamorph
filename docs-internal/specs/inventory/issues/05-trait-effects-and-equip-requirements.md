# 05: Trait Effects And Equip Requirements

Status: ready-for-human
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

- [x] Trait effect rows and equip Requirement Rows edit in the item editor; the trait picker excludes Automatic traits — preview (`fixture=items`): Trait Effects row added on Effects, Requirements tab picker lists Item Owner Stats; frames `.scratch/inventory-05/frames/trait-effects-dark-800.jpg`, `requirements-tab-dark-800.jpg`; `items.test.ts` "itemTraitOptions … leaves out Automatic traits"
- [x] A While Owned trait grant turns the trait on; losing the item turns it off unless another source holds — `settle.test.ts` "turns a While Owned trait on…", "keeps the trait on while another item still grants it"
- [x] A trait the owner picked stays on when the granting item leaves — "leaves a trait the owner picked on…"; stat code picks count too ("lets stat code pick a granted trait…")
- [x] An item grant does not count toward Pick Count and does not switch off a group sibling — "switches off no group sibling and counts toward no Pick Count", "keeps a picked and granted sibling on…"; mutation-tested
- [x] Equipping fails with a diagnostic when the requirement does not hold — "refuses an equip whose requirement does not hold…", "reads the requirement after the swap-out…"
- [x] A +Strength sword cannot keep itself equipped, and a -Strength sword cannot unequip itself — "never lets a +Strength sword…", "never lets a -Strength sword…"; mutation-tested (Q49 filter removed → both fail)
- [x] Losing Strength below an equipped item's requirement unequips it and reverses its effects — "unequips an item whose requirement stops holding…"; turn settle runs it after stat deltas (Q123, `GameViewer.tsx` `settleWithItems`)
- [x] A two-item cascade settles; a chain longer than the cap stops at the cap with a diagnostic (Q124) — "settles a two-item cascade", "stops a chain longer than the cap…"
- [x] The item docs page describes trait effects and equip requirements; changelog fragment written — `docs/World-Editor-Items.md` Trait effects + Requirements; `docs-internal/changelog.d/inventory-05.md`
- [x] Loading a save from another world reverses an orphaned Item Copy's effects at load, not at the next inventory change (Q60; from ticket 04's landing) — the load settle now runs the inventory settle; "reverses the effects and grants of an Item Copy the load dropped…"

## Blocked by

- 04

## Landed

**Not verified**

- None of the criteria. The GameViewer wiring (turn, load, panel, Traits tab, persona switch) calls the tested `settleInventory`, but no test drives those hooks; the Q60 load case is proven at the module, not through `loadGame`.
- An owner that leaves play (a library persona swapped out) keeps its grant and the grant's stats until it returns; untested.

**For you**

- Give an entity a cursed ring with a trait effect in a real world: the trait turns on, the log reads "Trait switched on: X (by Ring)", and the Traits tab cannot switch it off.
- Equip an item with a Strength requirement, then lose Strength in play: it unequips at the end of the turn with "Unequipped …: requirement no longer holds".
- The Traits tab shows a granted trait's switch as on but refuses it silently; judge whether it needs a visible lock.
- Adding a First Obtain trait row to an item later grants that trait to owners who still hold the item.
