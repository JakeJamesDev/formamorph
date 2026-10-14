# 12: Close the Last Folds

Status: done
Blocked by: 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: four small R0 fixes, one of which moves Test Bench results.

## What to build

The last places that still treat global scope as the player's, found in ticket 05's and ticket 11's reviews (Q33):

- The Test Bench lens merges the global tree and the Custom Persona entity's tree into one list. A persona trait picked as the lens PC then acts as a global trait. It stays the persona's.
- The lens and the Enter World preview compute starting stats without entity stats. An entity stat id that clashes with a global id reads as global there (Q30).
- Card import binds a You stat Condition's name among the global stats. It binds among the played entity's stats (Q13, Q29).
- A hover card's Owners row shows You for any trait in the editor's global tree. A Blueprint trait linked by an entity shows "You, <entity>". The row never shows You for the global tree (Q8).

Spec: Q8, Q13, Q29, Q30, Q33.

## Acceptance criteria

- [ ] A persona trait picked as the lens PC acts on the persona's stats, not global stats
- [ ] The lens and Enter World preview read an entity's own stat when its id clashes with a global id
- [ ] A card's You stat Condition binds among the played entity's stats
- [ ] A linked Blueprint trait's card lists only its entity owners
- [ ] Each changed Test Bench result names Q33 in its test
- [ ] Four gates green

## Blocked by

- 11
