# 03: Client: Timed listing display and admin controls

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extends an existing dialog switch and listing button with a duration field and a label.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The admin Supporter-Only switch in the Publish dialog shows for a new Mascot or World listing, with an optional duration in days and the resulting end date under it (R13). Everyone sees "Supporter-only until <date>" on the card and in the details window while a timed listing is Supporter-only (R3). An admin can change or clear the end date from the card and the details window. An expired listing shows the normal Download (R1). Copy follows the Writing Guide.

## Acceptance criteria

- [ ] The switch and duration field show to an admin for a new Mascot or World listing only; the publish body carries the duration.
- [ ] The card and details show the end date for a timed listing, and nothing extra for an untimed one.
- [ ] An admin can change and clear the end date from the card and the details window; a non-admin sees no control.
- [ ] A listing whose payload has no Supporter-only flag shows the normal Download.
- [ ] Frames `.scratch/frames/publish-timed.png` and `.scratch/frames/listing-timed.png`, light and dark, at a desktop width.
