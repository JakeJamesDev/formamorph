# 02: CUDA Pin Digests

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: script and build plumbing with clear inputs; the trap is CI and packaging, not logic.

## What to build

The llama.cpp pin learns the CUDA assets. A new pin-bump command, run by hand, writes the tag plus the name and SHA-256 digest of the two CUDA 13.4 assets. It reads the `digest` field from the GitHub release API. The build gate checks that the pinned release has both assets and that their digests match the pin, and fails with a clear message otherwise. The packaged app carries the tag, the asset names, the digests, and the plain release-download URLs, because the pin file is not packaged today. The app never calls the GitHub API at runtime. See the spec, "The pin".

Developer-only, so the changelog fragment goes under 🛠️ if one is warranted.

## Acceptance criteria

- [x] The pin-bump command writes the tag and both CUDA asset names and digests, and refuses a tag whose release lacks either asset. (`bump writes…`, `bump refuses a release that lacks CUDA asset 0/1`)
- [x] The build gate fails when a CUDA asset is missing from the pinned release, or when a digest differs from the pin. Tests drive both cases with an injected fetch. (`the gate fails when…` tests; live `--check-cuda` passed on b12078)
- [x] Main-process code can read the tag, the asset names, the digests and the download URLs in a packaged build and in a dev run. (`readEnginePin` tests for both pin paths; the packaged copy comes from `extraResources`, not exercised by a real build)
- [x] No runtime code path calls `api.github.com`. (`enginePin.cjs` builds plain `releases/download` URLs; the existing app-update code in `updater.cjs` and `UpdateService.ts` is out of scope)
- [x] The existing bundled-build fetch keeps working from the same pin. (existing fetch tests green)

## Landed

**Not verified**
- A real packaged build: the `resources/llama-server/llamaServerPin.json` copy and the reader's packaged path were not run in an installed app.
- The `--check-cuda` CLI wiring (check runs before the fetch, even when builds are current) has no test; only a live run.

**For you**
- Run `npm run desktop:build` once on Windows and confirm `release/win-unpacked/resources/llama-server/llamaServerPin.json` exists.
- The digest check runs on Windows builds only. Linux and macOS builds make no extra GitHub call.
