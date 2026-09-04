# Spec: NovelAI Image Generation Provider

Status: ready-for-agent

## Problem Statement

Players who subscribe to NovelAI already pay for a high-quality anime/illustration image model with a generous free-generation window, but Formamorph cannot use it. Today the only cloud image provider is the OpenAI-compatible one, which is desktop-only; browser players who want cloud image generation without running a local Stable Diffusion server have no option at all.

## Solution

Add NovelAI as a first-class image generation provider, selectable in the image endpoint preset like the existing providers. It calls NovelAI's image API directly from the browser (its CORS policy allows this — verified live), authenticates with the user's persistent NovelAI API token via the existing per-preset token field, and defaults to settings that fall inside the Opus subscription's free-generation window (nai-diffusion-4-5-full, 1024×1024, 28 steps). Scene images and editor images flow through the exact same pipeline as every other provider.

## User Stories

1. As a player with a NovelAI subscription, I want to select NovelAI as my image provider, so that scene images use the model I already pay for.
2. As a browser player, I want a cloud image provider that works without the desktop app, so that I can get scene images with zero local setup.
3. As an Opus subscriber, I want the default resolution and steps to sit inside the free-generation window, so that scene images cost me no Anlas unless I opt into larger settings.
4. As a player, I want to paste my NovelAI API token into the existing API token field, so that setup feels identical to every other provider.
5. As a player, I want the endpoint URL prefilled with NovelAI's image host, so that I don't have to find it in third-party docs.
6. As a player, I want to pick the NovelAI model from a dropdown of current model names, so that I don't have to type internal model ids by hand.
7. As a player, I want my prompt and negative prompt to just work on V4/V4.5/V5 models, so that I don't need to know about NovelAI's caption format.
8. As a player, I want to press Stop and have the generation abort immediately in the UI, so that a slow or unwanted generation doesn't block my turn.
9. As a player, I want a clear error when my token is invalid or expired, so that I know to regenerate it rather than blaming the app.
10. As a player, I want a clear error when I'm out of Anlas, so that I understand the failure is billing, not a bug.
11. As a player, I want the setup guide to tell me where in my NovelAI account to generate the token, so that I can set up without leaving the app.
12. As a player, I want the setup guide to warn me that stopping a generation may still spend Anlas, so that I'm not surprised by my balance.
13. As a world author, I want the editor's image generation button to work with NovelAI, so that entity and location art uses the same provider as gameplay.
14. As a player, I want generated images stored and pruned exactly like other providers' images, so that saves, rollback, and opt-in persistence behave identically.
15. As a player switching between presets, I want my NovelAI preset (endpoint, token, model, sizes) remembered per preset, so that switching providers is one dropdown change.
16. As a player, I want a request that produces a random seed by default, so that regenerating a scene gives a fresh image.
17. As a desktop app user, I want NovelAI to work there too, so that provider choice doesn't depend on which build I run.
18. As a player with an unstable connection, I want a failed generation to surface a readable error instead of hanging, so that I can retry.
19. As a player, I want odd width/height values I enter to be adjusted to NovelAI's constraints rather than rejected, so that generation never fails on a rounding technicality.

## Implementation Decisions

- **New provider id `novelai`** joins the provider union, the provider registry, the default-endpoint map, and the preset coerce ladder. The legacy settings migration is untouched — no pre-preset settings could reference the new id.
- **Browser-first transport.** The provider uses direct `fetch` from the renderer, like the local providers and unlike the OpenAI provider's desktop IPC bridge. NovelAI's image host answers CORS preflight with `access-control-allow-origin: *` and allows `Authorization`, so no proxy or desktop gate is needed. The provider dropdown entry carries no desktop-only restriction.
- **API contract**: POST `{endpoint}/ai/generate-image` with `Authorization: Bearer {apiToken}`. Body is `{ action: "generate", input: <prompt>, model, parameters }`. Default endpoint `https://image.novelai.net`.
- **Parameter mapping** from the shared A1111-shaped params, normalized inside the provider (same approach as the ComfyUI and InvokeAI providers):
  - `prompt` → `input`; `negativePrompt` → `parameters.negative_prompt`.
  - For V4/V4.5/V5 models, also build `v4_prompt` / `v4_negative_prompt` caption wrappers (`{ caption: { base_caption: <text>, char_captions: [] } }`) from the same strings.
  - `width`/`height` rounded to the nearest multiple of 64, clamped to 1600.
  - `steps` clamped to 50; `cfg` → `scale` clamped to 0–10.
  - `sampler`: map common A1111 names to NovelAI's `k_*` vocabulary; unknown names fall back to `k_euler_ancestral`.
  - `seed: -1` → omit the field so the server randomizes; otherwise pass through.
  - `n_samples: 1`, `image_format: "png"`, quality tags enabled with the default undesired-content preset.
