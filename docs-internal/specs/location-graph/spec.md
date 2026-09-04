# Location Graph

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

World authors can nest locations (sub-locations) but cannot control how locations actually connect. Navigation is an accident of the containment tree — every sibling reaches every sibling, and the only authored tool is a fragile name-string list that silently dangles on rename and is one-way by accident rather than by intent. Authors cannot build portals, one-way drops, or cross-region links deliberately, cannot see their world's navigable shape while authoring it, and cannot trust that renaming a location keeps its links. Separately, entity presence is scattered: one entity appearing in five locations means five list memberships spread across the world, which reads backwards and blocks the planned "frequents" feature.

## Solution

Locations become nodes in a real graph. Authors draw **Connections** — one-way or two-way travel links between any two locations, with an optional AI travel hint — on a visual node canvas that shows containment as grouped boxes and the free **implicit navigation** (parent/children/siblings) as dashed arrows. A Connection between a pair replaces that pair's implicit link (ADR-0002), so one-way travel works everywhere and is enforced structurally: the location router only ever sees the effective candidate list, so a forbidden return trip is never offered rather than verbally forbidden. Entity membership flips to entity-owned (ADR-0003), aligning authored entities with runtime discovered entities and paving the way for entity ranges. Existing worlds migrate losslessly: reciprocal name-pairs merge into two-way Connections, unmatched names become one-way Connections, and nothing plays differently until an author reaches for the new tools.

## User Stories

### Connections (data + play)

1. As a world author, I want to connect any two locations regardless of where they sit in the containment tree, so that distant regions can link without restructuring my world.
2. As a world author, I want Connections to be one-way when I choose, so that portals, drops, and chutes work without inventing workarounds.
3. As a world author, I want a two-way Connection to be a single link, so that I don't maintain two mirrored declarations that can drift apart.
4. As a world author, I want Connections to survive renaming a location, so that tidying names never silently breaks my world's navigation.
5. As a world author, I want an authored Connection between two tree-adjacent locations to replace their free implicit link, so that a one-way link between siblings actually means one-way.
6. As a world author, I want locations I never touch to keep their free parent/children/sibling navigation, so that casual worlds need zero graph work.
7. As a world author, I want an optional travel hint on a Connection, so that the narration knows *how* the player travels ("through the shimmering portal"), not just where.
8. As a player, I want my movement options to reflect the authored graph, so that a cave-in world's one-way drop actually commits me.
9. As a player, I want to never be offered a return trip through a one-way Connection, so that the world's constraints feel real rather than nagged about.
10. As a small narration model, I want the destinations list to contain only true candidates with no constraint prose, so that I cannot misread a rule I was never shown.

### Migration & compatibility

11. As an author with a shipped world, I want my existing name-based connections converted to Connection records with identical effective navigation, so that my world plays the same after upgrading.
12. As an author who declared a connection in both directions, I want those merged into one two-way Connection, so that my intent is represented once.
13. As an author with a dangling connection name, I want the migration to drop it cleanly, so that broken strings don't become broken records.
14. As an author importing an old world export, I want migration to run at every import boundary, so that shared community worlds work regardless of the version that exported them.

### Entity ownership flip

15. As a world author, I want each entity to list the locations it belongs to, so that one character's whereabouts is one field instead of memberships scattered across locations.
16. As a world author, I want an entity in multiple locations to remain present at all of them, so that the flip changes ownership, not behavior.
17. As a world author editing an entity, I want to manage its locations from the entity's editor, so that "where does this character appear" is answered where the character lives.
18. As a world author editing a location, I want to still see and edit which entities are present there, so that location-first authoring keeps working (the view inverts the entity-owned data).
19. As a systems maintainer, I want authored entities and runtime discovered entities to agree that entities own their location, so that one mental model covers both.

### Canvas (authoring)

