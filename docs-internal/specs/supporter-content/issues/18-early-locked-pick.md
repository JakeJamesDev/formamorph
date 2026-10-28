# 18: Client: a locked Mascot picked during the first check waits for it

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one branch in the locked entry's pick handler, matching the listing button.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

In the Mascot tab, picking a locked Supporter Mascot while the module's first check is still running treats the player as a non-supporter and opens the listing. A Supporter then gets the listing instead of the one-click install (Q21). The listing button already shows **Checking…** in that state; the locked entry should do the same.

## Acceptance criteria

- [ ] While the check is idle or running, the locked entry shows a checking state and a pick does not open the listing.
- [ ] Once the check ends, a Supporter's pick installs and selects, and anyone else's opens the listing.
- [ ] A component test covers the checking state.
