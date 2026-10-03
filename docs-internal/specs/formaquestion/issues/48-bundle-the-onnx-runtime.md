# 48: Bundle the ONNX runtime

Status: done
Status note: Electron model cache traced to the probe's profile path; no code change
Base: 04087632
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
- [x] In Electron, the second load of a cached model makes no huggingface.co request; the `.scratch/ortelectron` harness proves it

## Handover

**Before**, dev server, cached model, Resource Timing read inside the worker: two requests left the app, `https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs` and `…jsep.wasm`. No Hugging Face request, so the model came from cache.

**Change.** `embeddingWorker.ts` sets `wasmPaths` to `?url` imports of the runtime's `.mjs` and `.wasm`, made absolute (the runtime's XHR rejects a root-relative URL). The `onnxruntime-web-dist` Vite alias points at the package's `dist`, which its exports do not expose; the alias stays out of dep pre-bundling, which breaks the `.mjs?url` import. Semantic Memory, Formaquestion's semantic source and the Test Bench all load this one worker.

**After:**

| Target | Cold load, outside the app | Cached load, outside the app |
|---|---|---|
| Dev server (browser pane) | runtime from `localhost` only | none |
| Web build (`vite preview`, Playwright context requests) | Hugging Face model files only | none |
| Electron (throwaway main with the real `app://` handler, `webRequest` log) | model files; runtime from `dist` | model files again (see below) |
| Android | not run: no device or emulator on this machine | — |

Each load returned a 384-dim vector. The cold-load model requests are expected: Q75 covers the runtime, and Q73 covers a cached model. `embeddingWorker.test.ts` fails when the override goes or a path is root-relative (both mutants run). Gates: typecheck, lint, test (16,512 passed, Semantic Memory tests unchanged) and build exit 0.

**Build size:** +44,484 bytes (`ort-wasm-simd-threaded.jsep-*.mjs`) and about +300 bytes in the worker chunk. The 21.6 MB `.wasm` already shipped unused: ORT's bundle references it through `new URL(…, import.meta.url)`, and the 2026-09-01 build in `out/play/assets` holds it.

**Electron model cache (reopened).** The empty `transformers-cache` came from the probe, not the app. The probe's profile sat under a deep scratchpad folder. Chromium's cache entry files then pass the Windows 260-character path limit, and each `cache.put` fails with no error. Neither `app://` nor the CORS shim is involved.

| Profile path length | Keys after load | Second load from Hugging Face |
|---|---|---|
| 128, 131, 133 | 4 | none |
| 135, 136 | 0 | all 4 files |

The same results hold with and without the CORS shim. An instrumented worker showed every `put` succeed under `app://`. `embeddingCacheKey` matches the keys the worker writes.

The installed app uses `%APPDATA%ormamorph`, far under the limit. The portable build keeps `userdata` beside the exe, so an exe folder longer than about 124 characters loses the cache. It still works, but downloads the model on every load.
