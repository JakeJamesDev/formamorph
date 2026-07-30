// InvokeAI provider. InvokeAI is graph + queue based like ComfyUI, but its node graph is its own
// invocation schema and is architecture-specific: SDXL/SD1.5 share a linear graph, Z-Image uses a
// different node set. We build the graph programmatically from the resolved model's `base` rather than
// from one editable template. Flow: subscribe to the socket.io queue room for live progress + preview
// frames, enqueue a batch to /queue/default/enqueue_batch, poll the queue item for completion, then fetch
// the output image by name. Verified against InvokeAI 6.13.7.
//
// The user launches InvokeAI headless (`invokeai-web`, default port 9090) and adds the app's origin to
// `allow_origins` in invokeai.yaml so the browser fetch passes CORS (see SettingsModal help). Direct
// fetch + poll, so this works in the web dev build and the desktop app (not the hosted https build —
// mixed content).
import type { ImageGenOpts, ImageGenParams, ImageProgress, ImageProvider } from './types';
import { bytesToDataUrl } from '../imageOptim';
import { trimUrl, authHeaders, POLL_INTERVAL_MS } from './http';

/** Model bases this provider can build a graph for. */
export type InvokeBase = 'sdxl' | 'sd-1' | 'sd-2' | 'z-image' | 'anima';
export const SUPPORTED_INVOKE_BASES: readonly InvokeBase[] = ['sdxl', 'sd-1', 'sd-2', 'z-image', 'anima'];

/** Bases whose graph is the loader + text-encoder + denoise + l2i set, keyed by their node prefix. */
export const PREFIXED_BASES: Record<string, string> = { 'z-image': 'z_image', 'anima': 'anima' };

/** The Qwen3 encoder each prefixed base needs. Every encoder reports `base: "any"`, so `variant` is the
 *  only thing separating a 0.6B Anima encoder from Z-Image's 4B one — picking by list order gets it wrong
 *  on any install that has more than one. */
export const REQUIRED_ENCODER_VARIANT: Record<string, string> = { 'z-image': 'qwen3_4b', 'anima': 'qwen3_06b' };

/** A model record as returned by /api/v2/models/ (only the fields we use). */
export interface InvokeModel {
  key: string;
  hash: string;
  name: string;
  base: string;
  type: string;
  /** Distinguishes same-type encoders (`qwen3_06b` / `qwen3_4b` / `qwen3_8b`). Absent on most records. */
  variant?: string;
  /** What the GUI applies client-side when the model is picked. Only `vae_precision` is read here: a
   *  model that wants fp32 renders solid black through an fp16 VAE, in the base render and the detail
   *  pass alike. */
  default_settings?: { vae_precision?: string };
}

/** The graph model field is a full identifier object, not a filename. */
function identifier(m: InvokeModel): Record<string, string> {
  return { key: m.key, hash: m.hash, name: m.name, base: m.base, type: m.type };
}

// Formamorph's Sampler field defaults to A1111-style names; map the common ones to InvokeAI's scheduler
// vocabulary so the default preset works out of the box. Unknown values pass through (a user who typed a
// real InvokeAI scheduler like `dpmpp_2m_k` keeps it); an unmatched value falls back to `euler` server-side.
const INVOKE_SCHEDULER_ALIASES: Record<string, string> = {
  'euler': 'euler',
  'euler a': 'euler_a',
  'euler ancestral': 'euler_a',
  'heun': 'heun',
  'lms': 'lms',
  'ddim': 'ddim',
  'ddpm': 'ddpm',
  'deis': 'deis',
  'unipc': 'unipc',
  'lcm': 'lcm',
  'pndm': 'pndm',
  'dpm++ 2m': 'dpmpp_2m',
  'dpm++ 2m karras': 'dpmpp_2m_k',
  'dpm++ 2m sde': 'dpmpp_2m_sde',
  'dpm++ 2s a': 'dpmpp_2s',
  'dpm++ sde': 'dpmpp_sde',
  'dpm++ 3m sde': 'dpmpp_3m',
};

/** Anima accepts only these six; anything else is rejected by the server rather than ignored, so a preset
 *  carrying an SDXL sampler has to fall back instead of being passed through. */
const ANIMA_SCHEDULERS: readonly string[] = ['euler', 'heun', 'dpmpp_2m', 'dpmpp_2m_sde', 'er_sde', 'lcm'];

/** Normalize a sampler name to an InvokeAI scheduler: map a known A1111 name, else pass through lowercased.
 *  `base` narrows the result to what that architecture actually accepts. */
export function toInvokeScheduler(name: string, base?: string): string {
  const key = name.trim().toLowerCase();
  const mapped = INVOKE_SCHEDULER_ALIASES[key] ?? (key || 'euler');
  if (base === 'anima' && !ANIMA_SCHEDULERS.includes(mapped)) return 'euler';
  return mapped;
}

/** InvokeAI wants a concrete non-negative integer seed; -1 (our "random") becomes a fresh 15-digit int.
 *  Gameplay RNG — Math.random is fine (this is not an id). */
export function resolveInvokeSeed(seed: number): number {
  return Number.isFinite(seed) && seed >= 0 ? seed : Math.floor(Math.random() * 1e15);
}

const edge = (fn: string, ff: string, tn: string, tf: string) => ({
  source: { node_id: fn, field: ff },
  destination: { node_id: tn, field: tf },
});

interface Graph {
  nodes: Record<string, Record<string, unknown>>;
  edges: Array<ReturnType<typeof edge>>;
}

