// InvokeAI provider. InvokeAI is graph + queue based like ComfyUI, but its node graph is its own
// invocation schema and is architecture-specific: SDXL/SD1.5 share a linear graph, Z-Image uses a
// different node set. We build the graph programmatically from the resolved model's `base` rather than
// from one editable template. Flow: enqueue a batch to /queue/default/enqueue_batch, poll the queue item
// for completion, then fetch the output image by name. Verified against InvokeAI 6.13.6.
//
// The user launches InvokeAI headless (`invokeai-web`, default port 9090) and adds the app's origin to
// `allow_origins` in invokeai.yaml so the browser fetch passes CORS (see SettingsModal help). Direct
// fetch + poll, so this works in the web dev build and the desktop app (not the hosted https build —
// mixed content).
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';
import { bytesToDataUrl } from '../imageOptim';
import { trimUrl, authHeaders, POLL_INTERVAL_MS } from './http';

/** Model bases this provider can build a graph for. */
export type InvokeBase = 'sdxl' | 'sd-1' | 'sd-2' | 'z-image';
export const SUPPORTED_INVOKE_BASES: readonly InvokeBase[] = ['sdxl', 'sd-1', 'sd-2', 'z-image'];

/** A model record as returned by /api/v2/models/ (only the fields we use). */
export interface InvokeModel {
  key: string;
  hash: string;
  name: string;
  base: string;
  type: string;
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

/** Normalize a sampler name to an InvokeAI scheduler: map a known A1111 name, else pass through lowercased. */
export function toInvokeScheduler(name: string): string {
  const key = name.trim().toLowerCase();
  return INVOKE_SCHEDULER_ALIASES[key] ?? (key || 'euler');
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

/** Build the SDXL / SD1.5 linear txt2img graph. SD1.x uses main_model_loader + single-clip compel;
 *  SDXL uses sdxl_model_loader + sdxl_compel_prompt (with a duplicated style prompt). */
function buildLinearGraph(model: InvokeModel, params: ImageGenParams): Graph {
  const isXL = model.base === 'sdxl';
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
      noise: { id: 'noise', type: 'noise', seed: resolveInvokeSeed(params.seed), width: params.width, height: params.height },
      denoise: {
        id: 'denoise', type: 'denoise_latents', steps: params.steps, cfg_scale: params.cfg,
        denoising_start: 0, denoising_end: 1, scheduler: toInvokeScheduler(params.sampler),
      },
      l2i: { id: 'l2i', type: 'l2i', fp32: false },
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

/** Build the Z-Image txt2img graph. Z-Image has no separate noise node (denoise carries width/height/
 *  seed) and needs two extra submodels wired into the loader: a Qwen3 text encoder and a FLUX-type VAE. */
function buildZImageGraph(model: InvokeModel, encoder: InvokeModel, vae: InvokeModel, params: ImageGenParams): Graph {
  return {
    nodes: {
      loader: {
        id: 'loader', type: 'z_image_model_loader', model: identifier(model),
        qwen3_encoder_model: identifier(encoder), vae_model: identifier(vae),
      },
      pos: { id: 'pos', type: 'z_image_text_encoder', prompt: params.prompt },
      neg: { id: 'neg', type: 'z_image_text_encoder', prompt: params.negativePrompt },
      denoise: {
        id: 'denoise', type: 'z_image_denoise', width: params.width, height: params.height,
        steps: params.steps, seed: resolveInvokeSeed(params.seed), guidance_scale: params.cfg,
        denoising_start: 0, denoising_end: 1, scheduler: toInvokeScheduler(params.sampler),
      },
      l2i: { id: 'l2i', type: 'z_image_l2i' },
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

/** Pick a Z-Image Qwen3 encoder + FLUX-type VAE. Honors explicit refs (by name/key); otherwise auto-picks
 *  the first Qwen3 encoder and the first FLUX-based VAE (verified compatible — a FluxAutoEncoder). Throws a
 *  user-actionable error when a required submodel is missing. */
export function resolveZImageSubmodels(
  models: InvokeModel[], encoderRef: string, vaeRef: string,
): { encoder: InvokeModel; vae: InvokeModel } {
  const encoder = (encoderRef.trim() && findModel(models, encoderRef))
    || models.find((m) => m.type === 'qwen3_encoder');
  if (!encoder) {
    throw new Error('Z-Image needs a Qwen3 text encoder model. Install one in InvokeAI, or set the Qwen3 Encoder override.');
  }
  const vae = (vaeRef.trim() && findModel(models, vaeRef))
    || models.find((m) => m.type === 'vae' && m.base === 'flux');
  if (!vae) {
    throw new Error('Z-Image needs a FLUX-type VAE (e.g. FLUX.1-schnell VAE). Install one in InvokeAI, or set the VAE override.');
  }
  return { encoder, vae };
}

/** Fetch the model list from /api/v2/models/. */
export async function fetchInvokeModels(endpointUrl: string, apiToken?: string): Promise<InvokeModel[]> {
  const base = trimUrl(endpointUrl);
  const res = await fetch(`${base}/api/v2/models/`, { headers: authHeaders(apiToken, 'Bearer') });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { models?: InvokeModel[] };
  return body.models ?? [];
}

export interface InvokeMeta {
  /** Main models this provider supports, for the Model dropdown. */
  models: InvokeModel[];
  /** Qwen3 encoders + FLUX VAEs, for the Z-Image override dropdowns. */
  encoders: InvokeModel[];
  vaes: InvokeModel[];
}

/** Fetch the installed model lists that back the Settings dropdowns. Requires the InvokeAI CORS origin to
 *  include the app, same as generation. */
export async function fetchInvokeMeta(endpointUrl: string, apiToken?: string): Promise<InvokeMeta> {
  const all = await fetchInvokeModels(endpointUrl, apiToken);
  return {
    models: all.filter((m) => m.type === 'main' && (SUPPORTED_INVOKE_BASES as readonly string[]).includes(m.base)),
    encoders: all.filter((m) => m.type === 'qwen3_encoder'),
    vaes: all.filter((m) => m.type === 'vae' && m.base === 'flux'),
  };
}

interface QueueItem {
  status?: string;
  error_message?: string;
  session?: { results?: Record<string, { type?: string; image?: { image_name?: string } }> };
}

/** Pull the first output image name from a finished queue item's session results. */
export function parseImageName(item: QueueItem): string {
  const results = item.session?.results ?? {};
  for (const r of Object.values(results)) {
    if (r?.type === 'image_output' && r.image?.image_name) return r.image.image_name;
  }
  throw new Error('No image in InvokeAI queue result');
}

/** Coarse progress from the queue status — InvokeAI streams fine-grained progress over socket.io, which
 *  the v1 provider doesn't subscribe to; poll-based status maps to a rough bar. */
function statusProgress(status: string | undefined): number {
  if (status === 'in_progress') return 0.5;
  if (status === 'completed') return 1;
  return 0.05; // queued / pending
}

export const invokeaiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const base = trimUrl(opts.endpointUrl);
  const auth = authHeaders(opts.apiToken, 'Bearer');
  const jsonHeaders = { 'Content-Type': 'application/json', ...auth };

  const models = await fetchInvokeModels(opts.endpointUrl, opts.apiToken);
  const model = findModel(models, params.model);
  if (!model) {
    throw new Error(params.model.trim()
      ? `InvokeAI model not found: "${params.model}". Pick an installed model in Settings.`
      : 'InvokeAI has no default model — choose one in Settings → Image Gen → Model.');
  }
  if (!(SUPPORTED_INVOKE_BASES as readonly string[]).includes(model.base)) {
    throw new Error(`InvokeAI provider does not support ${model.base} models yet (supports SDXL, SD1.5, Z-Image).`);
  }

  const graph = model.base === 'z-image'
    ? buildZImageGraph(model, ...(() => {
        const { encoder, vae } = resolveZImageSubmodels(models, opts.invokeEncoder ?? '', opts.invokeVae ?? '');
        return [encoder, vae] as const;
      })(), params)
    : buildLinearGraph(model, params);

  opts.onProgress?.({ progress: statusProgress('queued') });

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
  const itemId = enq.item_ids?.[0];
  if (itemId == null) throw new Error('InvokeAI did not return a queue item id');

  try {
    for (;;) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const poll = await fetch(`${base}/api/v1/queue/default/i/${itemId}`, { headers: auth, signal: opts.signal });
      if (poll.ok) {
        const item = (await poll.json()) as QueueItem;
        opts.onProgress?.({ progress: statusProgress(item.status) });
        if (item.status === 'completed') {
          const name = parseImageName(item);
          const view = await fetch(`${base}/api/v1/images/i/${encodeURIComponent(name)}/full`, { headers: auth, signal: opts.signal });
          if (!view.ok) throw new Error(`Failed to fetch image: HTTP ${view.status}`);
          const bytes = new Uint8Array(await view.arrayBuffer());
          return bytesToDataUrl(bytes, view.headers.get('content-type') || 'image/png');
        }
        if (item.status === 'failed') throw new Error(`InvokeAI generation failed: ${item.error_message ?? 'unknown error'}`);
        if (item.status === 'canceled') throw new DOMException('Aborted', 'AbortError');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  } finally {
    // Best-effort cancel so an aborted run doesn't keep cooking on the server.
    if (opts.signal?.aborted) {
      fetch(`${base}/api/v1/queue/default/i/${itemId}/cancel`, { method: 'PUT', headers: auth }).catch(() => {});
    }
  }
};
