# 03: Bring library additions into the workspace

Status: ready-for-human
Blocked by: 02
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md); [accepted prototype record](../prototype.md).

## What to build

Players choose entities and dictionaries inside Library Additions and start a real game with independent copies of their choices. Remove the mandatory library-screen continuation so normal entry is one workspace followed only by Avatar when applicable.

Model rationale: reuse the existing finalization contracts while integrating artwork, search, ordering, and the shared draft; this is bounded application work with meaningful regression risk.

## Acceptance criteria

- [x] Add Entities, Library dictionaries, and Included with this world sections using recognizable artwork, names, available descriptions, and missing-art fallbacks. Use the domain term Entities.
- [x] Search filters presentation without clearing selections or changing dictionary order; filtered-out selections still reach the final payload.
- [x] Retain entity choices and dictionary enabled states/order across category changes, Introduction, and Avatar return. First-use library additions remain off; authored books honor their defaults.
- [x] Preserve enablement and full ordering across world and library dictionaries together. World-first/library-after is the default, not a restriction. Provide phone-touch and keyboard ordering as well as desktop operation.
- [x] Use source-qualified IDs to avoid collisions. An explicitly empty dictionary list remains empty; skipped customization must not be confused with disabling everything.
- [x] Resolve selected records through existing storage/finalization contracts. New-game entities and library dictionaries/entries receive fresh IDs, authored dictionary IDs remain stable, and entities enter the starting location through the existing path.
- [x] Missing library records are safely skippable under the existing finalization contract. Resolution failures retain the editable draft, duplicate starts are prevented, and originals/existing saves are unchanged.
- [x] Remove the legacy library continuation from normal entry. Start game or Continue to Avatar accurately describes the next action from every category. Library ownership never forces another review screen.
- [x] Remove obsolete production entry wiring only after all callers migrate; preserve the prototype branch as a historical reference rather than merging its controls or sample data.

## Verification

- Use the real MainMenu harness and storage to select, search, reorder, revisit, and start. Assert the resulting entities and dictionaries, not internal draft structure.
- Extend existing finalization tests for source collisions, missing records, full mixed-source ordering, all-off dictionaries, fresh IDs, and unchanged sources/saves.
- Exercise artwork fallbacks and ordering controls in the browser. Coordinate with 05 on the shared workspace interface; do not depend on its completed styling to implement library behavior.
- Run relevant gates, time tests, and prove key isolation/empty-selection guards fail when reverted. No test-only bypass of actual finalization.

## Scope boundary

Persistent defaults belong to 04. This ticket delivers complete per-game library configuration; no server dependencies, add-on synchronization, world-export changes, or Avatar redesign.

## Implementation record

- MainMenu and the real storage services cover retained selection, filtered finalization, mixed-source ordering, source-ID collisions, fresh copied IDs, explicit all-off dictionaries, cancellation, duplicate starts, deleted records, and retry after transient entity or dictionary failures.
- Focused verification: 92 tests passed in 13.87 seconds. Mutation checks failed when authored/library identity isolation, explicit empty selection, typed missing-record handling, and source-qualified ordering names were deliberately regressed.
- Coverage on the changed runtime surface reached 99.47% statements and 88.73% branches; `dictionarySelection.ts` and `enterFlow.ts` reached 100%.
- Static browser verification covered desktop and 390×844 layouts, artwork fallbacks, selection defaults, scrolling with fixed actions, mixed-source reordering, and the final accessibility tree.
- Independent spec and standards reviews reported no remaining findings after fixes.
- Final gates: typecheck passed in 13.42 seconds; lint passed in 11.65 seconds; 8,556 tests passed with 3 skipped in 51.95 seconds; production build passed in 15.26 seconds. Graphify rebuilt 10,898 nodes and 31,963 edges.
- No world/save export shape or version changed. The prototype reference remains untouched.
