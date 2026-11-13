# 06: Open Chat Uses World Options

Status: ready-for-agent
Blocked by: 03, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Open Chat's Reply Length, Style and Pacing become World Options instead of traits (Q16).

- Each trait group becomes a choice Option; each trait becomes a value with the same placeholder pins. Defaults match today's default picks. Shown to Player and mid-game are on.
- The three trait groups and their traits are removed.
- Old Open Chat saves load with each Option at its default; no save migration (Q21).
- Read and write the world JSON through the `bundled-worlds` skill.
- Changelog fragment.

Spec rulings: Q16, Q21.

## Acceptance criteria

- [ ] For every value of every Option, the pinned placeholder text matches what the matching trait pinned before.
- [ ] Open Chat has no traits left from the three groups.
- [ ] A save made on the old Open Chat loads and plays with default Options.

For you: a short Open Chat session with each Style to confirm the replies still read right.
