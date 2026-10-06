# 04: World Editor Desktop Rail

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: reshapes the World Editor's desktop layout around a tab root that spans the rail and panels; the editor is the largest view and many tests find tabs by role.

## What to build

On desktop the World Editor's tab strip gives way to the Nav Rail as the list card's first column, full card height, inside one tab root that wraps the rail and the panels (Q8, Q18). Groups follow Q19: Overview alone, then Stats, Entities, Locations, Traits, then Dictionary and Placeholders. Simple mode still hides Placeholders. Scripts and Tools do not appear; the Logic group stays in the registry and draws nothing (Q10).

While the Test Bench is embedded in the list card, the rail stays drawn and disabled (Q16). The rail auto-collapses when the list panel would fall below a threshold (Q17); tune the threshold against the list panel's minimum width, then record the value in the spec.

Find, the Authoring Tour and Take Me There keep opening their tabs through the rail. Mobile is untouched in this ticket. The World Editor guide names the rail where it names the strip. Changelog fragment: the lead **The World Editor and Community Creations move their sections to a collapsible side rail.** and a sentence on the editor's rail.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245.

## Acceptance criteria

- [ ] On desktop a top-level tab is found by role in the rail; the list card has no tab strip.
- [ ] The rail's order and lines match Q19 in Simple and Advanced; no Scripts or Tools tabs.
- [ ] The rail starts expanded and remembers its state on this device.
- [ ] With the Test Bench embedded, every rail tab is disabled and the editor's tab is unchanged.
- [ ] Narrowing the window below the threshold draws the rail collapsed; widening restores the stored state. The threshold is recorded in the spec.
- [ ] A Find match, an Authoring Tour step and a Take Me There route each open their tab.
- [ ] Existing editor tests that pick a tab by role pass unchanged.
- [ ] World Editor guide updated; changelog fragment written.
- [ ] Gates green.

## Blocked by

- 03
