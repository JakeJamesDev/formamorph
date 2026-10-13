# 06: Stat Details In Cards

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Brings authored world data into the editor for stats, including the owner-route cards. Opus at high: a box-bound lookup, effective values and Blueprint rules.

## What to build

A card on a stat shows World Details: Type, Range, Starts At, Regen (in the stat's regen unit), Owner and Shown To. Rows at a default drop by one fixed table: Regen 0, Starts At equal to the minimum, Shown To both AI and player. Type, Range and Owner always show. Values are effective: a Link's Overrides first, then the Blueprint. A long description clamps to 3 lines.

The editor gets a lookup it calls when a card opens, bound to its box. It carries the owner's identity and, for a Blueprint box, its bearers. The name lists stay the only lint inputs. It maps code names to records through the same code-name map the sandbox uses.

`self` shows its own stat. `owner` shows the owning entity in an owned box. In a world box it says the entry is empty and writes through it are dropped, with no Open or Find All Uses. In a Blueprint box it lists the bearers. In a Blueprint box, `owner.stats.X` shows the Blueprint's own values plus a Bearers row. The Tool editor, the template dialog and the library editor have no lookup, so their cards show no World Details.

Spec: Q6, Q11, Q12, Q27, Q28, Q30; Implementation Decisions: World lookup, Effective values, Stat rows, Owner card, Blueprint boxes.

## Acceptance criteria

- [ ] Stat rows match the table: default rows drop; Type, Range and Owner always show
- [ ] A Link's card shows its Overrides
- [ ] `owner` cards differ per box kind as listed; the world-box card has no Open or Find All Uses
- [ ] In a Blueprint box, `owner.stats.X` shows Blueprint values and a Bearers row
- [ ] Descriptions clamp to 3 lines
- [ ] Guards bite: the default-row table, and `stats.X` in an entity box reaching the world stat
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
