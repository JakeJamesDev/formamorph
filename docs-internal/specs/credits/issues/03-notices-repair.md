# 03: Notices Repair

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The module-graph source and an in-build guard are new tooling, and the license facts must be read, not assumed.

## What to build

`THIRD-PARTY-NOTICES.md` becomes accurate and stays accurate. A generator on an npm command writes the package list and summary from the production module graph of the app and site builds, plus a short list for Electron's main process and Capacitor. A drift guard inside both builds fails when a bundled package has no entry, or an entry has no license text. A hand-kept map supplies text for packages that ship none and corrects wrong declared licenses.

The hand-kept Bundled assets section gets the upstream MIT text, llama.cpp with LLVM OpenMP, eSpeak NG with GPL-3.0 (Q18), the OFL fonts, and the avatars as they ship. Check llama.cpp's vendored libraries and AndroidX, and record what you find.

This ticket owns the file's format: every entry is a `###` heading under a `##` section. Ticket 04 parses that format.

`shipNotices` runs in the site build, and the site's footer links to the file through the base path (Q19).

The avatar entry follows the model that ships when this lands: the Release Avatar License effort hands over a new model's details. eSpeak NG's entry follows the eSpeak NG effort the same way. Ask the spec session if either has moved.

Rulings: Q9, Q18, Q19.

## Acceptance criteria

- [x] The generator regenerates the file, keeps the hand-kept sections byte for byte, and running it twice changes nothing. `npm run gen-notices` run twice: same sha256 both times. `spliceGenerated` tests.
- [x] Removing an entry fails the build. Removing an entry's license text fails the build. Each is proved by reinstating the gap. Real app and site builds exit 1 with each gap on `react`, and on `kokoro-js` (worker) and `@capacitor/android` (outside the bundles). Baseline builds exit 0. `noticesDrift` tests, each mutation-tested.
- [x] Every entry has license text, and no entry reads UNKNOWN. `the shipped notices file` test. The four hand-kept attribution entries follow T03-4.
- [x] The file holds the OFL text, the upstream MIT text, llama.cpp's MIT text and eSpeak NG's GPL-3.0 text. `the shipped notices file` test.
- [x] Every font in the build has a correct entry, including Roboto's license from its package. 12 font packages against the Webfonts family list. `@fontsource/roboto` reads OFL-1.1 from its package.
- [x] The file names no avatar path that doesn't exist. `names only avatar files that exist` test. Both models read from their VRM metadata.
- [x] A site build writes the file, and the site footer's link resolves to it. Read from a real build. `npm run build:site`, then a browser on `site-dist`: href `/site-app/THIRD-PARTY-NOTICES.md`, status 200, same bytes. `deploy-site` copies all of `site-dist`.
- [x] The file's header states the regenerate command, and any docs that describe it match. Header test. `README.md` already matches. `STEAM-RELEASE-CHECKLIST.md` is untracked, so it changes on the main checkout after the landing.
- [x] A changelog fragment is added. `docs-internal/changelog.d/credits-03.md`.

## Findings

| Checked | Found |
|---|---|
| llama.cpp license list | `llama.exe licenses` at b11960 prints llama.cpp, LLVM OpenMP, cpp-httplib, BoringSSL and nlohmann/json. All five have entries. |
| llama.cpp vendored code the list omits | `mtmd` links xxHash (BSD-2-Clause), stb_image, miniaudio, subprocess.h, SHA-1 and SHA-256. All have entries, from the sources at the tag. |
| Other engine archives | The Linux Vulkan and macOS arm64 archives hold no third-party library files beyond llama's own. Windows adds `libomp.dll`. |
| AndroidX | Apache-2.0: the POMs of `appcompat`, `coordinatorlayout` and `core-splashscreen` say so. The other AndroidX libraries are listed on that reading. |
| Other Android code | Apache Cordova, Kotlin and `kotlinx-coroutines` are Apache-2.0 by their POMs. `ionfilesystem-android` is MIT. |
| Packages a dist inlines | `kokoro-js` inlines `phonemizer`, and with it eSpeak NG. `@pixiv/three-vrm`, `@huggingface/transformers`, `onnxruntime-web` and `@lexical/*` inline theirs too. The module graph can't see these, so `legal/notices-map.json` lists them. |
| Desktop app | `electron-builder` packs the whole production `dependencies` tree into `app.asar`, not only what the main process needs. The generator walks that tree. |

Beyond the ticket's list, because the file claims to be complete: a Go standard library entry for the Windows launcher, and the Tailwind packages, whose CSS the build writes. `hosting/_headers` serves the file as plain text so a browser shows it.

The guard also checks packages outside the bundles, which meets user story 32 as well as the spec's narrower line.

## Landed

**Not verified**

- Whether the llama-server web UI embeds npm packages with their own notices. Upstream's license list names none, and the UI's source isn't in the vendored folders.
- The deployed response headers. `hosting/_headers` applies only on Cloudflare Pages.
- The `genNotices.mjs` command-line run has no test. It ran by hand, twice.

**For you**

- Read the Elaina entry's wording in `THIRD-PARTY-NOTICES.md`. It says the model's usage terms are recorded in the file, without naming the four turned-off flags.
