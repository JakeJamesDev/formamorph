# 18: Old World Migration

Status: done
Blocked by: 13, 17
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Before the Group split, authors gave an entity several locations to say "can be met here". The entity was present at each of them. Today's migration turns every such entity into a Group, which labels a named person with a home and a workplace as a crowd. Replace that one row of the migration with this rule, checked top to bottom, for a released entity with no presence setting:

| Old entity | Becomes |
|---|---|
| Listed at every location of the world | Individual, one Start at Player's Starting Location, Traversable = Anywhere, Begins Following on |
| Several locations, in a world where no entity has pronouns or the persona flag | Individual, one Start at the first listed location, an All-day Wander over the list with an idle of one daypart, Traversable = the list |
| Several locations, with pronouns or the persona flag | The same wandering Individual |
| Several locations, with neither, in a world that uses them | Group, one Start per location, no rows |

The other rows of the spec's migration table stay as they are. The migration stays idempotent and silent. A file that already carries a kind does not migrate again.

The rule was checked by hand against four released community worlds; the spec's Migration section lists what each should give. Fixtures copy those shapes with names from the repo's neutral set. Never copy a community world or its names into the repo.

The changelog entry and the docs explain the rule. They say plainly that a person who had several locations is now in one of them at a time, so they are not always where the player looks, and that the author changes this in the Routine tab.

The first row writes the two fields ticket 17 built: the Start's place is the exported Player's Starting Location constant, and the Start carries the begins-Following flag. Use that constant; do not write the value by hand.

User-facing text calls the kinds Unique and Generic (Q162). Code and stored values keep `individual` and `group` until ticket 19.

Spec rulings: Q143, Q144, Q145, Q146, Q151, Q152, Q133, Q156, Q162, Q163.

## Acceptance criteria

- [x] `migrateWorld` tests cover each row of the rule: a person with a home and a workplace, an enemy in two places in a world that uses pronouns, a companion at every location, and a world with no pronouns or persona flags. (`version.test.ts`, "a released entity with several locations and no presence"; plus the "it" pronouns case, Q171.)
- [x] A test covers a small world where a person is listed at all of its few locations, and the landing report states what the rule gives there. ("makes a person at both locations of a two-location world a follower"; see Landed.)
- [x] The wandering Individual's Wander reaches every listed place it is connected to, and its first listed location is the Start. (The Wander lists every place; the engine skips unconnected ones per Q54.)
- [x] Running the migration twice gives the same world, and a world that already has kinds is unchanged. ("changes nothing on a second run…")
- [x] Each guard is proven by reinstating the old "always a Group" row and seeing the tests fail. (7 of 13 failed; the rest assert Group or other-row results. Extra mutations: dropping persona from the world check, `> 1` → `> 0` locations, and a case-sensitive untrimmed "it" check each fail their test.)
- [x] The bundled worlds and dev fixtures still load, and their kinds are reviewed against this rule in the landing report. (`entityRoutineMigration.test.ts` green; see Landed.)
- [x] One changelog entry and the wiki's entity page explain the rule and the "one place at a time" change. (`changelog.d/npc-schedules-18.md`, `World-Editor-Entities.md` "Entities from older worlds".)

For you: import the released files of the four checked worlds into a build with this ticket and compare each with the spec's Migration section.

## Landed

**Small world.** In a world with two locations, an entity listed at both becomes a follower: one Start at Player's Starting Location with Begins Following, Traversable Anywhere. A one-location world makes no follower; a stale extra id there does not reach row 1.

**Rulings applied:** Q171 ("it" pronouns are not a person on the entity, but count for the world check) and Q172 (no bundled world file changes here). Library entities have no world, so several locations always give the Wander.

**Bundled worlds and fixtures.** Every bundled world and the three dev fixtures already store kinds, so the migration leaves them unchanged. Run as released (kinds stripped), the rule disagrees with these stored Groups, for ticket 20:
- `drone.json`: Rustjaw, Ser Halden, Old Corwin (he/him) → wandering Unique.
- `emberwatch.json`: Albus, Sylvie Thornwhistle, Corvin Vale, Captain Orrin Blackwell → wandering Unique.
- `slime.json`: Quarantine Watch (they/them) → wandering Unique.
- `valentines.json`: Coach Daizen, Rin Hayama, Ren Takeda, The Swarm (they/them) → wandering Unique.
- The "it/its" entities in `slime.json` and `drone.json` stay Groups under Q171. `rampage`, `sugarscape`, `veilwood` and `open-chat` agree.

**Not verified:** none of the criteria. The four community worlds were not imported (For you).

**For you:**
- Import the released files of the four checked worlds into a build with this ticket and compare each with the spec's Migration section.
- Read the "Entities from older worlds" section of the wiki's entity page.
