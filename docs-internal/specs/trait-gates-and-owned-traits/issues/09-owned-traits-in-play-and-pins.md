# 09: Owned traits in play and pins

Status: ready-for-agent
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the pin collector and the Test Bench lens share one walk; adding owners must keep play and the Bench agreeing on who wins.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

During play the player switches an NPC's toggleable traits in the Traits tab, and every owner's active traits pin placeholders, with the player's own picks winning a contested one.

## Acceptance criteria

- [ ] The in-game Traits tab shows the one tree with entity nodes and lets the player switch toggleable owned traits, through the same gates and cascade.
- [ ] The pin collector lays owned traits first, in tree order per owner, then the player's world traits and the played entity's owned traits, later winning.
- [ ] The Test Bench lens and the pin-conflict rule read every owner's active traits, and the lens shows the owner of a pin.
- [ ] Pin collector and lens tests cover an NPC's owned trait pinning and a player trait winning the same placeholder.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
