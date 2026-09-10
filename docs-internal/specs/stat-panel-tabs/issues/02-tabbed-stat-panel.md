# 02: Tabbed Stat Panel

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The main build: layout, the one-tab rule, persistence, Find and Bench landing, dev-router, tests, changelog, and the mobile form with the guide extension on approval.

## What to build

Selecting a stat in the World Editor shows the shared Panel Tab Strip with Details, Descriptors, and Code in Advanced mode, under the placeholder palette bar.

Details, at `sm` and wider: Name and Type on one row, the name taking the flexible width and the type select a fixed width of about eleven rem; Description; Min, Max, Initial Value, Regen as one row of four; Body Sliders with its help line and picker; then, in Advanced mode, Availability as an Enabled and Hidden pair with one help line that carries both meanings, then Prevent AI Changes unchanged. Below `sm` the name row stacks and the range row drops to two columns. Descriptors holds the Stat Descriptors section whole. Code holds the Dynamic Value Calculation section whole. A Percentage stat shows the same tabs with its pinned range.

Simple mode leaves one tab, so no strip renders and the Details body shows bare: Name, Type, Description, the range, Body Sliders. The prototype's shape for that rule:

```tsx
const shown = tabs.filter((t) => advanced || !t.advancedOnly);
if (shown.length === 1) return <div className="space-y-4">{panels[shown[0].value]}</div>;
```

The chosen tab survives selecting another stat for the life of the editor session and is held by the editor in the same slot shape as the entity and location panels; when the chosen tab is unavailable the panel shows Details. A Find hit opens the owning tab before the reveal timer runs: `name` and `description` open Details, `descriptors[n].description` opens Descriptors, through the helper and guard from ticket 01. Bench findings pass no hint and land on the persisted tab. The dev-router gains a `subtab` ledger entry for `details`, `descriptors`, `code`.

The winning prototype is `?variant=S3` at commit `9b0bb422` on branch `prototype/stat-panel` (launch entry `proto-stat-panel`, port 5193); run it beside the build to compare. Desktop is approved through it. Show the mobile form at 375px in context with static evidence and ask for approval; on approval, extend the Panel Tab Strip guide entry and showcase with the stat composition and the one-tab rule.

## Acceptance criteria

- [ ] Advanced: three tabs. Details shows Name, Type, Description, Min, Max, Initial Value, Regen, Body Sliders, Enabled, Hidden, and the four Prevent AI Changes boxes and nothing else. Descriptors shows the Stat Descriptors label, the unit toggle, and the band rows. Code shows the Dynamic Value Calculation heading, Templates, the code field, and Test Code.
- [ ] Simple: no strip. Name, Type, Description, the range, and Body Sliders; no Enabled, Hidden, Prevent AI Changes, descriptors, or code.
- [ ] Availability's two paragraphs are one help line.
- [ ] The tab persists across selecting another stat; on Code, switching to Simple lands on Details with no strip, and switching back restores the strip on Details.
- [ ] Percentage stat: same three tabs; Min and Max read 0 and 100 and are disabled.
- [ ] A Find hit in a descriptor from Details opens Descriptors and rings the field; a hit in Description from Code opens Details.
- [ ] Bench Open on a stat finding lands on the stat with the persisted tab.
- [ ] The dev-router `subtab` ledger covers `details`, `descriptors`, `code`, and the drift test passes.
- [ ] The existing stat manager suites, including the code tests, pass inside their tabs.
- [ ] World Editor bench-harness tests cover every criterion above.
- [ ] Changelog: one 👤 entry in the In-Progress bucket.
- [ ] Desktop verified in the preview against the prototype at 1600x900; no export-shape change.
- [ ] Mobile evidence at 375px presented and approval recorded in the spec's Comments; guide entry and showcase extended together after approval.
- [ ] Four gates green; graph updated.

## Blocked by

- 01 — Consolidate The Find-Focus Path
