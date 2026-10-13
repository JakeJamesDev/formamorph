# 04: Bundled Worlds Own Their Player Stats

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: content edits across eight world files with a data test and the code test as the proof; the names need the user's sign-off, not deep reasoning.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

Every bundled world puts its player stats on an owner and leaves its world stats loose.

- **Six worlds gain a Custom Persona entity** that owns the player stats: Drone, Rampage, Slime, Sugarscape, Valentines, Veilwood. The entity is named as the world's prose addresses the player (The Creature, The Drone, and a role name for the other four), with a one-line description in the world's voice. The names go in this ticket's Comments for the user's sign-off before landing.
- **Loose world stats** stay on the world: Destruction and Alert Level (Rampage), Suspicion (Slime), Pursuit (Valentines), Predator Attention (Veilwood). Every other stat moves.
- **Emberwatch** turns Health, Mana, Faith, Gold and Renown into Blueprints, and Wanderer, Albus and Sylvie each link all five. Nothing stays loose.
- **Stat code** on moved stats keeps working because an owned stat's code reads its owner's stats as `stats`. The code test runs clean for every stat in every world.
- Open Chat does not change. Bundled fingerprints update with the files.
- Saves from the current release are not migrated (Q20); ticket 05 writes the note.

Rulings: Q5, Q18, Q19, Q20, Q21.

## Acceptance criteria

- [ ] Every bundled world but Open Chat has a Custom Persona entity owning its player stats, and the loose list is exactly Q19's.
- [ ] Emberwatch's three personas each link the five Blueprints, and the world has no loose stats.
- [ ] The code test passes for every stat in every bundled world.
- [ ] The six persona names are in this ticket's Comments with the user's sign-off.
- [ ] A new game in Rampage shows Health under the persona and Destruction under the world in the stat panel.

## Comments

**Persona names, for sign-off (Q21).** The user answered the proposal with one change, for Drone, and left the other five as proposed.

| World | Custom Persona | Note |
|---|---|---|
| Drone | `{{designation}}` | Placeholder with twelve robotic designations: C1PH3R, Z3PHYR, T1T4N, Axiom-0, R0GU3, PR1SM (Cipher, Zephyr, Titan, Axiom, Rogue, Prism in leetspeak, Axiom kept by user ruling), then Q4-T6, VX-77, B8-ZN, J3-P0, D9-KR, ZO-12 (droid-style codes). One roll per playthrough (user ruling) |
| Rampage | The Creature | |
| Slime | The Resident | |
| Sugarscape | The Cursed | |
| Valentines | The Student | |
| Veilwood | The Wanderer | |

**Ruling folds (spec Q22 to Q25).**
- Each world's root traits and trait groups moved onto its persona with the stats, so the stat rows stay alive. Open Chat's traits stay loose. Emberwatch's root stays.
- A persona trait's row on a loose world stat (Long Coat → Suspicion, Student Council President → Pursuit, Keen Eye and Move Quietly → Predator Attention) still moves the world stat. A test pins it.
- Alert Level reads `entities["The Creature"].stats.Rampage`. The Test Bench rule `stat-code-unknown-stat` no longer treats a member-qualified `.stats` read as a world lookup (Q25).
- The `Entity` doc comments that said owned traits carry no stat rows, and that play does not read owned stats, are corrected.
- The Rampage acceptance line is proved at the seed seam, not driven in the stat panel.
