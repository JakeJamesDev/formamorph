# 03: Client: Timed listing display and admin controls

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extends an existing dialog switch and listing button with a duration field and a label.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

The admin Supporter-Only switch in the Publish dialog shows for a new Mascot or World listing, with an optional duration in days and the resulting end date under it (R13). Everyone sees "Supporter-only until <date>" on the card and in the details window while a timed listing is Supporter-only (R3). An admin can change or clear the end date from the card and the details window. An expired listing shows the normal Download (R1). Copy follows the Writing Guide.

## Acceptance criteria

- [x] The switch and duration field show to an admin for a new Mascot or World listing only; the publish body carries the duration. (`PublishModal.supporter.test.tsx`: switch and days for mascot and world, absent for dictionary, mod, normal and updates; body carries `supporterDays`; mutation of the send turned two tests red)
- [x] The card and details show the end date for a timed listing, and nothing extra for an untimed one. (`RemoteWorldCard.supporterEnd.test.tsx`, `RemoteWorldDetailsModal.supporterOnly.test.tsx`)
- [x] An admin can change and clear the end date from the card and the details window; a non-admin sees no control. (Control tests on both surfaces. The dialog's save and clear calls are not tested; see Not verified)
- [x] A listing whose payload has no Supporter-only flag shows the normal Download. (`RemoteWorldCard.supporterEnd.test.tsx`)
- [ ] Frames `.scratch/frames/publish-timed.png` and `.scratch/frames/listing-timed.png`, light and dark, at a desktop width.

## Landed

**Not verified**

- Frames `publish-timed.png` and `listing-timed.png`, light and dark: not captured. The dev fixtures served no Supporter-only catalog, and patching it in the page failed twice.
- The end-date dialog (`SupporterEndDateDialog.tsx`) has no test of its save and clear calls and no `devRoutes.ts` entry. It needs a listing and an admin session.
- The new service call `setRemoteWorldSupporterEnd` is checked against the server's route by reading, not by a live request.

**For you**

- Open the Publish dialog as an admin for a new Mascot and a new World: turn on Supporter-Only, type days, check the date line under the field.
- Open a timed listing's card and details: check the "Supporter-only until" chip, and the calendar button on the card and End Date in the details window.
- Turning on Supporter-Only turns the contest entry off, and the reverse. The server refuses the pair.
