# 11: Client: Installed Mascot after its listing expires

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extends ticket 07's expired-list rule to the Mascot sync.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in ticket 07's landing. A good check still removes an installed Supporter Mascot once its listing expires, though the listing is now public. Under R1 and R4, the Mascot sync keeps an installed Mascot whose listing is in the expired list.

## Acceptance criteria

- [ ] A good check that lists the Mascot's listing as expired keeps the installed Mascot.
- [ ] A listing in neither list is removed as before.
- [ ] Each guard is shown to bite by reinstating the bug.
