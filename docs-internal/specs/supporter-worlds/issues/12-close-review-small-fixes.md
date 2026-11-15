# 12: Client: Close review small fixes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: two small, independent fixes.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. Library write-back from a Supporter Copy can write into an entry marked for a different source world; it must write only into entries whose source world is the writing world (R9). The end-date dialog from ticket 03 has no dev-route entry, which every modal needs. Formaquestion's AI Context export reads only the open world's marker; like ticket 09's in-game export, it also reads a loaded Supporter save's marker (R24).

## Acceptance criteria

- [ ] Write-back from a Supporter Copy skips an entry marked for another source world.
- [ ] The end-date dialog opens from a dev-route entry.
- [ ] With a Supporter save loaded into a plain world, Formaquestion's AI Context export is disabled with the reason.
- [ ] Each guard is shown to bite by reinstating the bug.
