# 03: Bring library additions into the workspace

Status: ready-for-agent
Blocked by: 02
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World spec](../spec.md); [accepted prototype record](../prototype.md).

## What to build

Players choose entities and dictionaries inside Library Additions and start a real game with independent copies of their choices. Remove the mandatory library-screen continuation so normal entry is one workspace followed only by Avatar when applicable.

Model rationale: reuse the existing finalization contracts while integrating artwork, search, ordering, and the shared draft; this is bounded application work with meaningful regression risk.

## Acceptance criteria

- [ ] Add Entities, Library dictionaries, and Included with this world sections using recognizable artwork, names, available descriptions, and missing-art fallbacks. Use the domain term Entities.
- [ ] Search filters presentation without clearing selections or changing dictionary order; filtered-out selections still reach the final payload.
- [ ] Retain entity choices and dictionary enabled states/order across category changes, Introduction, and Avatar return. First-use library additions remain off; authored books honor their defaults.
- [ ] Preserve enablement and full ordering across world and library dictionaries together. World-first/library-after is the default, not a restriction. Provide phone-touch and keyboard ordering as well as desktop operation.
- [ ] Use source-qualified IDs to avoid collisions. An explicitly empty dictionary list remains empty; skipped customization must not be confused with disabling everything.
- [ ] Resolve selected records through existing storage/finalization contracts. New-game entities and library dictionaries/entries receive fresh IDs, authored dictionary IDs remain stable, and entities enter the starting location through the existing path.
- [ ] Missing library records are safely skippable under the existing finalization contract. Resolution failures retain the editable draft, duplicate starts are prevented, and originals/existing saves are unchanged.
- [ ] Remove the legacy library continuation from normal entry. Start game or Continue to Avatar accurately describes the next action from every category. Library ownership never forces another review screen.
- [ ] Remove obsolete production entry wiring only after all callers migrate; preserve the prototype branch as a historical reference rather than merging its controls or sample data.

## Verification

- Use the real MainMenu harness and storage to select, search, reorder, revisit, and start. Assert the resulting entities and dictionaries, not internal draft structure.
- Extend existing finalization tests for source collisions, missing records, full mixed-source ordering, all-off dictionaries, fresh IDs, and unchanged sources/saves.
- Exercise artwork fallbacks and ordering controls in the browser. Coordinate with 05 on the shared workspace interface; do not depend on its completed styling to implement library behavior.
- Run relevant gates, time tests, and prove key isolation/empty-selection guards fail when reverted. No test-only bypass of actual finalization.

## Scope boundary

Persistent defaults belong to 04. This ticket delivers complete per-game library configuration; no server dependencies, add-on synchronization, world-export changes, or Avatar redesign.
