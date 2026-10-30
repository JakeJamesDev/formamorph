# 10: Allowance on the Profile Page

Status: ready-for-agent
Blocked by: 02, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one read-only panel on an existing site page, with a known bundle-boundary rule.

**What to build:** a signed-in Supporter opens their account page on formamorph.ai and sees their hosted tier, percent used, about-turns-left and the reset date. A non-Supporter sees a short line about Formamorph AI with the Patreon link.

- [ ] The account page shows the hosted state for an entitled account and the Patreon line otherwise.
- [ ] The hosted-state service joins the site bundle boundary's allowed list, and the boundary test passes with no game code pulled in.
- [ ] Component tests cover entitled, not entitled and fetch failure.
- [ ] Frames in both themes at mobile and desktop width: `.scratch/frames/site-allowance-light-desktop.png`, `.scratch/frames/site-allowance-dark-mobile.png`.