/** The `board` field on an l2i node, or nothing at all — omitted means InvokeAI's Uncategorized. */
function boardField(boardId: string): { board?: { board_id: string } } {
  return boardId ? { board: { board_id: boardId } } : {};
}

/** Build the SDXL / SD1.5 linear txt2img graph. SD1.x uses main_model_loader + single-clip compel;
 *  SDXL uses sdxl_model_loader + sdxl_compel_prompt (with a duplicated style prompt).
 *
 *  `intermediate` marks the output as pipeline scratch — set when a detail pass follows, so the un-fixed
 *  base doesn't land in the gallery beside the composite. */
function buildLinearGraph(
  model: InvokeModel, params: ImageGenParams, seed: number, boardId: string, intermediate = false,
): Graph {
  const isXL = model.base === 'sdxl';
  // The model's own declared VAE precision, the same field the GUI applies and the detail pass reads —
  // a model whose defaults say fp32 decodes to solid black through an fp16 VAE.
  const fp32 = model.default_settings?.vae_precision === 'fp32';
  const loaderType = isXL ? 'sdxl_model_loader' : 'main_model_loader';
  const compelType = isXL ? 'sdxl_compel_prompt' : 'compel';
  const clip2 = isXL ? [edge('loader', 'clip2', 'pos', 'clip2'), edge('loader', 'clip2', 'neg', 'clip2')] : [];
  const compel = (id: string, text: string) =>
    isXL ? { id, type: compelType, prompt: text, style: text } : { id, type: compelType, prompt: text };
  return {
    nodes: {
      loader: { id: 'loader', type: loaderType, model: identifier(model) },
      pos: compel('pos', params.prompt),
      neg: compel('neg', params.negativePrompt),
      noise: { id: 'noise', type: 'noise', seed, width: params.width, height: params.height },
      denoise: {
        id: 'denoise', type: 'denoise_latents', steps: params.steps, cfg_scale: params.cfg,
        denoising_start: 0, denoising_end: 1, scheduler: toInvokeScheduler(params.sampler),
      },
      l2i: intermediate
        ? { id: 'l2i', type: 'l2i', fp32, is_intermediate: true }
        : { id: 'l2i', type: 'l2i', fp32, ...boardField(boardId) },
    },
    edges: [
      edge('loader', 'clip', 'pos', 'clip'), edge('loader', 'clip', 'neg', 'clip'), ...clip2,
      edge('loader', 'unet', 'denoise', 'unet'),
      edge('pos', 'conditioning', 'denoise', 'positive_conditioning'),
      edge('neg', 'conditioning', 'denoise', 'negative_conditioning'),
      edge('noise', 'noise', 'denoise', 'noise'),
      edge('denoise', 'latents', 'l2i', 'latents'),
      edge('loader', 'vae', 'l2i', 'vae'),
    ],
  };
}

/** Build the Z-Image / Anima txt2img graph. Both use the same node shape under their own prefix: no
 *  separate noise node (denoise carries width/height/seed), and two extra submodels wired into the loader
 *  — a Qwen3 text encoder and a VAE. */
function buildPrefixedGraph(
  prefix: string, model: InvokeModel, encoder: InvokeModel, vae: InvokeModel,
  params: ImageGenParams, seed: number, boardId: string,
): Graph {
  return {
    nodes: {
      loader: {
        id: 'loader', type: `${prefix}_model_loader`, model: identifier(model),
        qwen3_encoder_model: identifier(encoder), vae_model: identifier(vae),
      },
      pos: { id: 'pos', type: `${prefix}_text_encoder`, prompt: params.prompt },
      neg: { id: 'neg', type: `${prefix}_text_encoder`, prompt: params.negativePrompt },
      denoise: {
        id: 'denoise', type: `${prefix}_denoise`, width: params.width, height: params.height,
        steps: params.steps, seed, guidance_scale: params.cfg,
        denoising_start: 0, denoising_end: 1, scheduler: toInvokeScheduler(params.sampler, model.base),
      },
      l2i: { id: 'l2i', type: `${prefix}_l2i`, ...boardField(boardId) },
    },
    edges: [
      edge('loader', 'qwen3_encoder', 'pos', 'qwen3_encoder'), edge('loader', 'qwen3_encoder', 'neg', 'qwen3_encoder'),
      edge('loader', 'transformer', 'denoise', 'transformer'),
      edge('pos', 'conditioning', 'denoise', 'positive_conditioning'),
      edge('neg', 'conditioning', 'denoise', 'negative_conditioning'),
      edge('denoise', 'latents', 'l2i', 'latents'),
      edge('loader', 'vae', 'l2i', 'vae'),
    ],
  };
}

// ---------------------------------------------------------------------------
// Detail pass — a masked second render of the face, InvokeAI's answer to A1111's ADetailer extension.
// Built from core nodes only, mirroring what the GUI's canvas builds for a bbox inpaint (frontend
// addInpaint.ts, the scale-before-processing branch): crop + mask -> scale up to the model's optimal
// AREA -> gradient-masked denoise -> scale back down -> blend over the untouched crop -> paste.
// Denoising is masked in LATENT space, so context outside the mask is preserved DURING sampling rather
// than repaired afterwards. Node set verified against InvokeAI 6.13.x.
// ---------------------------------------------------------------------------

/** What Grounding DINO is asked to find. Deliberately not exposed: a free-text target is exactly what
 *  produces the whole-canvas detections `pickDetailBox` exists to throw away. */
const DETAIL_TARGET = 'face';
/** The detectors. Neither is a Model Manager entry — InvokeAI pulls them into its download cache the
 *  first time a graph names one, so there is nothing to install and nothing to probe for. The small
 *  variants keep that one-time stall short. */
