# 01: Stat Condition kind, evaluator, rule text, card codec

Status: done
Blocked by: none
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new Condition kind through the gate evaluator's growth and drop passes, equality in four places, and a card codec with a silent-drop trap. Pure logic, dense tests.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

A trait's Availability rule can compare a stat to a number (Q1, Q2, Q5, Q15). A world JSON hand-edited to carry `Rage >= 80` on a trait gates that trait at setup and the player's requirement line reads it. No editor yet; this ticket is the grammar, the evaluator and the codec.

- The Condition carries stat id, stored name, optional bearer (absent = own entity), operator (`>`, `<`, `>=`, `<=`, `=`, `≠`), value, unit (`raw` | `percent`, reusing the threshold-unit type) and optional Not.
- The gate input gains per-owner stat values with effective min and max. A stat Condition evaluates directly during growth (it never takes the Not-holds shortcut), and resolves against its bearer's stat set. A missing stat, an inert stat (Q21) or a missing bearer is unresolved and does not hold. Percent on a zero span reads 0% (Q22). `=` and `≠` compare through the same rounding the stat bar uses.
- The `you` bearer reads the same owners as the player owner set, so the played persona's own stats resolve.
- Requirement equality, the duplicate check, the requirement summary and the portable-trait comparison include operator, value and unit.
- Rule text renders `<name> <operator> <value>` with `%` under percent. The player's line leaves out hidden and inert stats and drops a row left empty.
- The character card codec accepts the stat kind. Today it drops any other kind and the row with it.
- Static analyses in the gate module treat a stat Condition as satisfiable both ways (Q20); setup defaults settle against starting values. The Test Bench rules themselves are ticket 05.

## Acceptance criteria

- [ ] Six operators tested at the boundary value, raw and percent, Not, bearer `you` and entity, missing stat, inert stat, missing bearer, zero span.
- [ ] A stat Condition in a row with trait Conditions settles correctly in growth and drop; a failed pick is never blamed on an unrelated returner.
- [ ] "Rage > 20 and Rage < 80" is two Conditions in the duplicate check, the summary and the portable comparison.
- [ ] The player's requirement line renders a stat Condition and omits one on a hidden or inert stat.
- [ ] A card with a stat-gated trait round-trips the Condition. A guard test proves the old codec dropped it.
- [ ] A stat-gated trait is not reported never-unlockable by the static analyses; a conflicting trait-only row still is.
- [ ] No export-shape change for worlds: the new kind is additive inside existing rows. The landing response still carries the export-shape reminder for cards.
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
