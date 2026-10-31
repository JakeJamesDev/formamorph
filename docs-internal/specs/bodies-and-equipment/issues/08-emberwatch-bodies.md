# 08: Emberwatch Bodies

Status: ready-for-agent
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

- [ ] Emberwatch defines its Bodies, and its entities pick one or follow the Default
- [ ] Starting equipment that the story implies is marked Equipped
- [ ] A new game of Emberwatch opens with that equipment in its slots, with no refused equips
- [ ] The world's readme describes any Body or transformation it adds

For you: a short Emberwatch playthrough to check that the starting gear and any transformation read right.
