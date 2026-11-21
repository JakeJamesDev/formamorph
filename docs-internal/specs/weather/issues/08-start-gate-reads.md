# 08: Start Gate Reads

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A Condition checked at the start of a story reads the story's start weather and start time. The spec covers this in Q31.

- **New Game settle.** The first trait settle and the turn-one sandbox read the resolved start: the drawn Opening's Weather, then Default Weather, then Clear, and the drawn Opening's Time, then Default Time, then the shipped start hour. Today the gate reads Clear and a fixed hour, and the sandbox reads Default Weather while ignoring the Opening.
- **Unset weather.** When nothing is authored, the start weather is unset until the page-one Weather Pass reads it. The first settle reads Clear then, and the turn-one commit settles again with the read weather.
- **Library entity editor and Enter World.** These read Default Weather and Default Time, as the World Editor does. With neither set, Clear and the shipped start hour.
- **Redraw.** A page-one redraw onto another Opening settles again from the new start.

## Acceptance criteria

- [ ] A New Game on an Opening with Weather Rain holds a trait gated on Rain from the first settle. With Opening Time night, a trait gated on night holds too.
- [ ] With no Opening Weather or Time, the first settle reads Default Weather and Default Time.
- [ ] The library entity editor and Enter World read Default Weather and Default Time.
- [ ] A redraw onto an Opening with other weather changes the first settle's result.
- [ ] Each guard bites when its bug returns.
- [ ] Changelog fragment written, only if a released behavior changes. The Weather and Opening Time fields are unreleased, so the fix may fold into their entries.
