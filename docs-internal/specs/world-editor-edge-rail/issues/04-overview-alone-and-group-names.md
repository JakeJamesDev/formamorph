# 04: Overview Alone And Group Names

Status: ready-for-agent
Blocked by: 01 — Edge Rail On The Desktop Editor
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: a registry reshape and two renames carried through the rail, the mobile Sections bar, their tests, the Design System reference and the guide; contained, with the rail's tests as the net.

## What to build

Overview leaves the first group and stands alone at the top of the rail as the landing tab: its icon first, a separator under it, then the groups (Q15). Its flyout reads "Overview" with no group part. The groups are renamed: **Content** holds Stats, Entities, Locations and Traits; **Vocabulary** holds Dictionary and Placeholders; **Logic** stays reserved and absent (Q16). Flyouts read "Content · Entities" and "Vocabulary · Dictionary".

The mobile Sections bar shows Overview as a lone row above the first caption, then the Content and Vocabulary captions with their rows. The bar's current-name slot still reads "Overview" when it is the active tab.

The tab registry carries Overview with no group and returns it ahead of the groups; both renderers draw that lone slot. The Design System's Edge Rail reference and showcase use the new names and the lone Overview. The World Editor guide and any help copy that names the groups follow. Changelog: one sentence folded into the effort's lead per Q14: "Overview stands alone at the top; the groups are Content and Vocabulary."

## Acceptance criteria

- [ ] Desktop Advanced: the rail reads Overview, separator, Stats, Entities, Locations, Traits, separator, Dictionary, Placeholders; no separator after Placeholders.
- [ ] Desktop Simple: the same with Placeholders absent.
- [ ] Flyouts: Overview shows "Overview"; Entities shows "Content · Entities"; Dictionary shows "Vocabulary · Dictionary".
- [ ] Mobile Sections bar: Overview as a lone row above the Content caption; captions read Content and Vocabulary.
- [ ] Registry test: Overview has no group and comes first; groups for both modes as ruled; the dev-router ledger guard passes unchanged.
- [ ] Guard bites: giving Overview a group turns the lone-slot test red.
- [ ] Design System reference, showcase test, and World Editor guide use the new names.
- [ ] Changelog sentence folded into the effort's lead.
- [ ] Gates green; graph updated.

## Blocked by

- 01 — Edge Rail On The Desktop Editor
