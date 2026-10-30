# 10: Allowance on the Profile Page

Status: ready-for-human
Blocked by: 02, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one read-only panel on an existing site page, with a known bundle-boundary rule.

**What to build:** a signed-in Supporter opens their account page on formamorph.ai and sees their hosted tier, percent used, about-turns-left and the reset date. A non-Supporter sees a short line about Formamorph AI with the Patreon link.

- [x] The account page shows the hosted state for an entitled account and the Patreon line otherwise. (AllowanceSection tests: entitled, locked, exhausted, paused, age-gate; the account page test)
- [x] The hosted-state service joins the site bundle boundary's allowed list, and the boundary test passes with no game code pulled in. (bundleBoundary.test.ts green; ceiling 70 → 71)
- [x] Component tests cover entitled, not entitled and fetch failure. (AllowanceSection.test.tsx, four failure shapes)
- [x] Frames in both themes at mobile and desktop width: `.scratch/frames/site-allowance-light-desktop.png`, `.scratch/frames/site-allowance-dark-mobile.png`. (two frames, from the site dev server with the state route stubbed)

## Landed

**Not verified**
- Dark desktop and light mobile frames: the ticket names only the two above.
- Against the real server: the browser frames stub `GET /hosted-ai/state`. The tests use fixtures of the README's contract.

**For you**
- Open `/account` as a Supporter on formamorph.ai after the server deploy. Check the Formamorph AI section reads right.
- Copy for the exhausted state and the locked line (spec session ruled the exhausted state also links Patreon).
