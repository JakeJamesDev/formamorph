# 48: Bundle the ONNX runtime

Status: ready-for-agent
Blocked by: 44
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The embedding worker loads with no request to a third-party host (Q75). Ticket 44 traced, in the transformers.js source, that the worker fetches the ONNX runtime binary from cdn.jsdelivr.net through the library's default `wasmPaths`. Semantic Memory makes the same fetch today. This breaks Q73: a cached model must load with no download.

- First confirm the fetch in a real browser: load the embedder and read the network log. If no CDN request appears, report that and stop.
- Bundle the runtime binary with the app, and point the worker at the bundled copy.
- It works in the web build, the Electron shell and the Android APK.
- Semantic Memory and Formaquestion's semantic source both use the bundled copy.
- The build size change is in the handover.

Recommended model rationale: a build-config change that must hold on three targets.

## Acceptance criteria

- [ ] The handover shows the network log before the change, with the CDN request, or reports that there was none
- [ ] After the change, loading the embedder makes no request outside the app's own origin; a browser check proves it
- [ ] The web build, Electron and Android each load the embedder
- [ ] Semantic Memory tests pass unchanged
- [ ] Four gates green
