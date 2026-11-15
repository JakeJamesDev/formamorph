# 13: Client: Keep a plain copy plain

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one branch in the download coordinator's overwrite path.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in the close review. A Supporter download of a listing the player already holds as a plain copy (downloaded while it was public) overwrites that copy and marks it. Under R36, the plain copy stays plain and the Supporter download makes a second world, the Supporter Copy. A later Supporter download overwrites only the Supporter Copy (R29).

## Acceptance criteria

- [x] A Supporter download with only a plain copy present makes a new marked world and leaves the plain copy unmarked and exportable. Test "makes a second, marked world when only a plain copy is held".
- [x] With a Supporter Copy present, the download overwrites it in place. Tests "updates the existing copy in place" and "overwrites the Supporter Copy, not the plain copy".
- [x] Each guard is shown to bite by reinstating the bug. Dropping the `supporterCopy` filter failed both new tests.

## Landed

**Not verified**
- With two or more Supporter Copies of one listing (different accounts), the overwrite picker still lists every copy, plain ones included. Not covered by this ticket. Fixed at the close in 224bbbfd3: the picker lists only Supporter Copies.

**For you**
- Download a world publicly, then as a Supporter: two worlds appear, and the plain one still exports.