const DINO_MODEL = 'grounding-dino-tiny';
const SAM_MODEL = 'segment-anything-base';
const DINO_THRESHOLD = 0.3;
/** Reject a detection covering more than this fraction of the canvas. DINO's failure mode is returning
 *  a whole-canvas box *with high confidence*, which would silently turn the pass into a full-image
 *  img2img rather than fixing a face. */
const MAX_BOX_FRACTION = 0.25;
/** Grow the detected box about its center before rendering. Context is what makes the denoise safe: it
 *  lowers the effective upscale so the pass corrects what is there instead of inventing detail. A tight
 *  crop (zoom 1.0) over-renders at any strength. */
const DETAIL_ZOOM = 2.2;
/** `denoising_start`; strength = 1 - start, so 0.55 is a 0.45-strength pass — enough to clean up a
 *  region whose structure is already good. */
const DETAIL_START = 0.55;
const DETAIL_MARGIN = 48; // px added around the detected mask
const DETAIL_EDGE_RADIUS = 16; // the canvas's Coherence Edge Size
const DETAIL_FEATHER = 16; // gaussian fade on the blend mask

/** A detection box. `score` is present on DINO output, absent on a mask's own bounding box. */
export interface BBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  score?: number | null;
}

/** The best usable detection, or null when nothing survives the area filter. */
export function pickDetailBox(boxes: BBox[], imgW: number, imgH: number): BBox | null {
  const canvas = imgW * imgH;
  if (canvas <= 0) return null;
  const usable = boxes.filter((b) => {
    const w = b.x_max - b.x_min;
    const h = b.y_max - b.y_min;
    return w > 0 && h > 0 && (w * h) / canvas <= MAX_BOX_FRACTION;
  });
  if (!usable.length) return null;
  return usable.reduce((best, b) => ((b.score ?? 0) > (best.score ?? 0) ? b : best));
}

/** SDXL's training buckets. A crop already at one of these is rendered as-is rather than nudged. */
const SDXL_TRAINING_DIMENSIONS: ReadonlyArray<readonly [number, number]> = [
  [512, 2048], [512, 1984], [512, 1920], [512, 1856], [576, 1792], [576, 1728], [576, 1664],
  [640, 1600], [640, 1536], [704, 1472], [704, 1408], [704, 1344], [768, 1344], [768, 1280],
  [832, 1216], [832, 1152], [896, 1152], [896, 1088], [960, 1088], [960, 1024], [1024, 1024],
];

const roundToMultiple = (v: number, m: number) => Math.round(v / m) * m;

/** The canvas's "scale before processing: auto" size — scale the crop to the model's optimal AREA, not
 *  its long edge. Ported from the frontend's getScaledBoundingBoxDimensions.ts. */
export function scaledSize(w: number, h: number, optimal: number, base: string, grid = 8): [number, number] {
  if (base === 'sdxl' && SDXL_TRAINING_DIMENSIONS.some(([a, b]) => (a === w && b === h) || (a === h && b === w))) {
    return [w, h];
  }
  const rw = roundToMultiple(w, grid);
  const rh = roundToMultiple(h, grid);
  // A crop thin enough to round to zero on either axis leaves the aspect ratio non-finite and the growth
  // loop unable to raise the area at all — it would spin the main thread forever. Everything below this
  // guard has both axes positive and finite, so the area grows every pass and the loop terminates.
  if (rw <= 0 || rh <= 0) return [grid, grid];
  let sw = rw;
  let sh = rh;
  const target = optimal * optimal;
  const ar = rw / rh;
  let area = rw * rh;
  let maxDim = optimal - grid;
  while (area < target) {
    maxDim += grid;
    if (rw === rh) {
      sw = optimal;
      sh = optimal;
      break;
    }
    if (ar > 1) {
      sw = maxDim;
      sh = roundToMultiple(maxDim / ar, grid);
    } else {
      sw = roundToMultiple(maxDim * ar, grid);
      sh = maxDim;
    }
    area = sw * sh;
  }
  return [Math.max(grid, sw), Math.max(grid, sh)];
}

/** Grow a box about its center, clamped to the canvas. The pasted area is unchanged — it is still the
 *  mask's silhouette; what grows is how much context the model sees. */
export function zoomBox(bb: BBox, factor: number, imgW: number, imgH: number): BBox {
  const cx = (bb.x_min + bb.x_max) / 2;
  const cy = (bb.y_min + bb.y_max) / 2;
  const hw = ((bb.x_max - bb.x_min) * factor) / 2;
  const hh = ((bb.y_max - bb.y_min) * factor) / 2;
  return {
    x_min: Math.max(0, Math.round(cx - hw)), y_min: Math.max(0, Math.round(cy - hh)),
    x_max: Math.min(imgW, Math.round(cx + hw)), y_max: Math.min(imgH, Math.round(cy + hh)),
  };
}

/** Grounding DINO alone, so the boxes can be area-filtered before SAM ever sees them. */
function buildDetectGraph(imageName: string): Graph {
  return {
    nodes: {
      dino: {
        id: 'dino', type: 'grounding_dino', model: DINO_MODEL, prompt: DETAIL_TARGET,
        detection_threshold: DINO_THRESHOLD, image: { image_name: imageName },
      },
    },
    edges: [],
  };
}

