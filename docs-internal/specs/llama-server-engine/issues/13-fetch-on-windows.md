# 13: Fetch on Windows

Status: done
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

- [x] `npm run llama-server:fetch` exits 0 on this PC, with the exit code quoted. Ran the script: `downloaded win-x64-vulkan`, exit=0.
- [x] The Windows folder holds `llama-server` and its backend DLLs after the run. `llama-server.exe`, `llama-server-impl.dll`, `ggml-*.dll` listed.
- [x] A test covers the chosen path: per-host selection, or a symlink entry that can't be created. `platformsFromArgs` tests in `scripts/fetchLlamaServer.test.mjs`.
- [x] The guard is proven to bite: with the fix reverted, the new test fails. Default returned `undefined`: "defaults to the host platform" failed.
- [x] A rerun with the same tag downloads nothing. Second run printed `up to date`, exit=0.
- [x] Changelog fragment in `docs-internal/changelog.d/`, only if the fix changes what a player or packager sees. None: the branch is unreleased and the desktop build scripts already pass `--platform`.

## Landed

Chose **fetch only what the host packages**. The CLI default is the host's platform; `--all` fetches every platform for CI; `--platform` still names one. The old symlink-error filter matched the word "symlink", but tar prints "Invalid argument", so it never worked. It is removed: an unpack failure now always throws.

**Not verified**: macOS and Linux fetch on their own hosts (no hardware here).

**For you**: CI that packages all platforms from one runner needs `npm run llama-server:fetch -- --all` (symlinks fail on a Windows runner).