20. As a world author, I want a visual node canvas of my locations, so that I can see the world's shape instead of reconstructing it from lists.
21. As a world author, I want containment drawn as boxes-within-boxes, so that "inside" reads as geometry rather than as edges (no parent↔child lines — the box is the relationship).
22. As a world author, I want implicit sibling travel drawn as tightly-coupled dashed arrows (one per direction), so that free travel is visible but clearly distinct from authored Connections.
23. As a world author, I want authored Connections drawn as primary-colored solid arrows, one arrow per travelable direction, so that one-way links are readable at a glance by counting arrows.
24. As a world author, I want to draw a new Connection by dragging between two locations, so that linking is direct manipulation.
25. As a world author, I want a newly drawn Connection to default to two-way, so that the common case needs no follow-up click.
26. As a world author, I want to select a Connection and toggle its direction, flip one-way orientation, edit its travel hint, or delete it, so that the canvas is a full editor rather than a viewer.
27. As a world author, I want to click a dashed implicit arrow to materialize it into an authored Connection, so that upgrading free travel into a deliberate link is one gesture.
28. As a world author, I want to drag a location into or out of a containment box to reparent it, so that the canvas edits structure, not just links.
29. As a world author, I want my arranged node positions saved with the world, so that my mental map survives reload, export, and sharing.
30. As a world author, I want locations unreachable from any starting location badged on the canvas, so that one-way traps and orphaned islands are visible before a player finds them.
31. As a world author, I want to switch between the existing list view and the canvas in the same Locations panel, so that quick edits, mobile authoring, and accessibility keep the list while spatial work gets the canvas.
32. As a world author, I want opening a location's full editor from its canvas node, so that descriptions and images stay one click away from the map.

### Guardrails

33. As a world author, I want deleting a location to delete its Connections, so that no record dangles.
34. As a returning author, I want worlds with no authored Connections to behave exactly as before the feature, so that upgrading costs nothing.

## Implementation Decisions

**Vocabulary** (glossary): **Connection** — an authored travel link between two locations, one-way or two-way; where one exists between a pair it replaces that pair's implicit navigation. **Implicit Navigation** — the free travel a location gets from containment: parent, children, siblings. Top-level locations are not siblings of each other. Never "edge" (internal only), "path", or "route" in UI or docs.

**Data model**: Connections are world-level records `{id, from, to, twoWay, aiHint?}` keyed by location id. One optional hint per Connection (direction-neutral); per-direction hints are a possible later additive field. Canvas positions persist as an editor-only per-location field (like existing editor-only fields, never sent to the AI). Entity membership becomes an entity-owned location-id list; the location-side list is removed. All three are export-shape changes; migrations are written but version bump and release remain user-managed.

**Effective-navigation rule** (from the prototype, validated there): implicit pairs are parent↔child plus sibling↔sibling under a shared non-null parent; any authored Connection between a pair (either direction) removes that pair's implicit link; a location's destinations are its surviving implicit neighbors plus authored outgoing (plus incoming two-way) Connections. Reachability = directed BFS from every starting location. The prototype's pure `Rules` module is the reference implementation:

```js
// implicit pair survives only if no authored Connection exists between the pair
for (const [a, b] of implicitPairs(locations)) {
  if (authoredPairKeys.has(pairKey(a, b))) continue;
  // ...a and b reach each other for free
}
for (const c of connections) {
  if (c.from === id) out.set(c.to, c);
  else if (c.twoWay && c.to === id) out.set(c.from, c);
}
```

**Router & prompts**: the destinations builder consumes the effective-navigation rule; the location router keeps matching the model's reply against candidates only. No direction language anywhere in prompt text; the travel hint renders as a `— via <hint>` suffix on the destination line. Prompt-text wording changes, if any, follow the prompt-writing guide's probe bar.

