# 04: Character Stats in the Character Pass

Status: ready-for-agent
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
