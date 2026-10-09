# 05: Full Wide Cut

Status: ready-for-human
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: assembly of approved scenes against a settled storyboard; the hard part is timing, which the studio shows.

Parent: [Trailer spec](../spec.md)

## What to build

The Steam trailer, assembled from the storyboard with the scene library and the captured frames.

- 1920x1080, 60 fps, H.264 in MP4, bitrate at or above 5,000 Kbps.
- Under 90 seconds. The first 6 seconds loop cleanly.
- A poster frame is exported as a 1920x1080 PNG from the video.
- The render command for this cut is documented in the package README.

## Acceptance criteria

- [ ] The wide cut renders from one command at 1920x1080, 60 fps, under 90 s.
- [ ] The encode meets the Steam spec recorded in the spec.
- [ ] The first 6 seconds read as a loop.
- [ ] A poster frame PNG is exported.
