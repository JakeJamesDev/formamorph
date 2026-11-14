# 06: Client: Download a Supporter world

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: joins the existing gated fetch and unscramble to the world store; the image walk mirrors the server's.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

`world` joins the kinds a Supporter-only listing can download (base Q40). For a qualifying account, the listing's button fetches the gated route, turns each processed image object back into a lossless PNG data URL through the existing unscramble, and stores the world through the normal world store with `sourceId` tracking and ticket 04's marker (R5). The world shows in the Worlds list and plays and edits like any world. A new revision shows Update Available, and updating re-fetches through the gated route (R10).

## Acceptance criteria

- [ ] A qualifying account downloads a fixture Supporter-only world; the stored world has plain data-URL images equal to the unscrambled source, untouched non-image media, and the marker.
- [ ] A non-qualifying or signed-out account sees the existing Patreon or Sign In button.
- [ ] A higher revision shows Update Available; updating fetches the gated route and keeps the marker.
- [ ] A Mascot listing still installs as before.
- [ ] Each guard is shown to bite by reinstating the bug.
