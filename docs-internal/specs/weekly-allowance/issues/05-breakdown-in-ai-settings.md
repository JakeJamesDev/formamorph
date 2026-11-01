# 05: Breakdown in AI Settings

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a pure rollup module with thorough cases and one display component.

**What to build:** a Supporter opens AI settings and reads where this week's use went: seven groups by percent, with any single prompt at or above the threshold named under its group. This ticket owns the rollup module and the shared breakdown component that ticket 06 reuses.

- [ ] The hosted state client reads `breakdown` and `breakdownThreshold`, and an unknown shape doesn't break the usage display.
- [ ] The rollup maps every prompt type to the spec's groups. A test fails when `AIRequestType` gains a type with no group.
- [ ] Tests cover both sides of the threshold, no nested row in a one-prompt group, largest-remainder totals of 100, an Other row only above zero, and an empty breakdown.
- [ ] Nested rows use the prompt's AI settings name. The editor types get their own names, following the Writing Guide.
- [ ] Final group labels follow the Writing Guide, and the glossary lists any new term.
- [ ] Zero-share groups still show, and an empty state shows when nothing is spent this week.
- [ ] AI settings shows the component, with a dev fixture and frames at `.scratch/frames/05-breakdown-1440-dark.png` and `.scratch/frames/05-breakdown-1440-light.png`.
- [ ] A changelog fragment covers the breakdown.