**Migration**: name-based connection lists pair-merge (reciprocal → one two-way record; unmatched → one one-way record; dangling names dropped). Entity flip inverts location→entities into entity→locations. Both idempotent, applied at the same central migration point and import boundaries as existing migrations. Effective navigation before and after migration must be identical for every location (this is the migration's acceptance test).

**Canvas**: @xyflow/react 12 (MIT, verified 2026-08-13), rendered as a list ⇄ canvas view toggle inside the existing Locations editor panel. Containment as nested group nodes; no parent↔child edges drawn (the box is the relationship); implicit sibling travel as paired dashed arrows; Connections as primary-colored solid arrows, one per travelable direction; drag-to-connect (default two-way); click a dashed arrow to materialize it; drag into/out of a group to reparent; unreachable badge from the reachability rule. A pure mapping layer converts world data → node/edge props and canvas gestures → world mutations; the xyflow component itself stays a thin shell over that mapper. Editing world data flows through the existing editor write-through path (GameDataContext), never a parallel store.

**Entity flip surfaces**: entity editor gains the locations list; location editor keeps an entities view computed by inversion. All AI-context builders (rosters, sub-location entities, reachable entities, presence filtering) read the inverted index; their rendered output for an equivalent world is unchanged.

**Sequencing** — three slices, each landing with gates green:
- **A. Entity ownership flip** — types, migration, context builders, both editor surfaces.
- **B. Connection records** — types, pair-merge migration, effective-navigation rule replacing the old union logic, destinations/hint rendering, list-UI editing of Connections (so the feature is usable pre-canvas).
- **C. Canvas** — dependency, mapper layer, canvas component, view toggle, positions persistence, unreachable badge, dev-route coverage.

## Testing Decisions

Good tests here assert **external behavior at the four agreed seams**, never internals:

1. **Rules/context functions** (existing seam): given plain worlds, assert effective destinations, override behavior, one-way asymmetry, reachability, and rendered chip text — in the style of the existing location-context tests. Cases to cover: sibling override one-way (A→B offered at A, absent at B), top-level non-siblinghood, stranded location, hint suffix rendering, empty-connection world identical to today's output.
2. **Migration** (existing seam): pair-merge and entity-flip through the central migrate function — reciprocal merge, unmatched one-way, dangling drop, idempotency (migrate twice ≡ once), and the equivalence property: effective navigation per location identical before/after. Prior art: the existing version/import migration tests.
3. **Turn/router behavior** (existing seam): through the Turn Pipeline's fake request adapter per ADR-0001 — a scripted router reply matching a one-way-hidden name does not move the player; candidates fed to the prompt match the rules module.
4. **Canvas mapper** (the one new seam): pure tests — world → expected nodes/edges (grouping, dashed pairs, arrows-per-direction, badge flags) and gesture intents → expected world mutations (connect, materialize, reparent, position move). The xyflow shell is verified in the live preview via the dev-router with static-frame/DOM evidence, per project convention; no motion or timing assertions. A dev-route entry makes the canvas reachable in one goto.

Guard quality follows the house test bar: each new guard proven by reinstating the bug (e.g. re-adding the implicit return path must fail the one-way test); no scenario rigging.

## Out of Scope

- **Runtime edge changes** (cave-ins, portals appearing mid-play, locked/conditional Connections) — explicitly excluded; the authored graph is static during play.
- **Entity ranges** ("frequents" vs "lives here") — deferred; the flip only prepares the ownership direction.
- **Per-direction travel hints** — later additive field if wanted.
- **Auto-layout** of the canvas — positions are author-arranged only.
- **Version bump, changelog finalization, and shipping the migrations** — user-managed release signals.
- **Visual polish beyond the prototype's vocabulary** (minimap theming, edge routing tuning) — follow-up.

## Further Notes

- ADR-0002 (Connections replace implicit navigation per pair) and ADR-0003 (entity-owned membership) record the two load-bearing decisions; the spec defers to them on rationale.
- The validated prototype (canvas vocabulary + reference rules module) lives beside this spec as `prototype.html`; its `Rules` module is the lift-ready reference for slice B.
- Slice B must land with a minimal list-based Connections editor so the data layer is authorable and testable before the canvas exists; the canvas then replaces nothing — it adds a surface.
- The entity flip and the Connection migration both touch world JSON: coordinate with the user on whether A and B ship in one release (one version bump) or two before cutting anything.
