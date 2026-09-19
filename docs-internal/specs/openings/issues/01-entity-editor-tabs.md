# 01: Match The Library Entity Editor To The World Editor Tabs

Status: ready-for-human
Base: 9740ab36
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** An entity author sees the same tabs in both entity editors. The library entity editor takes the World Editor's organization: Profile, Descriptions, and Placeholders. It keeps its Overview tab, which holds publish information only. Every field that exists today still exists, in the tab the World Editor puts it in.

**Rationale for the model:** a contained UI move over shared field bodies, with component tests as the guard. Sonnet at medium effort fits.

## Acceptance criteria

- [x] The library entity editor shows Overview, Profile, Descriptions, and Placeholders. The World Editor entity panel shows Profile, Descriptions, and Placeholders.
- [x] Each field sits in the same tab in both editors. The field bodies stay shared, so one change to a field reaches both.
- [x] Overview holds publish information only, and stays out of the World Editor.
- [x] The library editor opens on the entity's own content, not on Overview, as it does today.
- [x] The dev-router reaches every tab of both editors in one call, and the drift-guard test passes.
- [x] The World Editor's find bar still lands on the correct tab for an entity field. The field-to-tab map is shared with the library editor. The library editor has no find bar, and this ticket adds none.
- [x] Both editors build their tabs from one shared tab list. Simple mode belongs to the World Editor only. The library editor stays outside the mode provider and is always Advanced, so it shows every tab and every field, as it does today.
- [x] Component tests prove both editors render the same tab set apart from Overview. One test is proven by reinstating the old layout and seeing it fail.
- [x] The layout is checked in the preview at a realistic size and at mobile width, with static DOM evidence.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

No data change and no export-shape change. The Openings tab arrives in ticket 04.
