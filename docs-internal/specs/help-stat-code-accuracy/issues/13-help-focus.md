# 13: Help Focus

Status: done
Blocked by: 12 — Fair Known Cases
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new registry beside the help world registry, wired through the editor panels, the help request's surface words, the code test's `stat` default, AI Context, an ADR line and two probe cases.

## What to build

The help request learns which item the player has selected on a tab. A panel that shows one item (a stat, a trait, an entity, a location, a dictionary entry) registers `{ kind, id, name }` in a focus registry while it shows, the way the game and the editor register the open world today, and removes it on close. The surface registry stays ids only.

With a focus registered:

- The surface line names it: "World Editor dialog, Stats tab, Code tab of the stat Courage". The structure still comes from the surface map; only the item's words come from the focus.
- The code test's `stat` input is optional and defaults to the focused stat, so the model stops inventing one.
- AI Context shows the focus beside the surface.

The spec's out-of-scope line on naming the open stat reopens on this evidence. A world item's name reaches the help request; the ADR from ticket 06 gains a line that says so. Help settings and exports are unchanged.

With the focus known, the two known cases from ticket 12 pass the stat in the surface and require the named stat's path again when the open stat is a different one.

## Acceptance criteria

- [x] A focus registry exists beside the help world registry; the panels that report a tab ledger register while shown and clear on close: the World Editor's stat, trait, entity, location and dictionary-entry panels and the Entity Editor's entity panel (Q39)
- [x] The surface words name the focused item when its kind matches the open tab; without a focus they read as today
- [x] The code test's `stat` is optional and defaults to the focused stat; an explicit `stat` still wins
- [x] AI Context shows the focus
- [x] The ADR records that a focused item's name reaches the help request
- [x] `brave-at-courage` and `quotes-pin` carry a focused stat in their surface and require the named stat's path again
- [x] Changelog fragment written
- [x] Cloud probe: smoke, then the five known cases × 5 runs, rider arm, focus Health, with an in-batch control; numbers recorded here and in the spec (Q39)

## Result

**Ticket 13 result.** (2026-10-05.) Cloud default, five known cases, 2 batches × 5 runs, the rider arm with the selected stat Health against a `nofocus` control arm in the same batch. Every Code-tab case carries the focus, since an open Code tab always has a stat selected. Smoke first: 2 cases × 1 run per arm, and a dump of the request read "World Editor screen, Code tab of the stat Health" on the focus arm. Pass: focus **52% (26/50)**, control **66% (33/50)**; batch 1 48% and 68%, batch 2 56% and 64%; runs 74% and 86%. No answer on either arm used `self.value`, and both read `stats.Courage.value` and `stats.Int.value`. Every failure outside the persona case is the fence tag-line drift in the Backlog (`before` on its own line): focus 13/50, control 7/50, Fisher p about 0.2, so the gap is not significant at n=50. Q40: 13 lands as built; ticket 14 fixes the drift in the rider and re-measures focus against no focus in one run. Per case, focus against control: prowler 7/10 and 8/10, seasoned-after-two-weeks 5/10 and 9/10, persona 0/10 on both, brave 5/10 and 10/10, quotes 9/10 and 6/10. Brave's five focus misses are all tag-line drift.