- **Defaults** (in the preset defaults for this provider): model `nai-diffusion-4-5-full`, 1024×1024, 28 steps — the Opus free window (≤1,048,576 pixels, ≤28 steps).
- **Model selection** is a hardcoded dropdown of current model ids (v3, v3-furry, v4 full/curated, v4.5 full/curated, v5 full/curated); NovelAI has no model-listing endpoint worth polling.
- **Response handling**: the API returns a ZIP containing the PNG. Unpack in-browser with `fflate` (new runtime dependency, ~8 KB tree-shakeable); if the body is not a ZIP, treat the bytes as a bare image. Convert to a base64 data URL via the shared helper, matching the `ImageProvider` return contract.
- **Cancel**: thread the abort signal into the fetch. NovelAI exposes no server-side interrupt, so no best-effort cancel call is made (same as the OpenAI cloud provider); the setup guide notes that an already-submitted generation may still spend Anlas.
- **Progress**: no-op in v1. NovelAI's SSE streaming variant (intermediate previews) is a follow-up.
- **Errors**: map 401 (invalid/expired token), 402 (insufficient Anlas), and 429 (concurrent generation limit) to readable messages that include the server's response text where present; other failures surface status + body.
- **Setup guide** gets a NovelAI block: where to generate the persistent token in NovelAI account settings, the Opus free-window note, and the cancel/Anlas caveat.
- No world or save export-shape changes. Provider config lives entirely in the existing image endpoint preset storage.
- Changelog: player-facing In-Progress entry.

## Testing Decisions

- Good tests here assert **external behavior at the provider seam**: given params and opts, the provider issues the right HTTP request and returns the right data URL — never internal call order or private state.
- **Prior art**: the InvokeAI and ComfyUI provider tests (vitest, mocked global `fetch`, exported pure helpers tested directly) and the settings→request mapper tests.
- The NovelAI module exports its pure helpers — request-body builder, sampler mapper, ZIP extractor — and tests them directly:
  - Body builder: prompt/negative mapping, v4 caption wrappers per model family, 64-multiple rounding and clamps, seed omission on -1, scale clamping.
  - Sampler mapper: known A1111 names, unknown-name fallback.
  - ZIP extractor: a ZIP fixture built in-test (zip it with fflate in the test) round-trips to the expected image bytes; non-ZIP bytes fall through to the bare-image path.
- The provider function is tested end-to-end with mocked `fetch`: success → data URL; abort signal → rejects with `AbortError` and the request carried the signal; 401/402/429 → the mapped error messages.
- If the settings→request mapper grows a NovelAI branch, its existing test file gains the matching cases.

## Out of Scope

- SSE streaming progress / intermediate previews (follow-up candidate).
- img2img, inpainting, vibe transfer, director tools, character-positioned prompts (`characterPrompts`), and multi-image requests (`n_samples` > 1).
- An Anlas cost estimator or balance display in the UI.
- Token-at-rest encryption (Electron `safeStorage`) — tracked separately if desired; NovelAI's token uses the same plaintext preset storage as every other provider key.
- ADetailer/face-fix for NovelAI (its models rarely need it; the checkbox stays hidden for this provider).

## Further Notes

- API facts (endpoint, request/response shapes, model ids, Anlas rules, CORS) were verified live on 2026-08-24 against `image.novelai.net` (preflight) and the actively maintained `caru-ini/novelai-sdk` source; the older `api.novelai.net` image path is retired.
- The Opus free window applies to one image per request — another reason `n_samples` stays 1.
- `fflate` is the single new dependency; confirm the current version via `npm view fflate version` at implementation time.
