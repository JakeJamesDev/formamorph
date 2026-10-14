# 08: Global Blocks in AI Requests

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: prompt wording and order changes judged by probe numbers.

## What to build

A played entity's stats always sit in the Persona block, including the Custom Persona entity under a library persona and under None (Q11, Q1b). Global stats sit under **Global Stats** and picked global traits under **Global Traits** (Q16). Both blocks sit before the Player Character block in every prompt (Q24). Prompt lines that say "the player's stats" name the persona's or the global ones (Q12). The entity-stats, persona-block-stats, persona-stats-chip and owned-traits probe harnesses move to the new shape first. Prompt changes follow the prompt-writing guide and ship with probe numbers.

Spec: Q1b, Q11, Q12, Q16, Q24, stories 20–25, 31.

## Acceptance criteria

- [ ] Played entity stats sit in the Persona block under a world persona, a library persona with a Custom Persona entity, and None
- [ ] Global stats and global traits sit under their Global headings, before Player Character, in every prompt
- [ ] No prompt line calls global stats the player's
- [ ] The four probe harnesses read the new shape
- [ ] Probe numbers with in-batch controls show no loss in persona-stat use (probe skill)
- [ ] Four gates green

## Blocked by

- 01
