# 04: World Option Condition, Scripts And Test Bench

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Gates and scripts can use World Options, and Test Bench can try them.

- A World Option Condition joins the Requirement union. It names an Option by id with its stored name. It tests a choice value, a boolean state, or a number with the stat comparison operators. It has no owner. Choice and boolean tests can carry Not.
- Every Requires editor (traits, image Visibility rules) offers the new Condition. The lock line renders it. This ticket owns the helper that leaves out Conditions on hidden Options; ticket 09 uses it.
- A script global exposes World Options by name: read the value, write a new one. Writes follow the existing script write timing and persist in 03's save record (Q17).
- Test Bench lets the author pick each Option's value, and gates read the picked values. Elsewhere outside play, gates read defaults (Q25).
- A player's mid-game Option change (05's `changeWorldOption`) runs the trait and item settle, like a trait toggle, so gates on the Option settle at once (Q41). 05 left this to 04.
- From 07's landing: if 07 is on main when 04 lands, 04 wires play's Option values and the world's Options into the gate input in `useInPlayWorld`, and the Test Bench picker also feeds the entity-gate start input (`startGateInput`).
- Glossary: add the World Option Condition to CONTEXT.md.
- Docs: the wiki's Requirements and script reference pages. Changelog fragment.
- ⚠️ Export-shape change: a new Condition kind in worlds.

Spec rulings: Q4, Q8, Q11 (hidden filter), Q17, Q25.

## Acceptance criteria

- [ ] Evaluator tests cover each Option type, Not on choice and boolean, and every number operator.
- [ ] A trait gated on an Option turns on when a script writes the matching value, at the script's write timing.
- [ ] The hidden-Option filter drops a hidden Option's Condition from a lock line and keeps a shown one; the guard bites when the filter is removed.
- [ ] A Test Bench lens test shows a gate result flipping when the picked Option value changes.
- [ ] Frames: `.scratch/frames/option-condition-row.png`, light and dark, 1280 px.
