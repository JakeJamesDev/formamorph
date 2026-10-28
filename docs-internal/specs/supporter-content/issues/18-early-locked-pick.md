# 18: Client: a locked Mascot picked during the first check waits for it

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Model rationale: one branch in the locked entry's pick handler, matching the listing button.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

In the Mascot tab, picking a locked Supporter Mascot while the module's first check is still running treats the player as a non-supporter and opens the listing. A Supporter then gets the listing instead of the one-click install (Q21). The listing button already shows **Checking…** in that state; the locked entry should do the same.

## Acceptance criteria

- [x] While the check is idle or running, the locked entry shows a checking state and a pick does not open the listing. (Disabled "Nova (Checking…)" option; `it.each` idle/checking test.)
- [x] Once the check ends, a Supporter's pick installs and selects, and anyone else's opens the listing. (Same test installs after ready; the existing non-Supporter listing test still passes.)
- [x] A component test covers the checking state. (`FormaquestionMascotTab.supporter.test.tsx`, 10 pass.)

## Landed

**Not verified**
- None. Only the supporter test file ran; prepare runs the full gates.

**For you**
- Open the Preset list in Formaquestion Settings > Mascot right after sign-in: a locked Supporter Mascot should read "Checking…" and be greyed out, then "Locked".
