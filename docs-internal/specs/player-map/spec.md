# Spec: Player-Facing Map & Indented Location List

Status: ready-for-agent

## Problem Statement

Players change location through a bare dropdown that lists every location in raw authored order. In worlds with nested sublocations, the flat list gives no sense of which places sit inside which — "Cellar" and "Castle" read as peers. Meanwhile the author has already laid the world out spatially on the Locations Canvas (containment as Groups, travel as arrows), and none of that spatial understanding ever reaches the player.

## Solution

Grow the Change Location dialog into a two-view surface:

- **List** — the location list rendered as clickable rows in depth-first tree order, indented by depth, current location highlighted. Click a row to travel.
- **Map** — the player-facing readonly twin of the Locations Canvas: same authored layout, Groups, and Connection arrows, with the player's current location marked. Click a location to travel.

Travel from either view stays exactly what the dropdown does today: a silent, instant location change — no turn, no narration, no restriction (ADR-0006: travel rules bind only the AI router).

The same tree-order + indentation treatment applies to the World Editor's entity location picker, so the hierarchy reads consistently everywhere a full location list appears.

## User Stories

1. As a player, I want the location list ordered so sublocations appear under their parent, so that I can see the world's structure at a glance.
2. As a player, I want sublocations indented by nesting depth, so that I can tell how deeply a place is nested.
3. As a player, I want parent locations to remain directly selectable in the list, so that I can travel to a container location itself, not only its children.
4. As a player, I want a Map view of the world, so that I can navigate spatially instead of by name.
5. As a player, I want the Map to show the same layout the author built on the Locations Canvas, so that the world looks the way its author intended.
6. As a player, I want the Map to show Connection arrows including one-way direction, so that I can read how the world is wired.
7. As a player, I want my current location visibly marked on both the List and the Map, so that I always know where I am.
8. As a player, I want a single click on a Map location to travel there and close the dialog, so that traveling by Map is as fast as the dropdown was.
9. As a player, I want a single click on a List row to travel there and close the dialog, so that the List is one click faster than the old dropdown-in-dialog.
10. As a player, I want to travel to any location from anywhere, so that the Map never gates my movement (only the AI narrator is bound by travel rules).
11. As a player, I want to pan and zoom the Map and re-fit it to the viewport, so that I can explore large worlds comfortably.
12. As a player, I want the dialog to reopen on whichever view I last used, so that my preferred way of traveling is the default.
13. As a mobile player, I want the same List and Map views in a near-fullscreen dialog with touch pan and pinch-zoom, so that I lose nothing on a small screen.
14. As a player of a world whose author never arranged the canvas, I want the Map to still render (fallback placement), so that every world has a working Map.
15. As a player, I want editor diagnostics (start marker, unreachable badges) absent from the Map, so that I only see world information, not authoring warnings.
16. As a player, I want location names on both views resolved through Placeholders, so that the names match the rest of my playthrough.
17. As a world author, I want the entity location picker in the World Editor to use the same tree order and indentation, so that the editor and the game present the hierarchy identically.
18. As a world author, I want the canvas layout I saved (positions, Groups) to be exactly what players see, so that arranging the canvas is also authoring the player Map.
19. As a world author, I want the Map to be strictly readonly, so that players can never move nodes or alter my layout.

## Implementation Decisions

- **One entry point.** The existing Current Location button opens the grown Change Location dialog; no second button. The dialog hosts two tabs, List and Map.
- **List replaces the Select.** Rows are produced by the existing location tree helpers (build + flatten with depth); siblings stay in authored array order, children directly under their parent. Indentation is by depth via padding. The current location's row is highlighted; clicking any row (current included) calls the existing change-location handler and closes the dialog.
- **Map reuses the Locations Canvas mapping unchanged.** The pure world→nodes/edges builder is shared; the Map is a new readonly renderer over it. Readonly-ness, adornment stripping (no start marker, no unreachable badges), and the current-location highlight are renderer decisions — the mapping gains no mode option.
- **Map chrome is pan/zoom/fit only.** No minimap, no search, no editing interactions of any kind. Group headers are clickable and travel to the parent location. Drag-vs-click discrimination prevents accidental travel while panning. *(As built: xyflow's own discrimination never engages on readonly nodes — it also strips their pointer events, which the Map restores per node — so discrimination is the tested pure seam `isTravelClick` in `lib/locationCanvas`: press position + slop, touch slop for fingers, keyboard activations always travel.)*
- **Fallback placement stands.** Worlds with no saved canvas positions render the same deterministic fallback the editor shows on first open, never persisted (ADR-0004: positions are author-owned).
- **Travel is unchanged behavior.** Both views call the same silent instant handler the dropdown used; no turn, no narration, no destination validation (ADR-0006). Arrows are informational, not enforced, for the player.
- **Tab memory.** First open lands on List; thereafter the dialog opens on the last-used tab, persisted in localStorage as a UI preference. Not part of the save envelope.
- **Entity picker consistency.** The World Editor's entity location picker consumes the same flattened tree, gaining tree order and depth indentation.
- **Placeholder resolution.** Both views display placeholder-resolved names, matching how the game already resolves location names per playthrough.
- **No export-shape change.** The Map reads existing world fields (canvas positions, parent ids, Connections); nothing new is written to worlds or saves.
- **Terminology.** The player-facing surface is the **Map** (glossary: the readonly twin of the Locations Canvas); "canvas" remains authoring vocabulary.

## Testing Decisions

- Good tests assert external behavior at the seams — the rows/nodes a pure builder returns, or what a user sees and clicks — never renderer internals or styling classes.
- **Location tree helpers (existing pure seam):** order and depth of the flattened tree — children under parents, sibling array order preserved, orphaned parent ids treated as top-level. Extend the existing lib tests where they live.
- **Canvas mapping (existing pure seam):** already covered; no new mapping behavior means no new mapping tests. A regression guard that the Map path introduces no mapping option is unnecessary — the interface simply doesn't change.
- **Change Location dialog (new component seam):** jsdom component tests with the canvas stubbed (xyflow does not render in jsdom; same stubbing pattern the suite already uses for three/VRM views). Cover: rows render in tree order with per-depth indentation; clicking a row travels (handler called with the location) and closes; current location is highlighted; tab selection persists across reopen; Map tab mounts the stubbed canvas with the current location id.
- Prior art: the GamePanels test harness (real providers, stubbed heavy views) and the existing Radix-in-jsdom patterns for dialogs and tabs.
- Guards must bite: each new test is proven by reverting the behavior it guards (e.g. restoring raw array order must fail the order test).

## Out of Scope

- Any travel restriction for the player — enforcement, locked-destination UX, discovery/fog-of-war. ADR-0006 records the deliberate asymmetry.
- Location discovery/visibility (no such system exists; players see every location).
- Changes to the AI location router, its candidate list, or its prompts.
- Map editing of any kind in game, including position nudges.
- Minimap or search on the Map.
- StartingLocationModal (shows only the filtered starting subset as rows; indentation doesn't apply).
- Auto-arranging unpositioned worlds for display.
- Turn/narration side effects of travel.

## Further Notes

- The Map visibly renders arrows it does not enforce for player clicks — deliberate; see ADR-0006 for the reasoning and what extending restrictions to players would require.
- The glossary entry for **Map** was added to the domain glossary during design; keep player-facing copy on "Map" and authoring copy on "Locations Canvas".
- Changelog entry belongs in the 👤 player-facing bucket when implementation lands.
