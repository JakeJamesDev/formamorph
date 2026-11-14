# 02: Server: Supporter worlds on the gated route

Status: ready-for-agent
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: processing already walks world JSON; the work is a validation rule, route tests and one measurement.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The gated route serves a Supporter-only world with every embedded image watermarked and scrambled, and with audio, Avatars and 3D models passed through unchanged (R8). Creating, updating, or flagging a Supporter-only world refuses one that holds a linked `http(s)` image, and the refusal names where each one sits (R11). The ticket measures the cold processing time of a large world and reports it to the user, who sets the budget.

## Acceptance criteria

- [ ] The gated route serves a world fixture with each embedded image replaced by a processed image object, and every non-image data URL byte-equal to the source.
- [ ] Create, update and flag each refuse a Supporter-only world with a linked image and name each location; the same world without the flag is accepted.
- [ ] The cold processing time of a large world (bundled-world size or larger) is measured and stated in the landing, with the world's size and image count.
- [ ] The dependency routes serve a Supporter-only world's public required sources and add-ons, and refuse a Supporter-only dependency (R30; found in ticket 06's landing).
- [ ] Each guard is shown to bite by reinstating the bug.

For you: set the processing-time budget from the measured number.
