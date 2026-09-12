# 04: Both Boxes In Checks, Bench, And Rename

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Every reader of a stat's code learns about the second box, plus one new bench rule. Precedented by the v3 and v4 tickets that widened the same readers. Sonnet at medium effort. Blocked by 03 only to keep two edits to the stat panel apart.

## What to build

Completions, the name checks, and the reserved-name warnings run on both editors. Bench rules that read a stat's code read both boxes, and each finding names the box. A new bench rule warns on before-the-AI code that reads `delta`, since it reads zeros there. The rename offer counts and rewrites references in both boxes, and discard restores both. The code-name drift guard and the surface drift guard cover both boxes.

## Acceptance criteria

- [ ] `stats["Vigour"]` in the before box is underlined and completed the way it is in the after box
- [ ] The unknown-stat bench rule reports a miss in either box and names the box
- [ ] The new rule warns on `delta` in the before box and stays silent on the after box
- [ ] Renaming a stat prompts with a count across both boxes; Yes rewrites both; discard restores both
- [ ] Drift guards run a fixture with code in both boxes
- [ ] Four gates green; graph updated

## Blocked by

- 03 — Test Code And Templates Per Box
