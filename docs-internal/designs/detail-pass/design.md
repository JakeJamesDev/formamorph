# Detail Pass for InvokeAI — design memo

> **Status: implemented** in `src/lib/imageGen/invokeai.ts` as the **Face Fix** setting, exactly as
> planned below. Gates green; not yet exercised against a real InvokeAI server — see *Done bar*.

**Goal:** give the InvokeAI image provider the face-fix second pass that A1111 users already get from the
ADetailer extension, built entirely from core InvokeAI nodes (no extensions, no server-side plugins).

Ported from a working implementation in the user's Ren'Py VN project
(`.claude/skills/invoke-image/detail_pass.py`), which is itself a port of Invoke's own frontend
`addInpaint.ts` (scale-before-processing branch) — i.e. what the GUI builds when you drag a bbox on the
canvas and hit Invoke. That script carries measured notes on every failure mode; this memo keeps the ones
that apply to us and drops the ones that don't.

---

## Verified against the live server

Probed `http://localhost:9090` (InvokeAI 6.13.x) on 2026-07-28. Every node below exists in this build:

`grounding_dino` · `segment_anything` · `tensor_mask_to_image` · `get_image_mask_bounding_box` ·
`crop_image_to_bounding_box` · `img_resize` · `img_lerp` · `create_gradient_mask` · `denoise_latents`
(has `denoise_mask`) · `i2l` · `l2i` · `expand_mask_with_fade` · `invokeai_img_blend` · `img_paste`

**The detector models are not Model Manager entries.** From the OpenAPI schema:

| Node | `model` field |
|---|---|
| `grounding_dino` | enum: `grounding-dino-tiny`, `grounding-dino-base` |
| `segment_anything` | enum: `segment-anything-base/large/huge`, `segment-anything-2-tiny/small/base/large` |

They're plain strings, fetched into Invoke's download cache on first use. So there is **nothing to probe**
— we can't check availability up front, and we can't tell the user to "install" them. See Risks.

---

## The graph

Four enqueues. Passes 2–4 only run when the setting is on and the model architecture supports it.

