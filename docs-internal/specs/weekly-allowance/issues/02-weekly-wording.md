# 02: Weekly Wording and Local Reset Time

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: copy and one date format across known surfaces; the Writing Guide does the hard part.

**What to build:** everywhere the app and site describe the allowance, it reads as weekly, and the reset shows as a local weekday and time. A Supporter gets one toast per week, at the highest warning threshold.

- [ ] Follow the Writing Guide's "Before you write". An allowance reads as a thank-you, never as a plan.
- [ ] The state reason, usage help line, warning text, site profile, help topics and wiki pages say weekly. A search of those surfaces finds no monthly allowance wording.
- [ ] The reset shows as a local weekday and time in the app and on the site, proven by a test with a fixed time zone.
- [ ] The toast fires only for the highest value in `warnThresholds`, and a lower threshold raises none. Test through the existing notice tests.
- [ ] The glossary's Formamorph AI and subject entries lose their monthly wording.
- [ ] Dev fixtures show a Monday reset, in a frame at `.scratch/frames/02-settings-usage-1440.png` (dark theme).
