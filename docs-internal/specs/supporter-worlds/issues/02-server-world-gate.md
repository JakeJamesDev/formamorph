# 02: Server: Supporter worlds on the gated route

Status: ready-for-human
Base: 8abd888
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

- [x] The gated route serves a world fixture with each embedded image replaced by a processed image object, and every non-image data URL byte-equal to the source. (`tests/supporterWorld.test.js` "replaces every embedded image…": thumbnail, map, entity, location, backdrop and dictionary images; audio, Avatar and 3D model byte-equal)
- [x] Create, update and flag each refuse a Supporter-only world with a linked image and name each location; the same world without the flag is accepted. (the three "refusing a linked image" tests)
- [x] The cold processing time of a large world (bundled-world size or larger) is measured and stated in the landing, with the world's size and image count. (see Landed)
- [x] The dependency routes serve a Supporter-only world's public required sources and add-ons, and refuse a Supporter-only dependency (R30; found in ticket 06's landing). (the two "dependency routes (R30)" tests)
- [x] Each guard is shown to bite by reinstating the bug. (five mutations: each refusal, the dependency 403, array processing, and the dependency route's world lookup; each turned its test red)

For you: set the processing-time budget from the measured number.

## Landed

**Measured.** Cold gated response for `rampage.json` (largest bundled world): 61.5 MB, 42 embedded images, 7.6 s on a 32-thread i9-13900K. A cached repeat took 1.25 s. The response was 166 MB, because processed images are lossless PNG.

**Not verified**
- The 7.6 s figure comes from a fast 32-thread machine. The production Hetzner server was not measured.
- A held (pending-review) update that links an image is checked at submit only. A flag set later does not re-check a pending update's content.

**For you**
- Set the processing-time budget from the 7.6 s cold figure (`rampage.json`).
- Decide whether the 166 MB response size is acceptable for a Supporter world download.
- The gated route and the dependency routes needed no code change: they already behaved as the ticket asks. This ticket adds `src/utils/linkedImages.js`, the refusal on create, update and flag, and tests. Ticket 01 owns the end-date helper.