/** Turn the chosen box into a silhouette mask and read back the tight bounds of that silhouette. */
function buildSegmentGraph(imageName: string, box: BBox): Graph {
  return {
    nodes: {
      sam: {
        id: 'sam', type: 'segment_anything', model: SAM_MODEL, mask_filter: 'highest_box_score',
        apply_polygon_refinement: true, image: { image_name: imageName },
        bounding_boxes: [{
          x_min: Math.round(box.x_min), y_min: Math.round(box.y_min),
          x_max: Math.round(box.x_max), y_max: Math.round(box.y_max),
        }],
      },
      m2i: { id: 'm2i', type: 'tensor_mask_to_image', is_intermediate: true },
      bbox: { id: 'bbox', type: 'get_image_mask_bounding_box', margin: DETAIL_MARGIN },
    },
    edges: [edge('sam', 'mask', 'm2i', 'mask'), edge('m2i', 'image', 'bbox', 'mask')],
  };
}

/** The re-render itself, ending in the paste back onto the full canvas.
 *
 *  Three details are load-bearing. The VAE precision comes from the model, because an SDXL model whose
 *  defaults say fp32 renders solid black through an fp16 VAE. The SAM mask is inverted with `img_lerp`
 *  rather than `image_mask_to_tensor`, which would binarize away the gradient `create_gradient_mask`
 *  needs. And `img_paste` is given no mask — passing one premultiplies and traces a dark halo along
 *  every feathered edge; the blend has already done the masking. */
function buildDetailGraph(
  model: InvokeModel, imageName: string, maskName: string, bb: BBox,
  gw: number, gh: number, params: ImageGenParams, seed: number, boardId: string,
): Graph {
  const cw = bb.x_max - bb.x_min;
  const ch = bb.y_max - bb.y_min;
  const box = { x_min: bb.x_min, y_min: bb.y_min, x_max: bb.x_max, y_max: bb.y_max };
  const fp32 = model.default_settings?.vae_precision === 'fp32';
  const isXL = model.base === 'sdxl';
  const src = { image_name: imageName };
  // The region is re-rendered against the scene's own prompt, the way ADetailer reuses the main prompt
  // when its own is left blank.
  const compel = (id: string, text: string) => (isXL
    ? { id, type: 'sdxl_compel_prompt', prompt: text, style: text, target_width: gw, target_height: gh }
    : { id, type: 'compel', prompt: text });

  const nodes: Record<string, Record<string, unknown>> = {
    crop: { id: 'crop', type: 'crop_image_to_bounding_box', bounding_box: box, image: src },
    maskcrop: { id: 'maskcrop', type: 'crop_image_to_bounding_box', bounding_box: box, image: { image_name: maskName } },
    maskinv: { id: 'maskinv', type: 'img_lerp', min: 255, max: 0 },

    // scale up to the model's optimal area
    up: { id: 'up', type: 'img_resize', width: gw, height: gh, resample_mode: 'lanczos' },
    upmask: { id: 'upmask', type: 'img_resize', width: gw, height: gh, resample_mode: 'lanczos' },

    // denoise, constrained to the mask in latent space
    loader: { id: 'loader', type: isXL ? 'sdxl_model_loader' : 'main_model_loader', model: identifier(model) },
    pos: compel('pos', params.prompt),
    neg: compel('neg', params.negativePrompt),
    noise: { id: 'noise', type: 'noise', seed, width: gw, height: gh },
    i2l: { id: 'i2l', type: 'i2l', fp32 },
    grad: {
      id: 'grad', type: 'create_gradient_mask', edge_radius: DETAIL_EDGE_RADIUS,
      coherence_mode: 'Gaussian Blur', minimum_denoise: 0, fp32,
    },
    denoise: {
      id: 'denoise', type: 'denoise_latents', steps: params.steps, cfg_scale: params.cfg,
      scheduler: toInvokeScheduler(params.sampler), denoising_start: DETAIL_START, denoising_end: 1,
    },
    l2i: { id: 'l2i', type: 'l2i', fp32 },

    // scale back down, image and blend mask alike
    down: { id: 'down', type: 'img_resize', width: cw, height: ch, resample_mode: 'lanczos' },
    fade: { id: 'fade', type: 'expand_mask_with_fade', fade_size_px: DETAIL_FEATHER },
    downmask: { id: 'downmask', type: 'img_resize', width: cw, height: ch, resample_mode: 'lanczos' },

    blend: {
      id: 'blend', type: 'invokeai_img_blend', blend_mode: 'Normal', opacity: 1.0,
      fit_to_width: true, fit_to_height: true,
    },
    paste: {
      id: 'paste', type: 'img_paste', x: bb.x_min, y: bb.y_min, crop: true, base_image: src,
      is_intermediate: false, ...boardField(boardId),
    },
  };
  // Only the paste is a real output; everything feeding it is scratch that would otherwise fill the
  // gallery with crops and masks.
  for (const [id, n] of Object.entries(nodes)) {
    if (id !== 'paste') n.is_intermediate = true;
  }

  const clip2 = isXL ? [edge('loader', 'clip2', 'pos', 'clip2'), edge('loader', 'clip2', 'neg', 'clip2')] : [];
  return {
    nodes,
    edges: [
      edge('crop', 'image', 'up', 'image'),
      edge('maskcrop', 'image', 'maskinv', 'image'), edge('maskinv', 'image', 'upmask', 'image'),
      edge('up', 'image', 'i2l', 'image'), edge('loader', 'vae', 'i2l', 'vae'),
      edge('up', 'image', 'grad', 'image'), edge('upmask', 'image', 'grad', 'mask'),
      edge('loader', 'vae', 'grad', 'vae'), edge('loader', 'unet', 'grad', 'unet'),
      edge('grad', 'denoise_mask', 'denoise', 'denoise_mask'),
      edge('loader', 'unet', 'denoise', 'unet'),
      edge('loader', 'clip', 'pos', 'clip'), edge('loader', 'clip', 'neg', 'clip'), ...clip2,
      edge('pos', 'conditioning', 'denoise', 'positive_conditioning'),
      edge('neg', 'conditioning', 'denoise', 'negative_conditioning'),
      edge('noise', 'noise', 'denoise', 'noise'), edge('i2l', 'latents', 'denoise', 'latents'),
      edge('denoise', 'latents', 'l2i', 'latents'), edge('loader', 'vae', 'l2i', 'vae'),
      edge('l2i', 'image', 'down', 'image'),
      edge('grad', 'expanded_mask_area', 'fade', 'mask'), edge('fade', 'image', 'downmask', 'image'),
      // The faded mask is already black=apply, which is the polarity invokeai_img_blend wants.
      edge('crop', 'image', 'blend', 'layer_base'), edge('down', 'image', 'blend', 'layer_upper'),
      edge('downmask', 'image', 'blend', 'mask'),
      edge('blend', 'image', 'paste', 'image'),
    ],
  };
}

