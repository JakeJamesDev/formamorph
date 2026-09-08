# Locations Canvas reference review

## Scope and state ownership

The reference reuses the production `LocationCanvasWorkspace`, including its embedded and fullscreen composition. Its eight locations contain two nested Groups and three authored Connections: a one-way sibling override, a two-way cross-Group link with a long label, and a one-way link between top-level locations.

| Dependency | Production | Reference |
| --- | --- | --- |
| Locations and Connections | `useGameData` and its authored-world setters | Cloned sample arrays and React state setters |
| Placeholder labels | Authored-world placeholders, placement letters, and owners | Empty collections; sample names contain no placeholders |
| Undo/redo | `canvasHistoryFor(worldId)` survives canvas/list switching | A ref owned by the mounted reference |
| Snap, grid, connection style | Existing localStorage-backed hooks | React state initialized from the same defaults |
| Fullscreen and selection | Existing canvas session and morph hook | The same session and morph hook |

`CanvasInner` reads the supplied data and preferences. Only the production wrapper calls the persistent hooks or accesses the shared world history. The reference mounts without `GameDataContext`; no world-loading, migration, save, or storage adapter is supplied. Switching away from the reference discards its local changes. Fullscreen round-trips retain them.

The extraction changes no graph intent, drag, nesting, connection, touch, or arrangement algorithm. Containment and authored Connections retain [ADR-0002](../../../docs/adr/0002-connections-override-implicit-navigation.md) semantics. The sample stores manual positions; rendering and fitting the viewport do not arrange it.

## Functional writing review

Reviewed against the repository [Writing Guide](../../../docs/Writing-Guide.md), its Issue 9 evidence, and the domain glossary. This is a bounded review, not a full STE certification.

| String | Role | Evidence and verdict |
| --- | --- | --- |
| `Locations` / `Locations Canvas Reference` | Navigation/title | Existing location and Locations Canvas concepts. Title Case; standalone-fragment grammar remains unverified under the guide. |
| `Bounded spatial editing` | Registry description | Identifies the composition; terminology/formatting only. Full dictionary/fragment review remains unverified. |
| `Select “Edit Full Screen”.` | Instruction | One imperative action with SELECT in its choice sense; exact production control quoted under rules 5.3 and 8.6. No invented toolbar label. |
| `Selected Location` | Output accessible name | Existing domain noun; the output exposes the full authored name and current coordinates. Label-fragment grammar remains unverified. |
| Sample location names and travel hints | Authored content | Retain their own voice; outside functional STE copy. |

The reference adds no toolbar control or success/failure message. Existing canvas names, search outcomes, tooltips, and inspector copy are reused without certifying their vocabulary. Rules 1–6, 8, and 9 guide vocabulary, action structure, terminology, and meaning; there is no safety procedure for section 7. The one new instruction has no multi-step order, passive construction, conditional, or long noun cluster. Technical names preserve the glossary's distinction between Groups, Connections, and Auto Arrange. Unresolved label grammar and reused-copy review need a qualified writing review before any compliance claim.

## Automated evidence

- Focused suite: **143 tests passed**, exit 0, **7.01 seconds** wall time; test bodies totaled 1.23 seconds, runner 5.61 seconds including transform/environment/coverage.
- Scoped V8 coverage: reference **100% statements/branches/functions/lines**; canvas **67.38% lines**, **66.66% branches**, **34.48% functions**. The unit integration guard covers mounting without a world provider, local preference controls, arrangement/history, fullscreen, and fresh remounts. Pointer geometry remains browser-tested rather than simulated by jsdom.
- Shared-history mutation failed at the fresh-remount undo assertion (**4.31 seconds**). Persistent-hook mutation failed on actual localStorage reads (**4.18 seconds**). Both source mutations were restored before the green coverage run.
- Reconnecting the renderer to `useGameData` failed with the missing-provider error (**4.00 seconds**). The restored integration guard passed again (**4.23 seconds**, exit 0).
- Existing production browser regressions: **5 passed**, exit 0, **27.25 seconds**. Covered connection inspector interaction, drag-to-Group nesting, context menu versus pan, connection-style persistence, and nested search/minimap navigation.
- Existing mobile production regressions: **2 passed**, exit 0, **13.53 seconds**. Covered touch hold selection/deselection and embedded/fullscreen composition.

