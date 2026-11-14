# 07: Client: Supporter Copy sync

Status: ready-for-agent
Blocked by: 01, 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a new step in the existing check, with injected fetch and clock and well-defined rules.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The Supporter content module's check gains a world step beside the Mascot sync. On a good check that says the account doesn't qualify, it removes every Supporter Copy of that account, worlds and library entries, and keeps saves (R6, R12). On a good check that qualifies, it keeps copies whose listing is current or expired (ticket 01's list) and removes the rest (R4). Base Q39's account rules apply: another account's Supporter Copies are not shown while it is signed in, and that account's first good check removes them. Base Q6's 7-day offline window applies.

## Acceptance criteria

- [ ] A check that says the account doesn't qualify removes every Supporter Copy world and library entry of that account; its saves remain.
- [ ] A qualifying check keeps copies of current and expired listings and removes a copy whose listing is in neither list.
- [ ] Another account's copies are hidden while it is signed in and removed on that account's first good check.
- [ ] Copies stay through failed checks inside 7 days and are removed after.
- [ ] Each guard is shown to bite by reinstating the bug.
