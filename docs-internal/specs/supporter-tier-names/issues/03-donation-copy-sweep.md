# 03: Donation Copy Sweep

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a copy sweep across known files; the new wording goes to the user.

**What to build:** every player-facing line about support, tiers or the Formamorph AI allowance reads as a donation (spec Q3). Blocked by 02 because both edit the same files.

Known lines: the **Upgrade** label in `src/lib/hostedAi/hostedCopy.ts`, "Upgrade on Patreon" and the **Tier** row in `site/components/AllowanceSection.tsx`, and **Upgrade** in `docs/Connect-Your-Own-AI.md`. Sweep the rest of the app, the site and `docs/` with the `copy-sweep` skill.

- [ ] A list of every changed line, old and new, goes to the user, who approves it before it lands.
- [ ] No player-facing line calls support a plan, a purchase, a subscription or an upgrade.
- [ ] The changelog and wiki follow the new wording.
