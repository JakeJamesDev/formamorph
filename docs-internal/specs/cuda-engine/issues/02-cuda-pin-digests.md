# 02: CUDA Pin Digests

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: script and build plumbing with clear inputs; the trap is CI and packaging, not logic.

## What to build

The llama.cpp pin learns the CUDA assets. A new pin-bump command, run by hand, writes the tag plus the name and SHA-256 digest of the two CUDA 13.4 assets. It reads the `digest` field from the GitHub release API. The build gate checks that the pinned release has both assets and that their digests match the pin, and fails with a clear message otherwise. The packaged app carries the tag, the asset names, the digests, and the plain release-download URLs, because the pin file is not packaged today. The app never calls the GitHub API at runtime. See the spec, "The pin".

Developer-only, so the changelog fragment goes under 🛠️ if one is warranted.

## Acceptance criteria

- [ ] The pin-bump command writes the tag and both CUDA asset names and digests, and refuses a tag whose release lacks either asset.
- [ ] The build gate fails when a CUDA asset is missing from the pinned release, or when a digest differs from the pin. Tests drive both cases with an injected fetch.
- [ ] Main-process code can read the tag, the asset names, the digests and the download URLs in a packaged build and in a dev run.
- [ ] No runtime code path calls `api.github.com`.
- [ ] The existing bundled-build fetch keeps working from the same pin.
