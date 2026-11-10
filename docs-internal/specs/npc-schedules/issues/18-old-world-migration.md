# 18: Old World Migration

Status: ready-for-agent
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

User-facing text calls the kinds Unique and Generic (Q162). Code and stored values keep `individual` and `group` until ticket 19.

Spec rulings: Q143, Q144, Q145, Q146, Q151, Q152, Q133, Q156, Q162, Q163.

## Acceptance criteria

- [ ] `migrateWorld` tests cover each row of the rule: a person with a home and a workplace, an enemy in two places in a world that uses pronouns, a companion at every location, and a world with no pronouns or persona flags.
- [ ] A test covers a small world where a person is listed at all of its few locations, and the landing report states what the rule gives there.
- [ ] The wandering Individual's Wander reaches every listed place it is connected to, and its first listed location is the Start.
- [ ] Running the migration twice gives the same world, and a world that already has kinds is unchanged.
- [ ] Each guard is proven by reinstating the old "always a Group" row and seeing the tests fail.
- [ ] The bundled worlds and dev fixtures still load, and their kinds are reviewed against this rule in the landing report.
- [ ] One changelog entry and the wiki's entity page explain the rule and the "one place at a time" change.

For you: import the released files of the four checked worlds into a build with this ticket and compare each with the spec's Migration section.
