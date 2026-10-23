# 08: Image Input

Status: ready-for-agent
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

- [ ] Engine tests: a model with a matching `mmproj*.gguf` loads with `--mmproj`; one without loads without it.
- [ ] Proxy tests: images pass through with a projector, and are stripped and counted without one.
- [ ] Download tests: a catalog vision entry fetches the model and its projector, and resume works for both.
- [ ] On this PC, a vision model with its projector answers a turn that carries a scene image, and the reply refers to the image.
- [ ] Changelog fragment in `docs-internal/changelog.d/`.

For you: give a vision model a scene image in play and judge whether its description fits.
