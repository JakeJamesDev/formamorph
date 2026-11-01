# 05: Website Downloads for Presets and Mascots

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: two file formats to match exactly, one of them a WebP card with embedded data built from listing content, and a fail-loud default branch.

## What to build

On formamorph.ai, the device download of a prompt preset or a Mascot listing saves a dictionary-shaped `.json` that neither importer reads. Give the device download a branch per catalog kind. A prompt preset saves the share file the app's own preset export writes, named `<name>.preset.json`. A Mascot saves the WebP card the Mascot export writes: the card data embedded in the Initial look. A kind with no branch fails with an error and saves nothing.

Spec: Implementation Decisions "Device downloads". Evidence: docs-sweep ticket 05, Landed.

## Acceptance criteria

- [ ] A device-download test with a prompt preset listing fails today, then passes: the saved file parses through the preset share reader
- [ ] A device-download test with a Mascot listing fails today, then passes: the saved WebP reads back through the Mascot card reader with its rig and images
- [ ] A listing of a kind with no branch fails and saves no file (test)
- [ ] The Community-Creations page says which file each kind's website download saves; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤

For you: on the website build, download a preset and a Mascot, then import each in the app.
