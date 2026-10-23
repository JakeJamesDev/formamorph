# 08: Image Input

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: file pairing, a catalog shape addition, and the download plan; the proxy hook point already exists.

## What to build

Local vision models see images (spec: Images; Q11, Q13, Q16).

- A projector is a file named `mmproj*.gguf` beside the model in the models folder. The engine pairs them on load and passes `--mmproj`.
- With a projector loaded, the proxy passes image parts through. Without one, it keeps ticket 03's strip and header.
- Recommended catalog entries for vision models list their projector. A download fetches both, with the same progress, pause and resume as a model download.
- The Installed list shows that a model has a projector.

## Acceptance criteria

- [x] Engine tests: a model with a matching `mmproj*.gguf` loads with `--mmproj`; one without loads without it. `llmEngine.test.mjs` "adds a model's paired projector to its preset section" (the projector rides the preset as `mmproj =`, per T02-1); pairing rules in `modelScan.test.mjs` "vision projectors".
- [x] Proxy tests: images pass through with a projector, and are stripped and counted without one. `llmEngine.test.mjs` "passes image parts through when the model has a projector" and "drops image parts the model cannot see".
- [x] Download tests: a catalog vision entry fetches the model and its projector, and resume works for both. `modelDownload.test.mjs` "downloadModel: a vision entry and its projector".
- [x] On this PC, a vision model with its projector answers a turn that carries a scene image, and the reply refers to the image. Hauhau Gemma4 12B + BF16 projector on the RTX 4090 (Vulkan): the authoring tour's bedroom webp went through with no images dropped, and the reply named the red curtains, red rug, ceiling fan and clock.
- [x] Changelog fragment in `docs-internal/changelog.d/`. `llama-server-engine-08.md`.

For you: give a vision model a scene image in play and judge whether its description fits.

## Landed

**Not verified**
- None. Each guard was also reinstated as a bug once and went red (11 mutations).

**For you**
- Give a vision model a scene image in play and judge whether its description fits.
- Download Gemma-4 12B Uncensored (HauhauCS) from **Recommended**: one bar covers the model and its 175 MB projector, and the row and the Installed entry show **Vision**.