/** Match a model list entry by exact key, else case-insensitive exact name (the Settings field stores the
 *  readable name). Returns undefined when nothing matches. */
export function findModel(models: InvokeModel[], ref: string): InvokeModel | undefined {
  const want = ref.trim();
  if (!want) return undefined;
  const byKey = models.find((m) => m.key === want);
  if (byKey) return byKey;
  const lower = want.toLowerCase();
  return models.find((m) => m.name.toLowerCase() === lower);
}

/** Qwen3 encoders installed for `base`, matched on `variant` — the only field that separates them. A
 *  record with no `variant` at all still trails the list rather than vanishing, so an install this doesn't
 *  recognize degrades to the old behavior instead of reporting nothing installed. */
export function encodersFor(models: InvokeModel[], base: string): InvokeModel[] {
  const all = models.filter((m) => m.type === 'qwen3_encoder');
  const want = REQUIRED_ENCODER_VARIANT[base];
  if (!want) return all;
  return [...all.filter((m) => m.variant === want), ...all.filter((m) => !m.variant)];
}

/** VAEs usable by `base`: its own first, then FLUX as the documented compatible fallback. */
export function vaesFor(models: InvokeModel[], base: string): InvokeModel[] {
  const vaes = models.filter((m) => m.type === 'vae');
  return [...vaes.filter((m) => m.base === base), ...vaes.filter((m) => m.base === 'flux')];
}

/** Label for the error messages and Settings hints — the architecture as the user sees it named. */
function baseLabel(base: string): string {
  return base === 'anima' ? 'Anima' : 'Z-Image';
}

/** Pick the Qwen3 encoder + VAE for a Z-Image or Anima model. Honors explicit refs (by name/key);
 *  otherwise auto-picks by architecture. Throws a user-actionable error when one is missing. */
export function resolveSubmodels(
  models: InvokeModel[], base: string, encoderRef: string, vaeRef: string,
): { encoder: InvokeModel; vae: InvokeModel } {
  const label = baseLabel(base);
  const encoder = (encoderRef.trim() && findModel(models, encoderRef)) || encodersFor(models, base)[0];
  if (!encoder) {
    const variant = REQUIRED_ENCODER_VARIANT[base] === 'qwen3_06b' ? 'Qwen3 0.6B' : 'Qwen3 4B';
    throw new Error(`${label} needs a ${variant} text encoder model. Install one in InvokeAI, or set the Qwen3 Encoder override.`);
  }
  const vae = (vaeRef.trim() && findModel(models, vaeRef)) || vaesFor(models, base)[0];
  if (!vae) {
    const hint = base === 'anima' ? 'a QwenImage/Wan 2.1 VAE' : 'a FLUX-type VAE (e.g. FLUX.1-schnell VAE)';
    throw new Error(`${label} needs ${hint}. Install one in InvokeAI, or set the VAE override.`);
  }
  return { encoder, vae };
}

/**
 * An InvokeAI endpoint that answered with a non-OK status. Worth its own type because the two failure
 * modes need opposite advice: a status means the server is reachable and talking (a rejected token, a
 * server-side fault), while an unreachable or CORS-blocked host arrives as a bare `TypeError`.
 */
export class InvokeHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'InvokeHttpError';
    this.status = status;
  }
}

/** Player-facing advice for a failed InvokeAI request, shared by the generation path and the Settings
 *  model list so the same failure never gets two different explanations. */
export function invokeConnectionMessage(error: unknown, endpointUrl: string): string {
  const base = trimUrl(endpointUrl);
  if (error instanceof InvokeHttpError) {
    if (error.status === 401 || error.status === 403) {
      return `InvokeAI rejected the request (HTTP ${error.status}). Check the API Token in Settings → AI Endpoints → Image.`;
    }
    return `InvokeAI answered with HTTP ${error.status} at ${base}. Check the server and its logs.`;
  }
  return `Couldn't reach InvokeAI at ${base}. Check it's running and that the app's origin is in its allow_origins (Settings → How to Set Up).`;
}

/** Fetch the model list from /api/v2/models/. */
export async function fetchInvokeModels(endpointUrl: string, apiToken?: string): Promise<InvokeModel[]> {
  const base = trimUrl(endpointUrl);
  const res = await fetch(`${base}/api/v2/models/`, { headers: authHeaders(apiToken, 'Bearer') });
  if (!res.ok) throw new InvokeHttpError(res.status);
  const body = (await res.json()) as { models?: InvokeModel[] };
  return body.models ?? [];
}

