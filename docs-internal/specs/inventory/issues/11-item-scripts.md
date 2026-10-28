# 11: Item Scripts

Status: ready-for-agent
Blocked by: 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new script home and timings, a new world-write kind, and re-entry limits.

## What to build

Items run scripts. Items become a script home with five timings: **When Gained**, **When Lost**, **When Equipped**, **When Unequipped** and **When Consumed** (Q33). They fire from the Inventory module's script events; seeding fires none (Q59). On an item, the script `owner` is the Item Copy's owner, empty while it lies at a location (Q67).

The script surface gains inventory reads (who owns what) and an inventory write kind in `WorldWrites`: gain, lose, transfer, equip, unequip, consume, reveal and set charges (Q41). Script writes go through the Inventory module with the source `script`, so Bound does not block them (Q58). Item script writes fire item timings up to a depth of 3, then stop with a diagnostic (Q66). A panel action between turns runs item scripts against the current committed state.

Spec: Q33, Q41, Q58, Q59, Q66, Q67; stories 6, 43, 45, 89–92.

## Acceptance criteria

- [ ] The item editor has a Scripts section with the five timings
- [ ] Each timing fires once for its event from the panel, the pass and scripts; seeding fires none
- [ ] A script can read who owns an item and gain, lose, move, equip, consume, reveal and recharge Item Copies
- [ ] A script removes a Bound Item Copy
- [ ] A When Gained script that gives an item chains to depth 3 and then stops with a diagnostic
- [ ] An item script's `owner` reads the Item Copy's owner
- [ ] CONTEXT.md's Timing and script-home entries list items; the Scripts guide describes the timings and writes; changelog fragment written
- [ ] The `items` script global reaches item placeholder code paths (`items["Name"].placeholders…`) that ticket 01 already names
- [ ] The play-time stat-code sandbox state carries Item Copies, and discarding an unpaired user turn restores Item Copies that before-box scripts wrote (from ticket 02's landing)

## Blocked by

- 06
- 07
