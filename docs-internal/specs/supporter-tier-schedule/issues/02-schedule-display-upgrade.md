# 02: Client: Tier schedule display and upgrade prompt

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extend one pure rule, one mark component and one button state, using existing test prior art.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

Everyone sees a listing's full schedule on the card and in the details window: each tier's opening date and the public date, under the tier display names (Q2). A listing with no tier rows still reads as today. A Supporter whose tier hasn't opened sees an upgrade state that opens the same Patreon page as today's Patreon state (Q7). Once their tier opens, the normal Supporter download state shows. A Supporter who downgrades below the open tier keeps their Supporter Copy, and a full lapse still removes it (Q1). This ticket owns the client's schedule type and its parsing of the catalog and entitlement payloads. Ticket 03 imports it.

## Acceptance criteria

- [x] The listing-action rule returns the upgrade state for a qualifying account below the open tier, the Patreon state for a non-qualifying account, and the download state once the tier opens. (supporterSchedule.test.ts "the listing action"; guard proven by flipping the rank comparison)
- [x] The button's upgrade state opens the Patreon page. (SupporterListingButton.test.tsx "reads Upgrade below the open tier")
- [x] A server refusal for a tier that isn't open yet shows the tier display name and date from `requiredTier` and `opensAt`, never the server's raw `error` text, which names tier keys. (supporterContent.test.ts "reports a tier that is not open yet")
- [x] A schedule entry with a null `opensAt` and no public date reads as "not scheduled". With a public date, it reads as that date. (supporterSchedule.test.ts "the schedule stages")
- [x] The schedule mark shows each tier's date and the public date. A listing with only a public date reads as today's mark. (RemoteWorldCard.supporterEnd.test.tsx; the top tier reads "Open now" per the spec session)
- [x] The sync test: an account that downgrades below the open tier keeps its Supporter Copy, and a full lapse removes it. (supporterCopySync.test.ts)
- [x] Copy passes the Writing Guide (`copy-sweep` skill). (`npm run copy:sweep` reports nothing on the new copy)
- [x] Frames of the card and details window with a three-stage schedule, light and dark, at 1280 wide: `.scratch/frames/schedule-card-light.png`, `.scratch/frames/schedule-card-dark.png`, `.scratch/frames/schedule-details-light.png`, `.scratch/frames/schedule-details-dark.png`. (dev route `supporterSchedule`; the pane's screenshots are JPEG data saved under .png names, and the details frames crop the right edge)
- [x] A changelog fragment in `docs-internal/changelog.d/`.

For you: the upgrade prompt's wording on a Supporter-only card in Community Creations.

## Landed

**Not verified**
- The Upgrade button on a live card with a real Supporter account: tests and the dev frames use a stubbed store, and the frames show the Patreon state for the sample reader.

**For you**
- The upgrade prompt's wording on a Supporter-only card in Community Creations: the "Upgrade" label and its tip ("Your tier can't get this yet. Upgrade on Patreon to get it now").
- The refusal text a player sees on a download below the open tier: "This listing is open to the <tier> tier now. It opens to your tier on <date>."
- A world the account already holds a current copy of keeps its Re-download button below the open tier; a refused Re-download shows the refusal text above.
