# 08: Emberwatch Bodies

Status: ready-for-human
Blocked by: 03, 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Use the `bundled-worlds` skill to read and edit the world through its image-stripped copy, and follow its house style.

## What to build

Emberwatch is the one bundled world with slots today. Reauthor it so that it uses Bodies:
- A Default Body for people.
- A second Body for a non-human owner where the world has one.
- Starting equipment marked Equipped where the story implies it.
- One trait with a Body row, if the world's traits give a natural transformation. Otherwise leave it out and say so in the Landed section.

Spec: Q10, Q19.

## Acceptance criteria

- [x] Emberwatch defines its Bodies, and its entities pick one or follow the Default (Humanoid stays the Default; Grave Hounds pick the new Hound; test "gives the Grave Hounds the Hound Body")
- [x] Starting equipment that the story implies is marked Equipped (nine placements on Wanderer, Albus, Sylvie, Mother Hesk, Corvin, the Barrow Wight; Bram Oakes's stock stays carried, since its requirement fails)
- [x] A new game of Emberwatch opens with that equipment in its slots, with no refused equips (`openingFold` tests under Albus and under None; both fail with the marks removed)
- [x] The world's readme describes any Body or transformation it adds (Bodies and Starting gear bullets)

For you: a short Emberwatch playthrough to check that the starting gear and any transformation read right.

## Landed

**Not verified**
- No live playthrough or Inventory panel frame. The opening is covered by `openingFold` tests only.

**For you**
- A short Emberwatch playthrough to check that the starting gear and any transformation read right. Look at the Inventory tab on a new game as Albus and as Wanderer.
- No trait Body row: the traits are races, classes and abilities, and none gives a natural transformation.
