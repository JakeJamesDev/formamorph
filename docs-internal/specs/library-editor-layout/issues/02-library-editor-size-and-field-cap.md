# 02: Library Editor Size and Field Cap

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** Both library editors open at the same size: 95% of the viewport wide, to a maximum of 1400px, at the height they have today. Form content keeps a readable width inside the wide modal, and the Placeholders tab uses all of it.

**Rationale for the model:** two class changes, one shared cap, and one Playwright spec with clear prior art. A mid-size model at medium effort.

## Acceptance criteria

- [ ] Both library editor modals use 95vw with a 1400px maximum. Height stays 85dvh.
- [ ] One shared field-column cap, near 800px, applies to the entity field tabs, the dictionary entry panel, and the dictionary Overview. Capped content sits at the left of its pane.
- [ ] The Placeholders tab has no cap, and its two panes share the full width.
- [ ] The shared list-detail split stays 50/50.
- [ ] A new Playwright spec beside the entity panel widths spec checks 375, 820, 1280, 1600, and 2560: the modal width, the field column at or under the cap, no horizontal overflow, and the Placeholders panes sharing the width.
- [ ] The UI is checked through the dev router with static frames at a realistic viewport size.
- [ ] All four gates pass, the new Playwright spec passes, and `graphify update .` has run.
