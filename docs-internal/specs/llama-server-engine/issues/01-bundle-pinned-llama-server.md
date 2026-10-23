# 01: Bundle Pinned llama-server

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: build plumbing against a known release layout, no product logic.

## What to build

The app build carries `llama-server` for every desktop platform (spec: Binaries; Q2, Q10, Q14, Q18). One pinned llama.cpp build tag names the version. A fetch step downloads exactly that tag's release assets: Windows Vulkan x64 (it carries the CPU backends), macOS arm64 and x64, and Linux Vulkan + CPU. It unpacks them into a per-platform folder that the packager ships unpacked. No CUDA. A rerun with the same tag downloads nothing.

The `release` skill gains a step: check for a newer llama.cpp build, and bump the pin when there is one. Each bump is followed by re-recording the fixtures (ticket 02) and the load matrix (ticket 09).

This ticket only ships the files. The engine still runs node-llama-cpp until ticket 02.

## Acceptance criteria

- [x] The fetch step downloads the pinned tag's assets for all three platforms and refuses an unknown tag with a clear error. Real run fetched all five builds; the unknown-tag test passes.
- [x] A second run with the same tag downloads nothing. Real rerun said "up to date" in 0.07 s; a test counts downloads.
- [x] A packaged Windows build contains `llama-server` and its backend DLLs outside the asar archive. `npm run desktop:build`, then read `release/win-unpacked/resources/llama-server/win-x64-vulkan`.
- [x] A test checks the asset-name mapping per platform against the pinned tag's real asset list. `scripts/fetchLlamaServer.test.mjs` against a recorded list; a wrong name fails it.
- [ ] The `release` skill has the check-and-bump step, and it names the follow-up checks. Written, but `.claude/skills` is untracked, so it is not in the commit.
- [x] Changelog fragment in `docs-internal/changelog.d/`.

## Landed

**Not verified**
- The `release` skill step: the skill folder is not tracked in git. The edited file is in the shared notes folder as `release-skill-with-4d.md`; the main checkout's skill needs the same step 4d.
- macOS and Linux unpacking: only the Windows host ran. Symlinks in those archives need a mac or Linux runner.
- The `extraResources` entries for macOS and Linux: not built here.

**For you**
- Windows signing now covers every `.exe` in `resources/llama-server/` (about 25 unused llama.cpp tools). Look at the build time; pruning them is a later choice.
