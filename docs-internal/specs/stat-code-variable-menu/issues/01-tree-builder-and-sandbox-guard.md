# 01: Tree Builder and Sandbox Guard

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), decisions 1 and 5, rulings Q2, Q3, Q9, Q10, Q11, Q13.

## What to build

A pure module that turns the stat code surface and the editor's world names into the Variable menu tree. The tree's top level is This Stat, Stats, Traits, Entities, Persona, Placeholders, Dictionaries, Clock, in that order. A group holds children; a name list holds rows with a code name, a folder trail and a subtree; a field holds its insert text, an optional selected substring and the surface entry's info text; an empty group holds one marker with its message. `previous` and `delta` drill to their own fields. Placeholder functions insert complete, except `pin`, which inserts `pin("")` (an Object: `pin([""])`) with the text selected. Persona's Traits and Placeholders are the union over persona-flagged entities with the owner as the trail. Path segments take dot form for a plain identifier, by the test completions already use, and bracket form with a JSON string otherwise. In template mode the builder gets no names and every name list is one row that inserts a selected `Name`.

A guard builds the tree over a fixture world and runs every leaf's insert text through the stat code executor; each must run clean, in world mode and in template mode. It replaces the snippet guard added on 2026-10-05.

No UI changes in this ticket. The flat list stays until ticket 02.

Workload: the builder mirrors the surface lists and the analysis module's name shapes; getting owners, unions and the two path forms right across eight globals needs care. A top model at high effort.

## Acceptance criteria

- [ ] Top level order is This Stat, Stats, Traits, Entities, Persona, Placeholders, Dictionaries, Clock; `console` is absent
- [ ] This Stat roots at `self`; a stat under Stats roots at `stats.<name>`
- [ ] A plain name inserts in dot form; a name with a space inserts in bracket form with a JSON string
- [ ] A name that carries a placeholder chip inserts its code name
- [ ] `previous` and `delta` drill to their surface fields; `delta` drills once more per source
- [ ] A placeholder's `roll()` and `unpin()` insert complete; `pin` inserts `pin("")` with the text selected; an Object's `pin` inserts `pin([""])`
- [ ] An entity drills to its fields plus Traits and Placeholders over its own names
- [ ] Persona's Traits and Placeholders union the persona-flagged entities with no duplicate code names
- [ ] A dictionary drills to its fields plus Placeholders over its own names
- [ ] An empty name list is one marker per group ("No entities in this world" and the like); no group is hidden
- [ ] Every field leaf carries its surface entry's info text
- [ ] Template mode yields one type-over `Name` row per name list, selected
- [ ] Guard: every leaf in world mode and template mode runs clean in the executor
- [ ] Changelog fragment under Added, 🛠️ Developer tooling
