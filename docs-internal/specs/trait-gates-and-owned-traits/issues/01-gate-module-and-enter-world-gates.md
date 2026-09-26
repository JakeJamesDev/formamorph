# 01: Gate module and enter-world gates

Status: ready-for-human
Status note: built in 29ebddd7 and 0931c994; notes for later tickets under Comments.
Base: 3be54b7a
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new pure module with fixpoint and reachability logic that every later ticket builds on; the enter-world wiring is small next to it.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

A trait can list requirements, any one of which unlocks it. At enter-world, a locked trait stays in place, disabled, and says what it requires. Picking a requirement unlocks its dependents at once. Removing one turns the dependents off along the chain, and a dismissible banner names what turned off and why. A gated default whose chain has no open root starts unselected. Authoring is by world JSON in this ticket; the editor field is ticket 02.

## Acceptance criteria

- [ ] A trait carries an optional list of requirements of kind trait, group, or playing-as, as the spec's type shape gives it. Absent or empty means always available. This is an additive world export change.
- [ ] One pure gate module owns all gate logic. Its input takes the traits of every owner, the groups, an active set per owner, and the persona ref, so later owner tickets extend it without a new API.
- [ ] The module reports each trait as unlocked or locked, with the locked reason as text parts: a trait name, an owner-prefixed name, "any <group>", "playing as <entity>", or the stored name of an unresolved target.
- [ ] A trait requirement holds when that trait is active on its owner; a group requirement holds when any trait below the group holds, including traits of entity nodes placed inside it; playing-as holds when the persona is that world entity; an unresolved requirement never holds.
- [ ] `settle` builds the settled set from the ground up, as a least fixpoint: traits with no requirements are kept, traits whose gate holds against the kept set join, until nothing joins. Two traits that require only each other never hold each other up.
- [ ] `settle` returns the turned-off list with dependents before prerequisites, and a returned list of acquired traits a cascade turned off whose gate holds again, for ticket 03.
- [ ] Exclusive groups keep their rule: picking a sibling retires the others first, then `settle` runs.
- [ ] The module finds never-unlockable sets: traits none of whose requirements can hold through a chain to a trait with no requirements, a persona, or a group holding such a trait. A loop that opens through a third trait passes.
- [ ] Enter-world runs every selection change through `settle`; locked traits stay in place, disabled, with a lock icon and a "Requires … or …" line; an unlocked gated trait shows "Unlocked by …".
- [ ] A cascade shows one dismissible banner, "Turned off Plate Armor, because of Rogue."
- [ ] Defaults collapse through `settle` at open.
- [ ] Gate module tests cover any-of, each requirement kind, requirements across owners, chained cascades and their off-order, exclusive retirement followed by a cascade, unresolved requirements, mutual-requirement defaults that collapse, and never-unlockable sets against a loop that opens through a third trait.
- [ ] Component tests on the setup trait list cover disabled rows and the banner only; logic stays in the module's tests.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-26).** The gate module is `src/lib/traitGates.ts`. Notes for later tickets:

- **Ticket 03 (in play):** `switchTrait` returns null for a locked trait. A stat-code switch-on of a locked trait must call `settle` directly, so that `settle` turns the trait off in the same pass.
- **Ticket 03:** `settle` takes the cascade-off list and returns `returned` and the next `cascadeOff`. It leaves ids alone that no owner holds, so a save keeps a deleted trait.
- **Test Bench ticket:** `neverUnlockable` includes a trait whose only requirement is unresolved. Remove the duplicate against the unresolved-requirement rule.
- **Rule added in review:** an exclusive sibling never holds a trait up, because picking the trait retires the sibling. Such a trait reads locked and counts as never unlockable.
- **Not wired:** the In Play tour pane shows every trait open. The Test Bench lens and the authored-scene preview still read raw `isDefault`, not `settleDefaults`.
