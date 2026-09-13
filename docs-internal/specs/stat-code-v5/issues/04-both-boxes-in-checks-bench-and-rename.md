# 04: Both Boxes In Checks, Bench, And Rename

Status: ready-for-human
Base: b0167802
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Every reader of a stat's code learns about the second box, plus one new bench rule. Precedented by the v3 and v4 tickets that widened the same readers. Sonnet at medium effort. Blocked by 03 only to keep two edits to the stat panel apart.

## What to build

Completions, the name checks, and the reserved-name warnings run on both editors. Bench rules that read a stat's code read both boxes, and each finding names the box. A new bench rule warns on before-the-AI code that reads `delta`, since it reads zeros there. The rename offer counts and rewrites references in both boxes, and discard restores both. The code-name drift guard and the surface drift guard cover both boxes.

## Acceptance criteria

- [x] `stats["Vigour"]` in the before box is underlined and completed the way it is in the after box
- [x] The unknown-stat bench rule reports a miss in either box and names the box
- [x] The new rule warns on `delta` in the before box and stays silent on the after box
- [x] Renaming a stat prompts with a count across both boxes; Yes rewrites both; discard restores both
- [x] Drift guards run a fixture with code in both boxes
- [x] Four gates green; graph updated

## Blocked by

- 03 — Test Code And Templates Per Box

## Comments

Done in the commit this ticket's `Base:` leads to. Two calls beyond the ticket, both deliberate:

- **`stat-code-overrides-trait` reports per trait change, not per box.** The rule now judges each box on its own, which is stricter than before: a stat that reads itself in one box and recomputes in the other used to go silent. It still raises one finding per trait change and names every box at fault, because the collapsed row's headline counts findings — per-box rows would have read "2 trait stat changes" for one change.
- **`boxCode` / `noBoxes` moved from `statCodeTurn.ts` to `statCodeTiming.ts`,** with `CODE_FIELD` and `filledCodeBoxes` beside them. The Test Bench's pure pass needs to walk both boxes, and importing the turn runner would pull the QuickJS engine into it.

Known limit: `stat-code-before-reads-delta` matches a member read (`self.delta`, `stats.X["delta"]`) by regex, following `statNamesInCode` next to it. It misses a destructured read and would fire on `delta` inside a comment. An AST read would need the CodeMirror parser in the live pass.
