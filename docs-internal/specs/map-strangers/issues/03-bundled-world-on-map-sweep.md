# 03: Bundled World On Map Sweep

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Each bundled world gets On Map values that suit it. The session proposes and the user approves before any world changes.

- Read every bundled world through the bundled-worlds skill.
- For each world, propose one table: each entity that should not be Always, its proposed value, and one line on why. Leave out entities that stay Always.
- Show the tables to the user and wait for approval. Apply only the approved values.
- Write the values through the bundled-worlds skill's process and run its checks.

Spec rulings: Q16.

## Acceptance criteria

- [x] Every bundled world has a proposal table in the landing, including the worlds with no changes. The Landed table lists all eight.
- [x] Only user-approved values were written. The landing quotes the approval. `bundledOnMap.test.ts` pins the approved set.
- [x] Each changed world loads, and its entities with a value show that value in the editor. A load test per world: `bundledOnMap.test.ts` (9 tests; it fails when a value is removed).

For you: approve the proposal tables before the session writes any world.

## Landed

Approval, quoted from the user's reply to the tables on 2026-11-12: "Approved".

Every bundled entity starts met (none has a Stranger Name), so Once Met would act as Always. The tables use only Never and When Nearby. Entities not listed stay Always.

| World | Never | When Nearby |
|---|---|---|
| drone | none | Vault Warden, Glassback Burrower, Blight Drake, Blightspawn, Herald Skarn |
| emberwatch | The Shade of Maelis | Cold Lights, Grave Hounds, Barrow Dead |
| open-chat | none (no entities) | none |
| rampage | Captain Theo Ward | Aegis-One, Rooftop Missile Team, Combat Engineers |
| slime | The Ward Mimic, The Fog Veil, The Loudspeakers | The Signal Slime, Amber Creeper, The Gutter Swarm |
| sugarscape | Licorice Constrictor, Fluffbog, Caramel Seep, Toffee Slide, Gingerbread Waypost, The Daylight Seam, Saltlick Stones | Cream Cyclone, Sprinkle Swarmers, Stale Moths |
| valentines | none | The Swarm, Ren Takeda, Coach Daizen |
| veilwood | Mire Leeches, Sporeburst Puffball, The Drowned Bell, The Surveyor's Blazes, Lantern Moths, Bark Frogs | Shadow Raptor, Dread Crawler |

Not verified:
- No editor DOM read. The load test reads the value through `onMapOf` after `seedWorldData`, not through the entity editor control.

For you:
- Judge the Never and When Nearby picks against how each world plays. Look at the map of each world in play.
- ⚠️ Export shape: the bundled world files now carry the optional `onMap` field on 40 entities. `bundledFingerprints.json` did not change, because the fingerprint hashes only long text.
