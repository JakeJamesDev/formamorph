# 01: Bundle Pinned llama-server

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: build plumbing against a known release layout, no product logic.

## What to build

The app build carries `llama-server` for every desktop platform (spec: Binaries; Q2, Q10, Q14, Q18). One pinned llama.cpp build tag names the version. A fetch step downloads exactly that tag's release assets: Windows Vulkan x64 (it carries the CPU backends), macOS arm64 and x64, and Linux Vulkan + CPU. It unpacks them into a per-platform folder that the packager ships unpacked. No CUDA. A rerun with the same tag downloads nothing.

The `release` skill gains a step: check for a newer llama.cpp build, and bump the pin when there is one. Each bump is followed by re-recording the fixtures (ticket 02) and the load matrix (ticket 09).

This ticket only ships the files. The engine still runs node-llama-cpp until ticket 02.

## Acceptance criteria

- [ ] The fetch step downloads the pinned tag's assets for all three platforms and refuses an unknown tag with a clear error.
- [ ] A second run with the same tag downloads nothing.
- [ ] A packaged Windows build contains `llama-server` and its backend DLLs outside the asar archive.
- [ ] A test checks the asset-name mapping per platform against the pinned tag's real asset list.
- [ ] The `release` skill has the check-and-bump step, and it names the follow-up checks.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.
