# 02: Tone Trait Groups

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

## What to build

The player tunes the chat with four exclusive trait groups: Reply Length, Prose Style, Narration Share, and Pacing. Each group backs one world placeholder. Each placeholder holds one value, the middle setting, which applies when no trait pins it. Each trait carries one placeholder pin with a value typed off the list. The middle trait of each group pins the same text as the default. Every value is a full instruction sentence, so a prompt that reads the chip is correct with any pin. The traits change no stats.

First step: prove live that a pin with an off-list value masks a one-value placeholder, and that switching the trait off restores the default. If it does not, use a multi-value placeholder with weight 0 on every non-default value, and record the ruling in the spec.

Until ticket 03 lands, the world system prompt section may read the chips so the effect is visible in the AI context.

## Acceptance criteria

- [ ] The pin proof result is recorded under Comments, with the path taken
- [ ] The pre-game trait picker shows four groups, and each allows one pick only
- [ ] A tone-resolution test resolves text holding the four chips with no pins, then with the pins of each trait
- [ ] The test asserts the no-pick result equals the result of the middle trait
- [ ] The test asserts each trait changes only its own placeholder, and no value resolves to an empty string
- [ ] The guard is proven to fail when a pin is broken, per the test bar
- [ ] Switching a tone trait mid-game changes the resolved value in the AI context, checked live
- [ ] The content test from ticket 01 now asserts four exclusive groups and stays at zero Test Bench findings
- [ ] Four gates green
