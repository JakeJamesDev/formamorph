# 13: Fetch on Windows

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a contained fix in one build script with its existing tests.

## What to build

`npm run llama-server:fetch` succeeds on Windows (spec: Binaries). Today it downloads the Windows build, then fails while it unpacks the macOS builds, because tar can't create their `.dylib` symlinks on Windows ("Invalid argument").

Pick one, and say which in the landing:

- **Fetch only what the host packages.** A build fetches the platforms its packaging target needs, by default the host's. A flag fetches every platform for CI.
- **Unpack other platforms' symlinks safely.** On a host that can't create a symlink, the fetch writes the link target's file in its place, or skips the link with a recorded reason, so that platform's folder still packages correctly on its own runner.

A rerun with the same tag still downloads nothing.

## Acceptance criteria

- [ ] `npm run llama-server:fetch` exits 0 on this PC, with the exit code quoted.
- [ ] The Windows folder holds `llama-server` and its backend DLLs after the run.
- [ ] A test covers the chosen path: per-host selection, or a symlink entry that can't be created.
- [ ] The guard is proven to bite: with the fix reverted, the new test fails.
- [ ] A rerun with the same tag downloads nothing.
- [ ] Changelog fragment in `docs-internal/changelog.d/`, only if the fix changes what a player or packager sees.
