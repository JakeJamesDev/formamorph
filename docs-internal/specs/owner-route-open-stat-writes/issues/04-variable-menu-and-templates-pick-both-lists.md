# 04: Variable Menu And Templates Pick Both Lists

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

UI list and insert work over an existing tree builder and template picker. Sonnet at medium effort.

## What to build

- The Variable menu shows an Owner group in an owned or Blueprint stat's box. Its Stats group lists the world stats in every box.
- A template's stat slot in an owned or Blueprint stat's box lists the owner's stats, which insert `owner.stats[...]`, and the world stats, which insert `stats[...]` (Q13). In a world-stat box the slot is unchanged.

## Acceptance criteria

- [ ] An owned stat's box shows an Owner group with the owner's stats, traits, and placeholders, and a Stats group with world stats
- [ ] A world-stat box shows no Owner group
- [ ] A template stat slot in an owned box lists both lists, and each pick inserts its own route
- [ ] Inserted template code runs in Test Code without a dropped write
- [ ] Four gates green

## Blocked by

- 01 (`stats` Means The World, `owner` Is The Owner)
