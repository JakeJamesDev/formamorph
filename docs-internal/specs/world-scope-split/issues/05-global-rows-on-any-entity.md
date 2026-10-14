# 05: Global Rows on Any Entity

Status: done
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: runtime stat effects with a once-per-holder rule.

## What to build

An active entity trait's Global row moves the global stat whoever is played (Q18). The trait editor offers the row on every entity, playable or not, and labels it **Global** in place of **Player**. Each holder's rows act once (Q17), so a linked trait the root also holds moves a global stat once per holder.

Spec: Q17, Q18, stories 4, 14.

## Acceptance criteria

- [ ] An unplayed entity's active trait with a Global row moves the global stat
- [ ] The trait editor offers a Global row on a non-playable entity and labels it **Global**
- [ ] Each holder's rows act once
- [ ] Four gates green

## Blocked by

- 03, 04
