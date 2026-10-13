# 07: Trait, Placeholder, Entity And Dictionary Details

Status: done
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Extends 06's lookup to the other world kinds. Opus at medium: the patterns exist after 06.

## What to build

Trait cards show Mode (the player-facing name: Automatic, never `alwaysOn`), Requires (in the trait gate rows' wording), Changes, and Bearers: every entity that has the trait, with **You** for the persona. Placeholder cards show owner, kind and pin state, and Allowed Values with weights. A weight-0 value shows faded. A Copy's weights come from the Copy. Entity and dictionary cards show the description and what they hold. `persona` lists the entities the player can play, and notes that under a library persona code reaches the Custom Persona through `entities[...]`. `clock.daypart` shows its six values.

Spec: Q11, Q13, Q15, Q20, Q26, Q28; Implementation Decisions: Trait rows, Persona card.

## Acceptance criteria

- [ ] Trait rows read Mode, Requires, Changes and Bearers in glossary terms
- [ ] Placeholder values show weights; weight-0 values are faded; a Copy shows its own weights
- [ ] Entity, dictionary and persona cards show what the spec lists
- [ ] The `owner` card in an owned box uses the entity rows, replacing ticket 06's interim Entity and Stats rows (T06-6)
- [ ] The box-bound lookup supplies the owner's trait and placeholder names, so completion offers them after `owner.traits["` and `owner.placeholders.`, and their cards show details (T01-1, T01-3)
- [ ] Changelog fragment; four gates green

## Blocked by

- 06
