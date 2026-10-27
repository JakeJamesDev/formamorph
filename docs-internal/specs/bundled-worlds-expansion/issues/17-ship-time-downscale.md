# 17: Ship-Time Downscale

Status: done
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

- [x] A production web build bundles the downscaled copies, and a test shows a shipped world equals its source outside the image bytes. `npm run build` printed the shipped table; every re-encoded image's shipped bytes are in `dist/assets` and its source bytes are not, except where the same image fills a second slot whose budget keeps it. Test: `the shipped copy of %s › keeps every id, rule and other field, and changes only image bytes` (`src/lib/shippedWorld.test.ts`).
- [x] The seeder accepts both forms: a test seeds a world from the shipped copy and from the source file and finds the same fingerprint match for each. Test: `the shipped copy of %s › seeds and publishes with a fingerprint the list holds, from either form`, plus `holds the shipped fingerprint of %s` in `src/lib/bundledFingerprint.test.ts`.
- [x] The step is shown to be skipped by its switch, with the source files bundled instead. `FORMAMORPH_LOSSLESS_WORLDS=1 vite build` logged the lossless line, and its bundle holds every source image and no shipped one. Test: `shipBundledWorlds › leaves the source file to Vite with FORMAMORPH_LOSSLESS_WORLDS=1`.
- [x] The Android and desktop builds take the same shipped copies, shown by their build output. `node scripts/buildAndroid.mjs` and `FORMAMORPH_BUILD=portable vite build` printed the same table as the web build. Capacitor copies `dist/`, and Electron serves `dist/`.
- [x] Shipped and source sizes per world are in this ticket's comments.

## Landed

**Landed after** Downscale Presets 01 (13059703e2), as the spec session ruled. The step reads that ticket's shared scan through `downscaleDeps`, and the fingerprints were regenerated under it, so no shipped fingerprint was recorded under the old rule.

**Not verified**

- An arm64 macOS build making the same bytes. Older JPEG art decodes through sharp; its libjpeg-turbo gave identical pixels with SIMD on and forced off (`JSIMD_FORCENONE=1`) on x64, but no arm64 build ran. CI's ubuntu test run checks the x64 Linux bytes against the list.
- The cold-cache path in CI. Every local run here reused or rebuilt the cache on Windows; the fresh encode after the key change reproduced the same fingerprint list.

**For you**

- Judge the re-encoded images at full size. Each of the 14 frames in `.scratch/bundled-worlds-expansion-17/frames/` shows the source on the left and the shipped copy on the right, for example `.scratch/bundled-worlds-expansion-17/frames/sugarscape-peppermint-pouncer-image-1.png`.
- Veilwood's seven animated portraits are over the new 250 KB entity budget and ship unchanged, so every production build warns with their names. `scripts/shipBundledWorlds.md` records the rule.

## Comments

**Shipped sizes** (Presets 01 rule and budgets, source → shipped, measured as the build plugin measures):

| World | Source | Shipped |
|---|---|---|
| drone | 1.31 MB | 0.40 MB |
| emberwatch | 0.18 MB | 0.14 MB |
| open-chat | 0.10 MB | 0.10 MB |
| rampage | 0.68 MB | 0.53 MB |
| slime | 0.51 MB | 0.31 MB |
| sugarscape | 2.40 MB | 1.05 MB |
| valentines | 0.92 MB | 0.46 MB |
| veilwood | 6.30 MB | 5.48 MB |
| **total** | **12.41 MB** | **8.47 MB** |

Fourteen images change: six world thumbnails and eight entity images, lossless ones included. Veilwood barely shrinks: most of its size is the seven animated portraits, which ship unchanged. Under the old rule the total was 10.10 MB. The art tickets' lossless images are all Downscale targets, so the gap grows with each one.

**Rulings from the spec session:** Downscale's rules run in Node through the app's libwebp, not the browser canvas. The step selects images only through the app's shared scan. Shipped fingerprints start at cd6fe508c. No seeder change. An image the scan selects but the codec cannot read fails the build (BMP among them), except animated images, which ship unchanged with a warning.

**Block (spec session, after the Downscale Presets grill):** the editor's old trigger selected only images over budget, so most lossless expansion art would have shipped lossless. Presets ruling Q12 made one shared scan that also selects stored-lossless images, and this ticket landed after it.

**Dependency:** `sharp@^0.34.5` is now a direct devDependency. It was already installed through `@huggingface/transformers`, so `node_modules` did not change. It decodes the older JPEG art.
