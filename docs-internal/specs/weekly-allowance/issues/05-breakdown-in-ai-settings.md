# 05: Breakdown in AI Settings

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a pure rollup module with thorough cases and one display component.

**What to build:** a Supporter opens AI settings and reads where this week's use went: seven groups by percent, with any single prompt at or above the threshold named under its group. This ticket owns the rollup module and the shared breakdown component that ticket 06 reuses.

- [x] The hosted state client reads `breakdown` and `breakdownThreshold`, and an unknown shape doesn't break the usage display. (`hostedState.breakdown.test.ts`, 8 malformed shapes)
- [x] The rollup maps every prompt type to the spec's groups. A test fails when `AIRequestType` gains a type with no group. (`holds every prompt type in exactly one group`, over the keys of the total `REQUEST_STATUS` record; bites when `storyboard` leaves its group)
- [x] Tests cover both sides of the threshold, no nested row in a one-prompt group, largest-remainder totals of 100, an Other row only above zero, and an empty breakdown. (`breakdownRollup.test.ts`; bites with `>=` changed to `>`)
- [x] Nested rows use the prompt's AI settings name. The editor types get their own names, following the Writing Guide. (`breakdownPromptLabel`)
- [x] Final group labels follow the Writing Guide, and the glossary lists any new term. ("Story Planning" per the spec session; **Usage breakdown** in `CONTEXT.md`)
- [x] Zero-share groups still show, and an empty state shows when nothing is spent this week. (`HostedBreakdown.test.tsx`)
- [x] AI settings shows the component, with a dev fixture and frames at `.scratch/frames/05-breakdown-1440-dark.png` and `.scratch/frames/05-breakdown-1440-light.png`. (`fixture=fai-ready`; DOM read and frames)
- [x] A changelog fragment covers the breakdown.

## Landed

**Not verified**
- A live server answer: the breakdown was checked against the dev fixture and parser tests only, since ticket 03's server was not run here.

**For you**
- Read the empty-state line "Nothing used yet this week" and the group names in AI settings (Settings → Endpoints → Text → Formamorph AI).
- The bar under each group is plain markup, not a Design System component. Say if it needs the pattern approval.
