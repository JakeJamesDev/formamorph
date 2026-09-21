# 02: Tone Trait Groups

Status: ready-for-human
Base: 476059d8
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

## What to build

The player tunes the chat with four exclusive trait groups: Reply Length, Prose Style, Narration Share, and Pacing. Each group backs one world placeholder. Each placeholder holds one value, the middle setting, which applies when no trait pins it. Each trait carries one placeholder pin with a value typed off the list. The middle trait of each group pins the same text as the default. Every value is a full instruction sentence, so a prompt that reads the chip is correct with any pin. The traits change no stats.

First step: prove live that a pin with an off-list value masks a one-value placeholder, and that switching the trait off restores the default. If it does not, use a multi-value placeholder with weight 0 on every non-default value, and record the ruling in the spec.

Until ticket 03 lands, the world system prompt section may read the chips so the effect is visible in the AI context.

## Acceptance criteria

- [x] The pin proof result is recorded under Comments, with the path taken
- [x] The pre-game trait picker shows four groups, and each allows one pick only
- [x] A tone-resolution test resolves text holding the four chips with no pins, then with the pins of each trait
- [x] The test asserts the no-pick result equals the result of the middle trait
- [x] The test asserts each trait changes only its own placeholder, and no value resolves to an empty string
- [x] The guard is proven to fail when a pin is broken, per the test bar
- [x] Switching a tone trait mid-game changes the resolved value in the AI context, checked live
- [x] The content test from ticket 01 now asserts four exclusive groups and adds no Test Bench finding to the set
- [x] Four gates green

## Comments

**Pin proof: path A, one-value placeholders.** A trait pin with an off-list value masks a one-value placeholder, and switching the trait off restores the default. No weight-0 fallback, so the spec needs no ruling.

- Code: `phSpans` reads the pin before the values, so a pin masks a Variable too.
- Live, clean profile on the dev server, local model, no tone picks:
  - Opening turn with no picks: the AI context held the four middle values, no raw chips.
  - Reply Length switched to Long mid-game: the next turn read the Long value. The other three stayed at their middle values.
  - Long switched off: the next turn read the Medium value again.
- Pre-game picker: four groups under Starting Traits, each a radio group of three.
- Mutation proof: an emptied pin, a pin aimed at the wrong placeholder, and a middle pin that differs from the default each fail the suite.

**Chips in the world system prompt.** The four chips sit in the world system prompt until ticket 03 lands. That clears `world-empty-system-prompt` now, so the exact finding set is `location-no-entities` and `world-no-readme`. Ticket 03 moves the chips into the narration override and puts one neutral line in the system prompt. The tone test resolves the world system prompt, so ticket 03 points it at the override text.
