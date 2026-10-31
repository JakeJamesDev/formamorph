# 03: Donation Copy Sweep

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a copy sweep across known files; the new wording goes to the user.

**What to build:** every player-facing line about support, tiers or the Formamorph AI allowance reads as a donation (spec Q3). Blocked by 02 because both edit the same files.

Known lines: the **Upgrade** label in `src/lib/hostedAi/hostedCopy.ts`, "Upgrade on Patreon" and the **Tier** row in `site/components/AllowanceSection.tsx`, and **Upgrade** in `docs/Connect-Your-Own-AI.md`. Sweep the rest of the app, the site and `docs/` with the `copy-sweep` skill.

- [x] A list of every changed line, old and new, goes to the user, who approves it before it lands. Sent in the session; the user chose "Approve all".
- [x] No player-facing line calls support a plan, a purchase, a subscription or an upgrade. `hostedCopy.test.ts` pins every preset state; a sweep of `src/`, `site/`, `hosting/` and `docs/` found no other player-facing hit.
- [x] The changelog and wiki follow the new wording. `docs/Connect-Your-Own-AI.md` and a changelog fragment.

## Landed

**Not verified**
- Two unreleased changelog lines still say "tier" ("Your Supporter tier sets the context window", "It shows your tier"): prepare refuses a direct edit, and the new fragment covers the wording.

**For you**
- Left unchanged on purpose: the staff-only Formamorph AI admin panel ("Tier" labels), "current tier" on the privacy page, "Become a Supporter" links, "pledge" in `docs/Formaquestion.md`. Say if any should change.
- Drive-by: the exhausted line on the account page now ends "allowance" (the noun was missing).
