# 03: Not conditions

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: `settle` stops being monotone; the fix-up pass, its tie rule and the cascade return need careful reasoning and tests that bite.

Parent: [Trait Gate Rows spec](../spec.md)

## What to build

Any Condition can be flipped to Not. A Not Condition holds while its target is off: "not Paladin", "not any Class", "not playing as Sir Aldric", "Ash: not Tamed" (Q5). Picking something a trait excludes locks it; an active excluded trait turns off with the banner and returns when the pick is dropped (Q8, Q9). An Automatic trait with a Not Condition follows its gate both ways (Q10). Two defaults that exclude each other start with the later one off (Q16).

## Acceptance criteria

- [ ] `TraitRequirement` gains `not?: true`. `sameRequirement` compares it. The card codec carries it (Q18).
- [ ] A Not Condition holds when its target is off, for trait, group, playing-as and bearer forms. An exclusive sibling counts as off for a Not Condition.
- [ ] `settle`: least fixpoint for positive growth, then a check of every kept trait against the final set; a trait whose gate fails because a Not target joined turns off; repeat until stable (Q7). When two kept traits exclude each other, the one proposed later turns off (Q8). Turned-off traits go to cascade-off and return through it (Q9). Automatic traits never sit on the cascade-off list (Q10).
- [ ] `switchTrait` needs no new refusal: switching on a trait that excludes an active one cascades the other off, and the banner names it.
- [ ] `settleDefaults` turns off the later of two defaults that exclude each other (Q16).
- [ ] Text: "not X"; with a bearer "Ash: not Tamed", "You: not Paladin" (Q11). A Not Condition on a Hidden target is left out like a plain one (Q12).
- [ ] Editor: each chip has a Not flip. A Not chip shows a NOT mark and a dashed border. Tooltips read "Require it to be off" and "Require it instead". A target already present as plain can still be added as Not in another row.
- [ ] Tests at the gate module and gate line seams: every Not form, exclusion cascade and return, earlier pick wins, Automatic unless X, excluding defaults, the Hidden omission. Field test for the flip. Each guard is shown to bite by reinstating its bug.
- [ ] Changelog fragment names Not. Export-shape reminder in the landing message.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