## Two-axis review

The Standards review found stale production-specific comments around the controlled workspace; those now describe caller-owned data and history. The Spec review found a browser test requesting Auto Arrange All after selecting a child; it now exercises the selected Group's Auto Arrange and checks its undo against the prior position. Neither review found a substantive implementation defect or scope expansion.

The final Spec follow-up reviewed the integrated registry, guide, browser test, and evidence record and reported no remaining substantive findings. The existing design-system skill reaches this reference through the guide without a duplicated registry.

## Browser evidence and limits

Route: `#dev?modal=designSystem`, then the Locations tab. The reference browser test passed at **1280×860 desktop** and **375×812 with touch**, exit 0, **13.06 seconds** wall time after the shared navigation correction. It checked nested frame geometry, authored directional arrows, a missing implicit return arrow, search/reveal, explicit selection, keyboard movement, pan, zoom, fit, minimap navigation, scoped Auto Arrange with undo, Connection hint editing with undo, local preference changes, and fresh state after leaving the tab.

The [desktop captures](../../../.scratch/locations-browser/locations-reference-locati-e662e-rarchy-and-responsive-tools-desktop) and [mobile captures](../../../.scratch/locations-browser/locations-reference-locati-e662e-rarchy-and-responsive-tools-mobile) include the embedded panel, revealed location, light/dark fullscreen views, and Connection inspector. These are local verification artifacts, not shipped assets. Screenshots disable CSS transitions; reduced motion is enabled. The production Purple palette and Atkinson Hyperlegible font are applied to the isolated document root and verified through computed styles. The showcase intentionally omits SettingsProvider, so this checks inheritance rather than loading saved appearance preferences.

Observed limitations retained from production:

- Fit View makes this wide, nested sample small on a phone. Search reveals a named location at readable zoom; zoom and pan remain available.
- The fullscreen toolbar scrolls horizontally on a phone, with search beneath it. The Connection inspector can cover both; close the inspector before returning to the toolbar.
- Long Connection labels cross other graph content. A Group can intercept a click on a Connection segment within its frame; the exposed segment outside that Group remains selectable.
- Search reveals and briefly marks the result; clicking the location selects it. Search does not change selection by itself.

The initial browser run hit an old no-watch server registry (**62.17 seconds**, exit 1); restarting the server resolved it. Subsequent test corrections matched production behavior: reveal versus selection (**13.15 seconds**, exit 1), and selecting the exposed Connection segment (**14.07 seconds**, exit 1). No fixture node, label, or behavior assertion was removed. The final green run exercises those interactions directly.

An earlier complete browser pass took **12.48 seconds**. The post-navigation rerun caught a stale pointer coordinate after Connection undo (**17.54 seconds**, exit 1). The test now waits for the restored rendered hint and recomputes the exposed segment's geometry before reopening its inspector.

Visual inspection found overlapping reference-tab labels at 375px despite a passing page-width assertion. Ticket 09 changed the shared shell to wrapping equal-column rows and added text-bound checks. The final mobile capture verifies readable, separate labels with the full seven-reference registry. This shared correction belongs to ticket 09; the Locations reference and spatial pattern remain ticket 07.

## Final test gate

The complete suite passed **8,590 tests**, with **3 skipped**, exit 0, in **62.14 seconds** wall time. Vitest reported 61.09 seconds elapsed and 399.34 seconds of test bodies summed across workers; this run showed no process-exit delay. The earlier concurrent run took 63.82 seconds and failed only on ticket 09's duplicate-text query, which that ticket resolved before the green run.

After ticket 08 committed, the refreshed suite passed **8,595 tests**, with **3 skipped**, exit 0, in **61.79 seconds**. The runner reported 60.68 seconds against 393.96 seconds of test bodies across workers. Lint and build passed; build took 37.62 seconds while gates ran concurrently. A new ticket 09 test initially failed typecheck because its role query used an unsupported option; its owner corrected the query before the final typecheck.
