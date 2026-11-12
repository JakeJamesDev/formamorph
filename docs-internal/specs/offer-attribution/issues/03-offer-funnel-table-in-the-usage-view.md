# 03: Offer Funnel Table in the Usage View

Status: ready-for-agent
Blocked by: 02 — Send Funnel Steps per Source
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one staff table built from an existing list and the existing rate helper, plus design-system fit.

**What to build:** the staff Usage view shows the offer funnel as a table, one row per source, so each offer's conversion reads at a glance (Q11). Counts from older builds get their own row (Q6).

- [ ] Rows are the five sources in the order setup, demo, engine, notice, locked, then Older Builds. Columns are Shown, See Levels, Patreon and Checklist.
- [ ] Each count after the first shows its rate to the step before it in that row. A cell with no valid step, or a rate over a zero or missing base, shows the empty value.
- [ ] The Older Builds row reads `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished` into the matching columns.
- [ ] The table groups rows by the source and step list from ticket 02, never by a second hand-kept list.
- [ ] The dev usage sample produces the new names, so the dev-router Usage tab shows a filled table.
- [ ] Frames of the Usage tab in light and dark at 1280 px wide: `.scratch/frames/offer-funnel-light.png`, `.scratch/frames/offer-funnel-dark.png`.
