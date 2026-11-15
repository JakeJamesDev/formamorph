# 06: Client: Download a Supporter world

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: joins the existing gated fetch and unscramble to the world store; the image walk mirrors the server's.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

`world` joins the kinds a Supporter-only listing can download (base Q40). For a qualifying account, the listing's button fetches the gated route, turns each processed image object back into a lossless PNG data URL through the existing unscramble, and stores the world through the normal world store with `sourceId` tracking and ticket 04's marker (R5). The world shows in the Worlds list and plays and edits like any world. A new revision shows Update Available, and updating re-fetches through the gated route (R10).

## Acceptance criteria

- [x] A qualifying account downloads a fixture Supporter-only world; the stored world has plain data-URL images equal to the unscrambled source, untouched non-image media, and the marker. (`useDownloadCoordinator.supporter.test.tsx` stores plain images, media and marker; a canvas round trip in the preview matched pixel for pixel)
- [x] A non-qualifying or signed-out account sees the existing Patreon or Sign In button. (`SupporterListingButton.test.tsx`)
- [x] A higher revision shows Update Available; updating fetches the gated route and keeps the marker. (button reads `update`; the coordinator test overwrites in place with the new revision)
- [x] A Mascot listing still installs as before. (the existing install tests pass unchanged)
- [x] Each guard is shown to bite by reinstating the bug. (marker, downscale skip, dependency skip, narrowing to Supporter worlds, in-place overwrite, gated route, world button branch)

## Landed

**Not verified**
- A real download against the server. Only mocked fetches ran.
- The update review with a Supporter-only dependency: the review still lists its row, and whether the old copy is kept for it is not tested.
- The skip toast does not show when a first download stops on a required-source failure before the world is stored.
- Whether the dependency routes serve a Supporter world's public sources, checked against the server.

**For you**
- Download a Supporter-only world on a qualifying account and play it. Look at the Worlds list for the Supporter badge.
- Update a Supporter Copy after a revision bump. Look for one world, not two.
