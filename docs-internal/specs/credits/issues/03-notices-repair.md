# 03: Notices Repair

Status: ready-for-agent
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

- [ ] The generator regenerates the file, keeps the hand-kept sections byte for byte, and running it twice changes nothing.
- [ ] Removing an entry fails the build. Removing an entry's license text fails the build. Each is proved by reinstating the gap.
- [ ] Every entry has license text, and no entry reads UNKNOWN.
- [ ] The file holds the OFL text, the upstream MIT text, llama.cpp's MIT text and eSpeak NG's GPL-3.0 text.
- [ ] Every font in the build has a correct entry, including Roboto's license from its package.
- [ ] The file names no avatar path that doesn't exist.
- [ ] A site build writes the file, and the site footer's link resolves to it. Read from a real build.
- [ ] The file's header states the regenerate command, and any docs that describe it match.
- [ ] A changelog fragment is added.
