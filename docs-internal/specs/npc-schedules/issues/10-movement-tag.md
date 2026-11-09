# 10: Movement Tag

Status: ready-for-agent
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A prompt change: it ships with probe numbers.

## What to build

The Entities chip gains a Movement include, on by default in every prompt that uses the chip. It adds a short state after an Individual's entry:

- At the player's place: following you, waiting here, or stays here when the character's current row is Strict.
- In a Nearby place: stays here when the current row is Strict. No other state there.
- A Group, and an Individual with no state, get nothing. Following wins over stays here.

With it the narrator stops walking a clerk away from their shift, and the choices stop offering to take along someone who can't come.

In auto mode the location request runs before narration, so the tag shows this turn's result.

Read `docs-internal/notes/prompt-writing-guide/notes.md` before choosing the tag wording.

Spec rulings: Q19, Q21, Q47. Stories 51, 52, 56, 57. The spec's "Movement tag" section is the contract.

## Acceptance criteria

- [ ] The chip has a Movement include, on by default, and an author can turn it off per prompt.
- [ ] A test of the built prompt shows each state in the right place, nothing on a Group, nothing on an Individual with no state, and following over stays here.
- [ ] A Strict Individual one Nearby link away carries stays here. One across a Far link is not in the prompt at all.
- [ ] Turning the include off removes every tag and changes nothing else in the prompt. A byte comparison proves it.
- [ ] Probe numbers on the cloud default, with in-batch controls: a request to take a Strict character along (they stay), a Strict neighbor (not walked over), and ordinary turns (no mention of staying). The landing states the numbers.
- [ ] The chip's option copy follows the Writing Guide. The chip reference doc and a changelog fragment cover it.

For you: a few turns next to a character on a Strict row, to check the narrator does not keep pointing out that they are staying.
