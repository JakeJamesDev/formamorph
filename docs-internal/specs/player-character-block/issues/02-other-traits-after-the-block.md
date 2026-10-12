# 02: Other Traits After the Block

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a header rename and chip reorder in default prompt text, plus one probe run read against ticket 01's control.

Parent: [Player Character Block spec](../spec.md)

## What to build

In the six default prompts, the Traits chip's header becomes `Other Traits` and the chip moves to sit after the Persona chip. Nothing moves into or out of the block in this ticket: the persona's own traits already render inside it, and the Traits chip already holds the world's player traits only. Rulings Q5 (traits half), Q11.

With no world player traits, the section vanishes with its heading, by the headed-chip blank rule. With no persona, the block is absent and Other Traits stands first, which is the intended reading for a world without personas. Saved custom prompts keep their own header text and order.

## Acceptance criteria

- [ ] The six default prompts carry `Other Traits` as the Traits chip's header, placed after the Persona chip, asserted as the existing persona prompt tests assert headers and order.
- [ ] A rendered default narration prompt for a bundled world with no persona and world traits opens its player section at `## Other Traits`; for a world with a persona and no world traits, the section is absent.
- [ ] A narration probe on the default endpoint with ticket 01's prompt as the in-batch control, at least 6 runs per arm, scoring the existing name-leak and stat-tabulation checks plus whether the narration applies the player's traits to the player. The report states the numbers.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.

## Probe result

`testing/baseline/harness/other-traits-probe.cli.ts`, default endpoint (`default`, Gemma 4 build), 2026-10-11. Sedge Landing narration cases, a played library persona nobody knows, arms interleaved. `control` is ticket 01's prompt (Traits chip before the Persona chip, headed "Traits"); `other` is this ticket's order and header. `trait-uptake` counts narrations that show one of the player's world traits on the player (Wren's look and skills, or the footsore trait's tired feet).

| Check | batch 1 (10 runs/case): control | other | batch 2 (20 runs/case): control | other |
|---|---|---|---|---|
| player-name ↓ | 0/30 | 0/30 | 0/60 | 0/60 |
| npc-name-leak ↓ | 8/30 | 7/30 | 19/60 | 11/60 |
| stat-tabulation ↓ | 0/30 | 0/30 | 0/60 | 0/60 |
| numeral-leak ↓ | 0/30 | 0/30 | 0/60 | 0/60 |
| trait-uptake ↑ | 6/30 | 2/30 | 10/60 | 12/60 |
| mean words · dialogue | 92w · 2/30 | 86w · 1/30 | 91w · 7/60 | 91w · 3/60 |

`trait-uptake` is a keyword proxy: it counts a trait word anywhere in the narration, an NPC's tired feet included, so it can show a large drop but not a small one. The three other guards sit at 0 in both arms and cannot tell the arms apart; only `npc-name-leak` moves.

Guard proof: with the six prompts restored to ticket 01's text, 7 of the 8 tests in `GamePrompts.otherTraits.test.ts` failed. The eighth, the Emberwatch case, asserts a blank chip drops its heading and passes on either text. Its premise (no player traits under Sylvie) is read from Emberwatch's own bearer data.

Batch 1 read uptake low in the `other` arm. Batch 2, twice the runs, reversed it, so the gap was drift on a thin sample. Pooled over 90 runs per arm, uptake is 16/90 control and 14/90 other: no change. Every guard stays at its control level or below.
