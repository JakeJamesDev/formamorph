# 20: Bundled World Kinds

Status: ready-for-human
Blocked by: 18
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The bundled worlds store a kind for every entity already, so the released-world migration never runs on them. Ticket 13 turned each of their multi-location entities into a Generic entity with one Start per location. That is wrong for named people: a knight or a coach with a home and a workplace is one person.

Apply ticket 18's rule to every multi-location entity of every bundled world, then let the user decide each result.

1. Read the worlds through the `bundled-worlds` skill (image-stripped copies). Never read a raw world file.
2. For each world, list every entity that is Generic today, with its locations, its pronouns, what the rule gives (wandering Unique, follower at Player's Starting Location, or Generic), and one line on what it is in the world's story. Ticket 18's landing report names the ones it found.
3. Put the list to the user and wait. The user confirms or changes each one by name. A person may also need a real routine, not an All-day Wander; ask only when the world's text makes the routine obvious, such as a guard captain with a post and quarters.
4. Write the agreed kinds, Starts and rows into the world files in the house style, and bump nothing the `bundled-worlds` skill says is the user's.

A bundled save that holds these entities must still load. An entity that changes kind drops its old per-kind state, as ticket 13 built.

Spec rulings: Q143, Q144, Q146, Q151, Q171, Q172.

## Acceptance criteria

- [x] The landing report holds the full table: world, entity, old kind, new kind and form, and "user confirmed" or "user changed" for each. (Landed section.)
- [x] No bundled world file changed before the user answered the list. (Three review rounds in the ticket session, then one write script.)
- [x] Every changed entity's Starts and rows reach only places connected to its Start, checked by the existing bundled-world tests or a new one. (`bundledRoutines.test.ts`, with a case that goes red on a disconnected place.)
- [x] The bundled saves still load and play their first turn in the existing bundled-save tests. (`GameplayContext.bundledSaves.test.tsx` in the affected-tests gate.)
- [x] Each changed world's readme or notes say what changed for its characters, where the house style asks for it. (One Routines bullet in "How this world is built" for drone, emberwatch and valentines, per the spec session.)

## Landed

| World | Entity | Old kind | New kind and form | Review |
|---|---|---|---|---|
| drone | Rustjaw | Generic | Unique, All-day Wander | user confirmed |
| drone | Ser Halden | Generic | Unique, Stay Fort Graywatch, 08:00–16:00 Patrol with the Demon Frontier | user changed |
| drone | Old Corwin | Generic | Unique, All-day Wander | user confirmed |
| drone | Blightspawn | Generic | Generic (it/its, Q171) | not reviewed, rule agrees |
| emberwatch | Albus | Generic | Unique, All-day Wander | user confirmed |
| emberwatch | Sylvie Thornwhistle | Generic | Unique, Wander, 22:00–08:00 Stay The Cinder and Crown | user changed |
| emberwatch | Corvin Vale | Generic | Unique, Wander, 17:00–02:00 Stay The Cinder and Crown | user changed |
| emberwatch | Captain Orrin Blackwell | Generic | Unique, Stay the keep, 18:00–22:00 The Old Watchtower, 22:00–06:00 The Captain's Hall | user changed |
| slime | Quarantine Watch | Generic | Generic | user changed (kept against the rule) |
| valentines | Coach Daizen | Generic | Unique, All-day Patrol of the four exits, 1 hour each | user changed |
| valentines | The Swarm | Generic | Generic | user changed (kept against the rule) |
| valentines | Rin Hayama | Generic | Unique, All-day Patrol hallway and cafeteria, 1 hour each | user changed |
| valentines | Ren Takeda | Generic | Unique, All-day Wander | user confirmed |

Every new Unique has Traversable set to its old location list. rampage, sugarscape, veilwood and open-chat agree with the rule and are unchanged.

**Not verified:** none.

**For you:**
- Open each changed bundled world and check that its named characters are where their story says.
- Play Emberwatch into the evening and check that the captain moves to the Old Watchtower.
