# 07: Inline back arrow and a collapsed mobile chip strip

Status: ready-for-agent
Blocked by: 04 — The mirror
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: one shared control moves from `ListDetail`'s own row into each detail panel's header, across five surfaces, with `PanelTabsList` as the one placement seam.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

A pushed detail no longer spends a row on its back button. The back control becomes an icon-only arrow in the detail panel's own header: it leads the panel's tab strip, or the panel's first row when it has no strip. Every `ListDetail` surface changes, the mobile push included, so a user on mobile sees two arrows on two rows that already exist, not two extra rows. On mobile the placeholder chip strip also starts collapsed. Rulings Q33–Q37.

## Acceptance criteria

- [ ] `ListDetail` no longer renders a back row. It supplies the back button to the detail, and the detail places it (Q33). Side by side shows no arrow.
- [ ] The arrow is icon-only. Its accessible name and tooltip read "Back to <list name>", from today's `backLabel`.
- [ ] `PanelTabsList` takes a leading slot, and every tabbed detail puts the arrow there: the entity, location, stat and trait panels, and the Dictionary entry below its palette bar (Q34).
- [ ] The placeholder detail and the entity group detail put the arrow at the left of their first row, with no new row (Q35).
- [ ] The World Editor's mobile push, the stacked mirror, the Placeholders tab and the Dictionary editor all use the inline arrow (Q36). One code path places it; no surface draws its own.
- [ ] On mobile, the placeholder chip strip starts collapsed when no choice is stored. A stored choice still wins on every width (Q37).
- [ ] `list-detail.test.tsx` and the World Editor bench assert the arrow in the header and back navigation. Existing back-row tests change only for the moved control; each changed assertion has a stated reason.
- [ ] Static frames of the mirror at 1440×900 and 390×844, in both themes, show no back row. Send them for approval before ticket 05 starts.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] No export-shape change; say so in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan (the Design System's `ListDetail` and panel-tab references render these components).
