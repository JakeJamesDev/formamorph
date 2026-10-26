# 17: Ship-Time Downscale

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q13, Q22, Q23; Implementation Decisions › Encoding, Ship-time re-encode)

## What to build

The bundled world files in the repo hold lossless art, and every build that exists today ships them smaller. A player who installs the web app, the Android app or the desktop app gets each bundled world with its images re-encoded through the editor's Downscale, and nothing else about the world changes.

- A build step reads each bundled world from its source file, re-encodes every image with the editor's Downscale settings, and emits the shipped copy the app bundles. The source files are never modified. The step runs for the web, Android and desktop builds, and has a switch that skips it for a future Steam build.
- The bundled fingerprints know both forms. The seeder recognizes a stored world whether it came from a shipped copy or a source file, and the publish check treats both as bundled. The fingerprint command records the shipped form next to the source form for every revision.
- The shared suite and the world probe keep reading the source files. A test proves the shipped copy of a world loads through the seeder, keeps every id, rule and non-image field byte for byte, and only its image bytes differ.
- The dev server serves the source files, so an author who opens the editor sees the lossless art.
- Report the shipped size per world and in total next to the source size, in this ticket's comments.

## Acceptance criteria

- [ ] A production web build bundles the downscaled copies, and a test shows a shipped world equals its source outside the image bytes.
- [ ] The seeder accepts both forms: a test seeds a world from the shipped copy and from the source file and finds the same fingerprint match for each.
- [ ] The step is shown to be skipped by its switch, with the source files bundled instead.
- [ ] The Android and desktop builds take the same shipped copies, shown by their build output.
- [ ] Shipped and source sizes per world are in this ticket's comments.
