# 05: Website Downloads for Presets and Mascots

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: two file formats to match exactly, one of them a WebP card with embedded data built from listing content, and a fail-loud default branch.

## What to build

On formamorph.ai, the device download of a prompt preset or a Mascot listing saves a dictionary-shaped `.json` that neither importer reads. Give the device download a branch per catalog kind. A prompt preset saves the share file the app's own preset export writes, named `<name>.preset.json`. A Mascot saves the WebP card the Mascot export writes: the card data embedded in the Initial look. A kind with no branch fails with an error and saves nothing.

Spec: Implementation Decisions "Device downloads". Evidence: docs-sweep ticket 05, Landed.

## Acceptance criteria

- [x] A device-download test with a prompt preset listing fails today, then passes: the saved file parses through the preset share reader. `useDeviceDownload.test.tsx` "writes a prompt preset as the share file…": red before the fix, green after; `parseSharedJson` reads it with no warnings.
- [x] A device-download test with a Mascot listing fails today, then passes: the saved WebP reads back through the Mascot card reader with its rig and images. "writes a Mascot as a WebP of its Initial look…": `readMascotCard` + `storeMascotCard` give back the images, layers and Initial pick; the render drew base + wave only.
- [x] A listing of a kind with no branch fails and saves no file (test). "fails a listing of a kind this build cannot save…": error toast, no fetch, no file. A kindless listing still saves as a world (its own test).
- [x] The Community-Creations page says which file each kind's website download saves; the docs tests are green. Table under "What a Download Does"; `src/lib/docs` tests green.
- [x] A changelog fragment under Minor / Fixed / 👤. `docs-internal/changelog.d/docs-sweep-bugs-05.md`.

## Landed

**Not verified**

- The real canvas WebP render on the website: jsdom has no canvas, so the test swaps the render step. The app export uses the same render.

**For you**

- For you: on the website build, download a preset and a Mascot, then import each in the app.
- A preset listing whose content is not a preset shows the reader's own error, "This file is not a Formamorph prompt preset." On the website the source is a listing, not a file.
