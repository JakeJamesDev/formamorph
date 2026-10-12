# 04: Character Stats in the Character Pass

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new field in the staged-planning user message, rendered through the chip path the narration already uses, and a probe that judges whether a character acts from its own condition.

Parent: [Player Character Block spec](../spec.md)

## What to build

The character pass runs once per selected character with "You ARE <name>". Its user message opens with an identity block: the name and a background blurb. That block gains the character's own stats, rendered as the narration Entities chip renders an entity's stats: range, descriptor and description, laid out by the character's own stat groups, at the values the turn holds. A character with no stats, or one the director introduced, gets no stats field. Rulings Q18, Q19.

The character pass never sees the player's stats. Ticket 03 set its Persona chip to No Stats and left it without an Other Stats chip; this ticket keeps that. The diary pass identity is unchanged.

## Acceptance criteria

- [ ] Through the character user-message builder: a selected entity with stats carries a stats field after its background, in the same shape and values the narration Entities chip gives that entity this turn; an entity with no stats and an ad-hoc character carry no stats field.
- [ ] The values come from the turn's owned-stat snapshot the stat request reads, so a stat the previous turn moved shows its moved value.
- [ ] The character pass system prompt still carries no Other Stats chip and its Persona chip stays No Stats.
- [ ] A character-pass probe on the default endpoint, the shipped identity block as the in-batch control, at least 6 runs per case, with cases where a low or high stat should steer the character's stated intent. The report scores whether the intent reflects the stat and whether the character tabulates or names its stat values. The user rules on the shipped shape from it.
- [ ] Changelog fragment written.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.

## Probe result

`testing/baseline/harness/character-stats-probe.cli.ts`, default endpoint (`default`, Gemma 4 build), 2026-10-11, 12 runs per arm per case. Sedge Landing at dusk, the shipped character prompt. Bram is asked to cross now; Odette is asked to sell eels. Each case sets one stat low or high and holds the other mid-range. `control` is the shipped identity block; `stats` adds the stats field after the background. A low case and its high twin send the same control request. Arms interleave run by run.

A blind judge on the same endpoint reads each intent and picks the case's own state, its twin's opposite state, or neither. The A/B order alternates by run. A yes/no judge was tried first and answered yes to all 16 smoke outputs, so it was dropped.

| Case | own ↑ control | own ↑ stats | twin ↓ control | twin ↓ stats |
|---|---|---|---|---|
| Bram Vigor 12 (Spent) | 3/12 | 1/12 | 0/12 | 0/12 |
| Bram Vigor 95 (Hale) | 0/12 | 0/12 | 3/12 | 2/12 |
| Bram Trust 12 (Guarded) | 7/12 | 9/12 | 0/12 | 0/12 |
| Bram Trust 92 (Devoted) | 0/12 | 0/12 | 7/12 | 9/12 |
| Odette Trust 8 (Hostile) | 1/12 | 0/12 | 0/12 | 1/12 |
| Odette Trust 90 (Friendly) | 1/12 | 1/12 | 0/12 | 0/12 |
| Odette Stock 3 (Nearly out) | 1/12 | **8/12** | 3/12 | 1/12 |
| Odette Stock 36 (Stocked) | 2/12 | 2/12 | 0/12 | 1/12 |
| **All** | 15/96 | 21/96 | 13/96 | 14/96 |

- Pooled, the stats arm moves `own` by +0.06 (95% CI −0.05 to 0.17). Only low stock moves clearly: +0.58 (0.27 to 0.89).
- Tabulation: 0/96 numeral leaks and 0/96 label leaks in each arm. No intent names a stat, a value or a descriptor. Mean length is unchanged (41–48 words per case in both arms).
- The background outweighs the stats. Bram "won't cross after dark", and the scene is at dusk, so both arms read him as guarded and declining, even at Trust 92. Odette's "distrusts strangers" holds her at a polite, cautious register at every Trust value.
- The judge picked neither for 129 of 192 intents. Most intents on this model are bland ("I want to remain politely..."), in both arms.

The field adds no leak and no length. It steers intent only where the stat names a concrete fact the scene can use (eels left to sell), not a mood the background already sets.