/** A gallery board as returned by /api/v1/boards/ (only the fields we use). */
export interface InvokeBoard {
  board_id: string;
  board_name: string;
  archived?: boolean;
}

/** Fetch the gallery boards. `all=true` returns the flat list rather than a paginated page. */
export async function fetchInvokeBoards(endpointUrl: string, apiToken?: string): Promise<InvokeBoard[]> {
  const base = trimUrl(endpointUrl);
  const res = await fetch(`${base}/api/v1/boards/?all=true`, { headers: authHeaders(apiToken, 'Bearer') });
  if (!res.ok) throw new InvokeHttpError(res.status);
  const body = (await res.json()) as InvokeBoard[] | { items?: InvokeBoard[] };
  return Array.isArray(body) ? body : (body.items ?? []);
}

/** Resolve the configured board reference to a board id. Accepts an id or a board name (presets written by
 *  hand are readable that way), and returns '' — Uncategorized — for blank or unknown references, since a
 *  board deleted since the preset was saved should misfile an image rather than fail the generation. */
export function resolveBoardId(boards: InvokeBoard[], ref: string): string {
  const want = ref.trim();
  if (!want) return '';
  if (boards.some((b) => b.board_id === want)) return want;
  const lower = want.toLowerCase();
  return boards.find((b) => b.board_name.toLowerCase() === lower)?.board_id ?? '';
}

export interface InvokeMeta {
  /** Main models this provider supports, for the Model dropdown. */
  models: InvokeModel[];
  /** Qwen3 encoders + FLUX VAEs, for the Z-Image override dropdowns. */
  encoders: InvokeModel[];
  vaes: InvokeModel[];
  /** Live gallery boards, for the Board dropdown (archived ones are dropped). */
  boards: InvokeBoard[];
}

/** Fetch the installed model + board lists that back the Settings dropdowns. Requires the InvokeAI CORS
 *  origin to include the app, same as generation. A boards failure doesn't sink the models. */
export async function fetchInvokeMeta(endpointUrl: string, apiToken?: string): Promise<InvokeMeta> {
  const [all, boards] = await Promise.all([
    fetchInvokeModels(endpointUrl, apiToken),
    fetchInvokeBoards(endpointUrl, apiToken).catch(() => [] as InvokeBoard[]),
  ]);
  return {
    // Encoders and VAEs stay unfiltered here: which ones are usable depends on the selected model's base,
    // which this call doesn't know. The Settings rows narrow them with `encodersFor` / `vaesFor`.
    models: all.filter((m) => m.type === 'main' && (SUPPORTED_INVOKE_BASES as readonly string[]).includes(m.base)),
    encoders: all.filter((m) => m.type === 'qwen3_encoder'),
    vaes: all.filter((m) => m.type === 'vae'),
    boards: boards.filter((b) => !b.archived),
  };
}

interface InvokeResult {
  type?: string;
  image?: { image_name?: string };
  collection?: BBox[];
  bounding_box?: BBox;
}

interface QueueItem {
  status?: string;
  error_message?: string;
  session?: {
    results?: Record<string, InvokeResult>;
    /** node id → prepared-execution ids. `results` is keyed by the latter, so this is the only way back
     *  from a node to its output when a graph emits more than one image. */
    source_prepared_mapping?: Record<string, string[]>;
  };
}

/** Pull the first output image name from a finished queue item's session results. */
export function parseImageName(item: QueueItem): string {
  const results = item.session?.results ?? {};
  for (const r of Object.values(results)) {
    if (r?.type === 'image_output' && r.image?.image_name) return r.image.image_name;
  }
  throw new Error('No image in InvokeAI queue result');
}

/** The image a *specific* node produced. The detail graph emits several, and they can't be told apart by
 *  size (the blend and the paste differ, but crops don't), so go through the prepared mapping. */
export function nodeImageName(item: QueueItem, nodeId: string): string {
  const results = item.session?.results ?? {};
  for (const ex of item.session?.source_prepared_mapping?.[nodeId] ?? []) {
    const r = results[ex];
    if (r?.type === 'image_output' && r.image?.image_name) return r.image.image_name;
  }
  throw new Error(`No image from InvokeAI node "${nodeId}"`);
}

/** Every bounding box a Grounding DINO graph returned (empty when it found nothing). */
export function parseBoxes(item: QueueItem): BBox[] {
  for (const r of Object.values(item.session?.results ?? {})) {
    if (r?.type === 'bounding_box_collection_output' && Array.isArray(r.collection)) return r.collection;
  }
  return [];
}

/** The single bounding box a mask-bounds graph returned, or null. */
export function parseBoundingBox(item: QueueItem): BBox | null {
  for (const r of Object.values(item.session?.results ?? {})) {
    if (r?.type === 'bounding_box_output' && r.bounding_box) return r.bounding_box;
  }
  return null;
}

/** Fallback progress from the queue status, used only until the socket delivers a real percentage. The
 *  status carries no step count, so `in_progress` is a small "it started" nudge, not a guess at halfway. */
function statusProgress(status: string | undefined): number {
  if (status === 'in_progress') return 0.08;
  if (status === 'completed') return 1;
  return 0.02; // queued / pending
}

/** A decoded socket.io event frame, or null for frames we don't consume. */
export function parseSocketFrame(data: string): { event: string; payload: Record<string, unknown> } | null {
  if (!data.startsWith('42')) return null;
  try {
    const parsed = JSON.parse(data.slice(2)) as unknown;
    if (!Array.isArray(parsed) || typeof parsed[0] !== 'string') return null;
    const payload = parsed[1];
    return { event: parsed[0], payload: (payload ?? {}) as Record<string, unknown> };
  } catch {
    return null; // malformed frame — progress is best-effort
  }
}

