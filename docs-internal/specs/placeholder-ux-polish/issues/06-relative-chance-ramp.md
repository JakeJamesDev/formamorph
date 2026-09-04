# 06 — Relative chance ramp with a readable plain chip

Status: done
Type: task
Spec: ../followup-spec.md (issues 1 and 2)

## Task

Recolor value chips in `PlaceholderManager` by chance relative to the highest sibling, and fix the
mid-ramp contrast collapse.

- `lib/chanceColor.ts`: `chanceChipStyle` mixes from the secondary chip (rel 100) toward a benched look
  (muted background, muted-foreground text, reduced opacity) at rel 0. `accentAtChance` keeps the
  saturation scaling for rel 1–100 and returns the benched look at 0. Both return one `ChanceStyle`
  that now carries `opacity`.
- `PlaceholderManager.chipStyle`: compute `rel = chance / max` over the placeholder's values. Benched
  values are excluded from the max. Reference chips use effective chance; the row factor is common to
  all siblings, so relative is unchanged.
- The eye's percent suffix keeps showing the real effective chance.

## Acceptance

- An even four-way wildcard shows four ordinary secondary chips.
- Weights 3,1,1,1 show one full chip and three faded ones, all with readable text.
- A weight-0 value of either kind shows the identical benched look.
- `chanceColor.test.ts` covers the formula, both ramps and the 75% contrast case.

## Answer

Shipped. `chanceColor.ts` now exports `relativeChance`, a shared `BENCHED` look, and both ramps return a
`ChanceStyle` with `opacity`. `PlaceholderManager.chipStyle` reads each value against the strongest local
sibling; the eye keeps the effective percent. Note on the Task bullet above: the row factor is *not* common
to all siblings, since `chipChance` applies it to reference chips only. Relative chance therefore uses each
value's local chance for every kind, which is what the spec's `rel = chance / maxChance` over one
placeholder's values means. Do not switch it to effective chance. `EditableChip` no longer resets a resting chip's opacity to 1,
which the drag style had been doing. Verified live on the stress world: Wolf 3 / Bear 1 / Boar 0 in both
themes, and an even eight-way Season as plain chips.
