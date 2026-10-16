# 04: Stat Condition in the rows editor

Status: done
Blocked by: 01, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a picker section and a chip with two controls, built on an existing editor and an existing grammar. Component tests in jsdom.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

An author adds "Rage >= 80" to a trait's Availability rule from the editor (Q2, Q5, Q15, Q16).

- The picker gains a Stats section per bearer: the bearer's own stats; for the `you` bearer, the player's stats including the played persona's own. Blueprint stats resolve through the entity's links.
- Picking a stat places a chip with an operator control (segmented, six symbols) and a value field. A raw/`%` toggle sits beside the value and always shows (Q16).
- The chip reads as the sentence the rule text helper produces. Not flips it like any chip.
- The chips are the rule's sentence on the Availability tab (Q27). The parked requirement summary stays parked; the mode sentence is unchanged.
- Copy follows the Writing Guide: verb-first help, no on/off preamble. Labels in AP title case.

## Acceptance criteria

- [ ] Picking a stat shows operator and value controls; the chip text updates as they change.
- [ ] Switching raw to `%` keeps the value and re-renders with `%`.
- [ ] Not flips a stat chip and the chip reads "not Rage >= 80".
- [ ] Adding "Rage < 80" after "Rage > 20" is accepted, not refused as a duplicate.
- [ ] The Availability tab dev route shows a stat chip in both themes (static frames).
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
