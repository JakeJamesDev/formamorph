# 13: Client: Keep a plain copy plain

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one branch in the download coordinator's overwrite path.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. A Supporter download of a listing the player already holds as a plain copy (downloaded while it was public) overwrites that copy and marks it. Under R36, the plain copy stays plain and the Supporter download makes a second world, the Supporter Copy. A later Supporter download overwrites only the Supporter Copy (R29).

## Acceptance criteria

- [ ] A Supporter download with only a plain copy present makes a new marked world and leaves the plain copy unmarked and exportable.
- [ ] With a Supporter Copy present, the download overwrites it in place.
- [ ] Each guard is shown to bite by reinstating the bug.