/** Running live-progress state, carried across events so a payload missing one field keeps the other. */
export interface InvokeProgressState {
  progress: number;
  preview?: string;
}

/** Fold an `invocation_progress` payload into the running state. Returns null when the event belongs to
 *  another queue item, or carries nothing new.
 *
 *  Two quirks drive the merge: a null `percentage` means indeterminate (model loading), and in single-user
 *  mode every event arrives twice — once for the owning user, once for the admin room with `image` stripped.
 *  Both cases must keep the previous value rather than clear it. */
export function readInvokeProgress(
  payload: Record<string, unknown>,
  itemId: number | null,
  prev: InvokeProgressState,
): InvokeProgressState | null {
  const event = payload as { item_id?: number; percentage?: number | null; image?: { dataURL?: string } | null };
  // Before the enqueue returns an id there is nothing to match against, so events are dropped rather
  // than adopted — otherwise the InvokeAI GUI rendering in another tab moves this run's bar.
  if (itemId == null || event.item_id !== itemId) return null;
  const percentage = typeof event.percentage === 'number' ? Math.min(1, Math.max(0, event.percentage)) : undefined;
  const dataURL = typeof event.image?.dataURL === 'string' ? event.image.dataURL : undefined;
  if (percentage === undefined && !dataURL) return null;
  return { progress: percentage ?? prev.progress, preview: dataURL ?? prev.preview };
}

/** Live progress + preview frames over InvokeAI's socket.io endpoint, spoken as raw WebSocket frames so the
 *  app needs no socket.io client. Engine.io v4 wire format: `0`=open handshake, `2`=ping (answer `3`),
 *  `40`=namespace connect (auth rides along as JSON), `42["event",payload]`=event. Best-effort and never
 *  throws — the caller still polls the queue item for the authoritative result. */
function watchInvokeProgress(
  base: string,
  itemId: () => number | null,
  opts: ImageGenOpts,
  report: (p: ImageProgress) => void,
): { live: () => boolean; close: () => void } {
  const wsUrl = `${base.replace(/^http/, 'ws')}/ws/socket.io/?EIO=4&transport=websocket`;
  let ws: WebSocket | undefined;
  let live = false; // true once a matching progress event lands — poll-based progress stands down
  let state: InvokeProgressState = { progress: 0 };

  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const data = ev.data;
      if (data.startsWith('0')) {
        // Namespace connect. InvokeAI reads the token from the socket.io auth object (headers aren't
        // settable on a browser WebSocket); single-user installs accept the connection without one.
        ws?.send(opts.apiToken ? `40${JSON.stringify({ token: opts.apiToken })}` : '40');
        return;
      }
      if (data === '2') { ws?.send('3'); return; }
      if (data.startsWith('40')) {
        ws?.send(`42${JSON.stringify(['subscribe_queue', { queue_id: 'default' }])}`);
        return;
      }
      const frame = parseSocketFrame(data);
      if (frame?.event !== 'invocation_progress') return;
      const next = readInvokeProgress(frame.payload, itemId(), state);
      if (!next) return;
      state = next;
      live = true;
      report({ progress: state.progress, preview: state.preview });
    };
  } catch {
    // No socket — the queue poll still drives a coarse bar.
  }

  return { live: () => live, close: () => { try { ws?.close(); } catch { /* already closed */ } } };
}

