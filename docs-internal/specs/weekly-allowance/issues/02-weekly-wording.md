# 02: Weekly Wording and Local Reset Time

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: copy and one date format across known surfaces; the Writing Guide does the hard part.

**What to build:** everywhere the app and site describe the allowance, it reads as weekly, and the reset shows as a local weekday and time. A Supporter gets one toast per week, at the highest warning threshold.

- [x] Follow the Writing Guide's "Before you write". An allowance reads as a thank-you, never as a plan. Copy written from the user-visible facts; `hostedCopy.test.ts` sales-word guard still green.
- [x] The state reason, usage help line, warning text, site profile, help topics and wiki pages say weekly. A search of those surfaces finds no monthly allowance wording. Grep of `src`, `site`, `docs`, `CONTEXT.md` for monthly/month phrasing: no match. The help topics read from `docs/Connect-Your-Own-AI.md`.
- [x] The reset shows as a local weekday and time in the app and on the site, proven by a test with a fixed time zone. `resetTime.test.ts`, and the `America/Los_Angeles` cases in the allowance, notice and site tests.
- [x] The toast fires only for the highest value in `warnThresholds`, and a lower threshold raises none. Test through the existing notice tests. `hostedNotices.test.tsx` and `pendingWarning` cases.
- [x] The glossary's Formamorph AI and subject entries lose their monthly wording.
- [x] Dev fixtures show a Monday reset, in a frame at `.scratch/frames/02-settings-usage-1440.png` (dark theme). Fixtures hold 2026-11-09T00:00Z; the frame shows it in the preview's local zone.

## Landed

**Not verified**
- The reset line was not checked in a zone east of UTC in the live preview; `resetTime.test.ts` covers `Asia/Tokyo`.

**For you**
- Read the reset line in Settings → Endpoints → Text with Formamorph AI selected, and the exhausted notice: `Resets Sunday at 6:00 PM` (your zone) should read naturally. Frame: `.scratch/weekly-allowance-02/frames/02-settings-usage-1440.png`.
- Admin Server tab: the budget hint reads "Dollars per week" and the Warning Percents info says only the highest percent raises a notice.
