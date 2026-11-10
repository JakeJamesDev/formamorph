# 10: Movement Tag

Status: ready-for-human
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

- [x] The chip has a Movement include, on by default, and an author can turn it off per prompt. ChipOptionsDialog tests "turns Movement off per chip and back on" and "keeps Movement live under Name content"; DOM read of the dev-router chipOptions modal.
- [x] A test of the built prompt shows each state in the right place, nothing on a Group, nothing on an Individual with no state, and following over stays here. `src/lib/chipValues/movementTag.test.ts`, the first two cases plus "lets following win over Strict in a Nearby place too".
- [x] A Strict Individual one Nearby link away carries stays here. One across a Far link is not in the prompt at all. Same file; the Nearby tag reads "stays there" (Q112), and the Far case checks every scope.
- [x] Turning the include off removes every tag and changes nothing else in the prompt. A byte comparison proves it. Same file, "switched off": every scope × content × format equals a scene with no movement, and the tagged text minus its tags equals the off text.
- [ ] Probe numbers on the cloud default, with in-batch controls: a request to take a Strict character along (they stay), a Strict neighbor (not walked over), and ordinary turns (no mention of staying). The landing states the numbers.
- [x] The chip's option copy follows the Writing Guide. The chip reference doc and a changelog fragment cover it. `docs/Prompt-Chips.md` Include row and bullets; `docs-internal/changelog.d/npc-schedules-10.md`.

## Landed

**Not verified**

- The probe bar (they stay; not walked over) is not met on the cloud default. Numbers are stated; the ruling (Q114) was to land the tag as built. `testing/baseline/harness/movement-tag-probe.cli.ts`, 12 runs per arm, arms interleaved in one batch, control = no tag:

  | Case | control | tag | preamble sentence | Guidelines bullet |
  |---|---|---|---|---|
  | Ask Strict Odette to come along: she leaves | 3/12 | 3/12 | 2/12 | 7/12 |
  | Player writes "Odette and I walk out": she leaves | 11/12 | 11/12 | 10/12 | 12/12 |
  | Call Strict Bram over from the Nearby cottage: he comes out | 2/12 | 2/12 | 3/12 | 0/12 |
  | Ordinary turn beside Strict Odette: story says she must stay | 0/12 | 1/12 | 0/12 | 0/12 |
  | Same, staying words (regex) | 0/12 | 0/12 | 0/12 | 0/12 |

  Two earlier batches agree, control vs tag: batch 1 asked 2 vs 2, walked 12 vs 10, neighbor 1 vs 4, ordinary 2 vs 0; batch 2 asked 3 vs 4, walked 9 vs 10, neighbor 2 vs 3, ordinary 3 vs 2. Two tag wordings ("stays here when asked to leave" / "stays there when called"; "keeps to this/that place until this shift ends") did no better. Choices offering to take Odette along: 0/12 in both arms, so there was no base rate to cut. The game still keeps positions right; only the prose can disagree.
- Strict is read at the turn's start minute, the same clock the position engine and the location request use. A before-AI box that advances the clock across a row boundary shows the earlier row's Strict.

**For you**

- A few turns next to a character on a Strict row, to check the narrator does not keep pointing out that they are staying.
- Ask a character on a Strict shift to come along: the cloud model still often walks them out in prose while the game keeps them in place. Decide whether that needs a follow-up beyond the chip.
- Chip Options with Name content: Movement stays live while Traits and Stats are disabled. Frame: `.scratch/npc-schedules-10/frames/chip-options-name-movement.jpg`.