export const invokeaiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const base = trimUrl(opts.endpointUrl);
  const auth = authHeaders(opts.apiToken, 'Bearer');
  const jsonHeaders = { 'Content-Type': 'application/json', ...auth };

  let models: InvokeModel[];
  try {
    models = await fetchInvokeModels(opts.endpointUrl, opts.apiToken);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    // A rejected token and an unreachable host both land here and need opposite advice.
    throw new Error(invokeConnectionMessage(error, opts.endpointUrl));
  }
  const model = findModel(models, params.model);
  if (!model) {
    throw new Error(params.model.trim()
      ? `InvokeAI model not found: "${params.model}". Pick an installed model in Settings.`
      : 'InvokeAI has no default model — choose one in Settings → AI Endpoints → Image → Model.');
  }
  if (!(SUPPORTED_INVOKE_BASES as readonly string[]).includes(model.base)) {
    throw new Error(`InvokeAI provider does not support ${model.base} models yet (supports SDXL, SD1.5, Z-Image, Anima).`);
  }

  // Boards are cosmetic filing, so a failed lookup falls back to Uncategorized rather than blocking the run.
  const boardId = (opts.invokeBoard ?? '').trim()
    ? resolveBoardId(await fetchInvokeBoards(opts.endpointUrl, opts.apiToken).catch(() => []), opts.invokeBoard ?? '')
    : '';

  const prefix = PREFIXED_BASES[model.base];
  // Z-Image and Anima denoise through their own nodes, which have no `denoise_mask` input — the masked
  // second pass simply can't be expressed for them, so it's skipped rather than reported as an error.
  const detail = params.adetailer === true && !prefix;
  const seed = resolveInvokeSeed(params.seed);

  // The bar only ever moves forward: the coarse status estimate and the socket's first real percentage
  // otherwise fight (status says 8% while denoising is still at step 0). `span` maps one pass's 0..1
  // onto its slice of the whole run, so a detail pass extends the same bar instead of restarting it.
  let reported = 0;
  let span = detail ? { lo: 0, hi: 0.75 } : { lo: 0, hi: 1 };
  const report = (p: ImageProgress) => {
    reported = Math.max(reported, span.lo + p.progress * (span.hi - span.lo));
    opts.onProgress?.({ ...p, progress: reported });
  };

  report({ progress: statusProgress('queued') });

  // Subscribe before enqueuing so no early frame is missed. The watcher reads the item id through a
  // getter, so it follows each pass in turn.
  let itemId: number | null = null;
  const watcher = watchInvokeProgress(base, () => itemId, opts, report);

  /** Enqueue one graph and poll it to completion. */
  const runGraph = async (graph: Graph): Promise<QueueItem> => {
    itemId = null;
    const res = await fetch(`${base}/api/v1/queue/default/enqueue_batch`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ batch: { graph, runs: 1 }, prepend: false }),
      signal: opts.signal,
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.detail ? JSON.stringify(body.detail) : JSON.stringify(body);
      } catch { /* keep the status */ }
      throw new Error(`InvokeAI rejected the batch: ${detail}`);
    }
    const enq = (await res.json()) as { item_ids?: number[] };
    itemId = enq.item_ids?.[0] ?? null;
    if (itemId == null) throw new Error('InvokeAI did not return a queue item id');

    let consecutiveErrors = 0; // give up rather than poll a dead/erroring endpoint forever
    for (;;) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      // A rejected fetch (connection reset while the GPU box is under load) counts like a bad status —
      // the render is still running server-side, so one hiccup must not fail the whole generation.
      const poll = await fetch(`${base}/api/v1/queue/default/i/${itemId}`, { headers: auth, signal: opts.signal })
        .catch((error: unknown) => {
          if ((error as Error).name === 'AbortError') throw error;
          return null;
        });
      if (poll?.ok) {
        consecutiveErrors = 0;
        const item = (await poll.json()) as QueueItem;
        // Once the socket is feeding real per-step progress, the coarse status bar would only fight it —
        // except at 'completed', which is the only status that reports a percentage the socket can't.
        if (!watcher.live() || item.status === 'completed') {
          report({ progress: statusProgress(item.status) });
        }
        if (item.status === 'completed') return item;
        if (item.status === 'failed') throw new Error(`InvokeAI generation failed: ${item.error_message ?? 'unknown error'}`);
        if (item.status === 'canceled') throw new DOMException('Aborted', 'AbortError');
      } else if (++consecutiveErrors >= 5) {
        throw new Error(`InvokeAI stopped responding while generating${poll ? ` (HTTP ${poll.status})` : ''}.`);
      }
      // Abortable wait: resolve early the moment the run is canceled, so Stop doesn't hang for a poll cycle.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, POLL_INTERVAL_MS);
        function done() { opts.signal?.removeEventListener('abort', done); clearTimeout(timer); resolve(); }
        opts.signal?.addEventListener('abort', done, { once: true });
      });
    }
  };

  /** Detect a face, re-render it, paste it back. Returns the composite's name, or `srcName` unchanged
   *  when there is nothing to fix — a face fix that finds no face is not a failed generation. */
  const runDetailPass = async (srcName: string): Promise<string> => {
    span = { lo: 0.75, hi: 0.8 };
    const box = pickDetailBox(parseBoxes(await runGraph(buildDetectGraph(srcName))), params.width, params.height);
    if (!box) return srcName;

    const seg = await runGraph(buildSegmentGraph(srcName, box));
    const tight = parseBoundingBox(seg);
    if (!tight || tight.x_max <= tight.x_min || tight.y_max <= tight.y_min) return srcName;
    const maskName = parseImageName(seg);

    const bb = zoomBox(tight, DETAIL_ZOOM, params.width, params.height);
    // SDXL renders the crop at ~1MP, SD1.5 at ~0.26MP — its own training resolution.
    const [gw, gh] = scaledSize(bb.x_max - bb.x_min, bb.y_max - bb.y_min, model.base === 'sdxl' ? 1024 : 512, model.base);

    span = { lo: 0.8, hi: 1 };
    const item = await runGraph(buildDetailGraph(model, srcName, maskName, bb, gw, gh, params, seed, boardId));
    return nodeImageName(item, 'paste');
  };

  try {
    let graph: Graph;
    if (prefix) {
      const { encoder, vae } = resolveSubmodels(models, model.base, opts.invokeEncoder ?? '', opts.invokeVae ?? '');
      graph = buildPrefixedGraph(prefix, model, encoder, vae, params, seed, boardId);
    } else {
      graph = buildLinearGraph(model, params, seed, boardId, detail);
    }

    let name = parseImageName(await runGraph(graph));
    if (detail) {
      try {
        name = await runDetailPass(name);
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        // The base image is already rendered — losing the face fix must not lose the generation with it.
        // (It stays out of the gallery board: the paste that would have carried it never happened.)
        console.warn('[invokeai] face fix skipped:', (error as Error).message);
      }
      // Close the bar out however the pass ended: a run that found no face stops mid-span otherwise.
      span = { lo: 0, hi: 1 };
      report({ progress: 1 });
    }

    const view = await fetch(`${base}/api/v1/images/i/${encodeURIComponent(name)}/full`, { headers: auth, signal: opts.signal });
    if (!view.ok) throw new Error(`Failed to fetch image: HTTP ${view.status}`);
    const bytes = new Uint8Array(await view.arrayBuffer());
    return bytesToDataUrl(bytes, view.headers.get('content-type') || 'image/png');
  } finally {
    watcher.close();
    // Best-effort cancel so an aborted run doesn't keep cooking on the server.
    if (opts.signal?.aborted && itemId != null) {
      fetch(`${base}/api/v1/queue/default/i/${itemId}/cancel`, { method: 'PUT', headers: auth }).catch(() => {});
    }
  }
};