### 1. Generate — unchanged
The existing `buildLinearGraph`. One change: when the detail pass is on, `l2i` becomes
`is_intermediate: true` with **no** board, so the un-fixed base doesn't land in the gallery next to the
composite. We already hold the result's `image_name` from `parseImageName` — **no upload step is needed**
(the VN script uploads because it starts from a local file; we don't).

### 2. Detect — Grounding DINO alone
```
grounding_dino(prompt: "face", detection_threshold: 0.3, image: <gen image_name>)
```
Its own enqueue **so the boxes can be filtered before SAM sees them.** This filter is load-bearing, not
defensive polish: DINO's failure mode is returning a whole-canvas box *with high confidence*. The VN
measured `"vulva" 0.68`, `"navel" 0.65`, `"tattoo" 0.52` all covering 70–85% of the canvas. Taking the
top-scoring box without an area check silently turns the detail pass into a full-image img2img.

Reject any box over `maxBoxFrac` (0.25) of the canvas, then take the highest score. **No usable box ⇒
return the base image unchanged** — never fail the generation (see Risks).

### 3. Segment — box → silhouette → tight bbox
```
segment_anything(model, mask_filter: "highest_box_score", apply_polygon_refinement: true,
                 bounding_boxes: [box], image: <gen image_name>)
  → tensor_mask_to_image → get_image_mask_bounding_box(margin: 48)
```
Returns the mask's `image_name` and a tight bbox. Then, client-side:
- **zoom** the bbox about its center by 2.2×, clamped to the canvas;
- compute the render size with a port of `getScaledBoundingBoxDimensions.ts` — scale to the model's
  optimal **area**, not its long edge, and leave an SDXL bbox alone if it already matches a training
  dimension. `optimal` is 1024 for SDXL, **512 for SD1.5**.

Zoom is what makes the denoise safe: it feeds the model surrounding context and cuts the effective upscale
factor, so the pass *corrects* what's there instead of inventing detail. Cropping tight (zoom 1.0)
over-renders at any strength.

### 4. Re-render + paste — one graph
```
crop + maskcrop (bbox)  →  maskinv (img_lerp 255→0)
  → up / upmask (img_resize to gw×gh, lanczos)
  → i2l + create_gradient_mask → denoise_latents.denoise_mask   ← masked in LATENT space, so context
  → l2i                                                            outside the mask is preserved DURING
  → down (img_resize back to crop size)                            sampling, not repaired afterwards
  → grad.expanded_mask_area → expand_mask_with_fade → downmask (img_resize)
  → invokeai_img_blend(layer_base: crop, layer_upper: down, mask: downmask)
  → img_paste(base_image: <gen image_name>, x, y, crop: true)   ← board + is_intermediate:false here
```

**Defaults** (the VN's measured house values): `denoising_start` 0.55 → **0.45 strength**, zoom 2.2,
`edge_radius` 16, `coherence_mode` "Gaussian Blur", `minimum_denoise` 0, margin 48, feather 16.
Two 0.45 passes beat one 0.65 pass; talk about it in strength (= 1 − start), the way the GUI shows it.

### What we drop from the VN version

| Dropped | Why it doesn't apply |
|---|---|
| `cropRGBA` / `srcalpha` / `gated` / `blockmask` (alpha gate, ~5 nodes) | Only needed because the VN's CGs are RGBA; our scene images are opaque. Wire `downmask → blend.mask` directly. |
| `canvas_v2_metadata` raster-layer stacking | Invoke-GUI editing affordance — meaningless for a generated scene image. |
| `fixtensor` / `fixpatch` transparent patch | Same reason; only exists to feed the raster layer. |
| The separate paste enqueue | The VN splits it purely so the paste's metadata can name the patch the previous enqueue produced. We have no patch, so paste folds into pass 4. |
| `embedded_metadata` passthrough | We generate the image ourselves; recall metadata is not our surface. |
| LoRA chaining | Not wired in our linear graph today. Additive later if needed. |
| `yolo_detect.py` (Anzhc anime YOLOs) | Local Python + ultralytics — unreachable from a browser. Its own docstring says *don't* use it for faces; DINO beats it on profile views and crowds. |

### Kept, and why

- **VAE precision.** An SDXL model whose `default_settings` say fp32 renders **solid black** in fp16. Our
  `buildLinearGraph` hardcodes `fp32: false`; the detail graph must read it from the model.
- **`img_lerp(255→0)` to invert the SAM mask.** `create_gradient_mask` wants white=preserve/black=denoise;
  SAM gives the opposite. `image_mask_to_tensor` would binarize and destroy the gradient.
- **Never `paste_image_into_bounding_box`** (writes the patch's alpha into the target) and never pass a
  mask to `img_paste` (premultiplies ⇒ dark halo on every feathered edge). Both were tried and are wrong.

---

## Settings surface

**Recommendation: reuse the existing `imageAdetailer` boolean.** It already exists end to end —
`settingsDefaults.ts` → `SettingsContext` → `request.ts` → `ImageGenParams.adetailer`. Making it apply to
InvokeAI too means:

- no settings migration, no preset-shape change in `imageEndpointPresets.ts`, no `VITE_DEFAULT_*` churn;
- relabel the row from "ADetailer" to **"Face Fix"** with a provider-conditional hint (A1111: "requires the
  ADetailer extension"; InvokeAI: "runs a second inpaint pass — roughly doubles generation time");
- `types.ts` comment stops saying "A1111 only".

An `off | face | face+hands` enum is the tempting generalization — **don't**, not in v1. It forces a
settings migration and a preset-shape change for a second target we haven't measured. Hands are a
materially harder detection problem than faces and deserve their own evidence.

**Target string stays hardcoded to `"face"`.** An exposed free-text DINO target invites exactly the
whole-canvas failure the area filter exists to catch, and the tuning knobs (zoom/strength/threshold) are
the VN's measured defaults — shipping them as UI is a decision to support tuning them.

---

## Files

| File | Change |
|---|---|
| `src/lib/imageGen/invokeai.ts` | Extract a reusable `runGraph()` (enqueue + poll + abort) — we now run four. Add `buildDetectGraph`, `buildSegmentGraph`, `buildDetailGraph`, `scaledSize`, `zoomBox`, `pickBox`. Orchestrate in `invokeaiProvider`. |
| `src/lib/imageGen/types.ts` | `adetailer` is no longer A1111-only. |
| `src/components/modals/SettingsModal.tsx` | Show the row for InvokeAI; provider-conditional label + hint. |
| `src/components/modals/ImageSetupGuide.tsx` | InvokeAI section: note the first-run weight download. |
| `src/lib/imageGen/invokeai.test.ts` | Graph-shape tests: area filter rejects a whole-canvas box; `scaledSize` matches the TS original's numbers; SD1.5 uses 512; the detail graph is skipped for `z-image`/`anima`; no-detection returns the base image. |
| `docs/Changelog.md` | In Progress → Minor → Added → 👤. |

Progress reporting: `watchInvokeProgress` already takes `itemId` as a getter, so it follows successive
queue items for free. Map the passes onto one bar — gen 0→0.75, detect/segment 0.75→0.80, detail
0.80→1.0 — and make the `finally` block cancel *the currently running* item, not just the last id.

---

## Risks

**First-run weight download is invisible.** No Model Manager entry means no pre-check and no progress
event — the first face-fix on a fresh Invoke install stalls at "queued" while it pulls the weights.
Mitigation: default to the **small** variants (`grounding-dino-tiny` + `segment-anything-base`), and say so
in the Setup Guide. This is the main UX risk and it's worth a look before shipping.

**Architecture gating.** Z-Image and Anima use `*_denoise` nodes with no `denoise_mask` input. The pass
must be skipped (silently, not as an error) for `PREFIXED_BASES`. SDXL + SD1.5 only.

**Cost.** A second full pass roughly doubles wall-clock per scene image, and the one-GPU serialization rule
still applies. Default stays **off**.

**Failure must degrade, not throw.** No box found, box rejected by the area filter, detector download
fails — all return the base image. A face-fix that fails should never lose the user their generation.

**Blend polarity is the one thing to verify empirically.** Removing the alpha gate removes a
double-inversion; `downmask` should feed `blend.mask` directly, but if the polarity is backwards the blend
returns the *untouched* crop and the pass silently appears to do nothing. Check the first run against a
known-bad face rather than assuming.

---

## Done bar

Four gates green, plus a live end-to-end against the user's Invoke: before/after crops of the same seed on
an SDXL model and an SD1.5 model, and one run each of the two degrade paths (no face in frame,
architecture unsupported) showing the base image comes back intact.
