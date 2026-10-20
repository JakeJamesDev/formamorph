# 08: Opening Readers

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The three remaining places that answer "what does this stat open at" adopt the seed rule ticket 07 landed. Ruling Q8, extended after 07.

## What to build

An author reads the same opening number everywhere a stat's start is shown or used: the code hover card's **Starts At** line, a Link's Base Value as it is copied from its Original, and the value a loaded save gets for a stat the world defines but the save lacks. All three read the authored value, then min, then zero, through the one seed function ticket 07 established. The per-turn stat-change map keeps reading `starting` as its delta baseline; it is a different concept and is not touched.

## Acceptance criteria

- [ ] The code hover card's Starts At line reads the seed function. Its own `starting`-first helper is gone. The card still drops the line when the start equals the min.
- [ ] A Link's Base Value copied from its Original reads the seed function.
- [ ] The save backfill seeds a missing stat through the seed function.
- [ ] The stat-change map still reads `starting` first for its baseline, with a one-line comment naming it the delta baseline.
- [ ] A bite test per reader: a stat with `starting` 10 and value 5 shows 5 on the card, copies 5 as the Base Value and backfills 5. Each fails against today's reading.
- [ ] No save or world shape changes. Existing hover card, Link and backfill tests stay green except where Q8 changed the result, and each such change names Q8.
- [ ] Four gates green, exit codes read.
