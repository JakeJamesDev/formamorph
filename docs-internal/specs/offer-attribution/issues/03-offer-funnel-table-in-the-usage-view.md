# 03: Offer Funnel Table in the Usage View

Status: ready-for-human
Blocked by: 02 — Send Funnel Steps per Source
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one staff table built from an existing list and the existing rate helper, plus design-system fit.

**What to build:** the staff Usage view shows the offer funnel as a table, one row per source, so each offer's conversion reads at a glance (Q11). Counts from older builds get their own row (Q6).

- [x] Rows are the five sources in the order setup, demo, engine, notice, locked, then Older Builds. Columns are Shown, See Levels, Patreon and Checklist. (UsageTab.test "shows one offer row per source…")
- [x] Each count after the first shows its rate to the step before it in that row. A cell with no valid step, or a rate over a zero or missing base, shows the empty value. (Same test; a zero base reads `0 (—)`, the count stays, the rate is empty. Guard proven by breaking the valid-step check: the test went red.)
- [x] The Older Builds row reads `offer_shown`, `see_levels`, `patreon_click` and `checklist_finished` into the matching columns. (UsageTab.test "reads the source-less step names…")
- [x] The table groups rows by the source and step list from ticket 02, never by a second hand-kept list. (`funnelRows` reads `FUNNEL_SOURCES` and `FUNNEL_SOURCE_STAGES`.)
- [x] The dev usage sample produces the new names, so the dev-router Usage tab shows a filled table. (DOM read of the filled table in the Design System showcase.)
- [x] Frames of the Usage tab in light and dark at 1280 px wide: `.scratch/frames/offer-funnel-light.png`, `.scratch/frames/offer-funnel-dark.png`. (Viewport 1280 px; the stored PNGs are the 800 px screenshot scale.)

## Landed

**Not verified**
- The real Admin Panel Usage tab: it needs an admin session. The table was read in the Design System showcase, which mounts the same `UsagePanel` over the dev sample.

**For you**
- Read the table in the Usage tab's Clients And Offer section: `.scratch/offer-attribution-03/frames/offer-funnel-light.png`, `.scratch/offer-attribution-03/frames/offer-funnel-dark.png`.
- Spec gap settled in the build: the ticket's "a rate over a zero base shows the empty value" reads as `0 (—)` (the count stays). Say so if you want the whole cell empty.
