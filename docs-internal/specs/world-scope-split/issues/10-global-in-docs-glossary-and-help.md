# 10: Global in Docs, Glossary and Help

Status: done
Blocked by: 03, 04, 05, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: docs and copy against settled behavior.

## What to build

The glossary gains Global Stat, Global Trait and Persona Stat; "player stat", "world stat" and "other stat" go on the _Avoid_ line (Q3). The traits, stats, persona authoring, world format, Stat Code Guide and Glossary pages and the help content say global and persona. In Progress changelog entries that say player stats or Other Stats for global stats are reworded, and one entry describes the split and its gate change. The help index rebuilds, and a Formaquestion check confirms answers use the new words.

Spec: Q3, stories 1, 2, 30, 32.

## Acceptance criteria

- [ ] The glossary carries the three terms and the _Avoid_ line
- [ ] No doc or help page calls global stats player stats
- [ ] One In Progress entry describes the split; released sections are unchanged
- [ ] A Formaquestion check answers with global stats and persona stats
- [ ] The `copy-sweep` skill passes on the changed copy
- [ ] Four gates green

## Blocked by

- 03, 04, 05, 08
