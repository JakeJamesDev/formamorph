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

/** The `board` field on an l2i node, or nothing at all — omitted means InvokeAI's Uncategorized. */
function boardField(boardId: string): { board?: { board_id: string } } {
  return boardId ? { board: { board_id: boardId } } : {};
}

/** Build the SDXL / SD1.5 linear txt2img graph. SD1.x uses main_model_loader + single-clip compel;
 *  SDXL uses sdxl_model_loader + sdxl_compel_prompt (with a duplicated style prompt). */
function buildLinearGraph(model: InvokeModel, params: ImageGenParams, boardId: string): Graph {
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
      l2i: { id: 'l2i', type: 'l2i', fp32: false, ...boardField(boardId) },
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
function buildZImageGraph(
  model: InvokeModel, encoder: InvokeModel, vae: InvokeModel, params: ImageGenParams, boardId: string,
): Graph {
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
      l2i: { id: 'l2i', type: 'z_image_l2i', ...boardField(boardId) },
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    models: all.filter((m) => m.type === 'main' && (SUPPORTED_INVOKE_BASES as readonly string[]).includes(m.base)),
    encoders: all.filter((m) => m.type === 'qwen3_encoder'),
    vaes: all.filter((m) => m.type === 'vae' && m.base === 'flux'),
    boards: boards.filter((b) => !b.archived),
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
  if (itemId != null && event.item_id !== itemId) return null;
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
    // A network/CORS failure surfaces as a bare TypeError ("Failed to fetch") — make it actionable.
    throw new Error(`Couldn't reach InvokeAI at ${base}. Check it's running and that the app's origin is in its allow_origins (Settings → How to Set Up).`);
  }
  const model = findModel(models, params.model);
  if (!model) {
    throw new Error(params.model.trim()
      ? `InvokeAI model not found: "${params.model}". Pick an installed model in Settings.`
      : 'InvokeAI has no default model — choose one in Settings → AI Endpoints → Image → Model.');
  }
  if (!(SUPPORTED_INVOKE_BASES as readonly string[]).includes(model.base)) {
    throw new Error(`InvokeAI provider does not support ${model.base} models yet (supports SDXL, SD1.5, Z-Image).`);
  }

  // Boards are cosmetic filing, so a failed lookup falls back to Uncategorized rather than blocking the run.
  const boardId = (opts.invokeBoard ?? '').trim()
    ? resolveBoardId(await fetchInvokeBoards(opts.endpointUrl, opts.apiToken).catch(() => []), opts.invokeBoard ?? '')
    : '';

  const graph = model.base === 'z-image'
    ? buildZImageGraph(model, ...(() => {
        const { encoder, vae } = resolveZImageSubmodels(models, opts.invokeEncoder ?? '', opts.invokeVae ?? '');
        return [encoder, vae] as const;
      })(), params, boardId)
    : buildLinearGraph(model, params, boardId);

  // The bar only ever moves forward: the coarse status estimate and the socket's first real percentage
  // otherwise fight (status says 8% while denoising is still at step 0).
  let reported = 0;
  const report = (p: ImageProgress) => {
    reported = Math.max(reported, p.progress);
    opts.onProgress?.({ ...p, progress: reported });
  };

  report({ progress: statusProgress('queued') });

  // Subscribe before enqueuing so no early frame is missed.
  let itemId: number | null = null;
  const watcher = watchInvokeProgress(base, () => itemId, opts, report);

  try {
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
      const poll = await fetch(`${base}/api/v1/queue/default/i/${itemId}`, { headers: auth, signal: opts.signal });
      if (poll.ok) {
        consecutiveErrors = 0;
        const item = (await poll.json()) as QueueItem;
        // Once the socket is feeding real per-step progress, the coarse status bar would only fight it —
        // except at 'completed', which is the only status that reports a percentage the socket can't.
        if (!watcher.live() || item.status === 'completed') {
          report({ progress: statusProgress(item.status) });
        }
        if (item.status === 'completed') {
          const name = parseImageName(item);
          const view = await fetch(`${base}/api/v1/images/i/${encodeURIComponent(name)}/full`, { headers: auth, signal: opts.signal });
          if (!view.ok) throw new Error(`Failed to fetch image: HTTP ${view.status}`);
          const bytes = new Uint8Array(await view.arrayBuffer());
          return bytesToDataUrl(bytes, view.headers.get('content-type') || 'image/png');
        }
        if (item.status === 'failed') throw new Error(`InvokeAI generation failed: ${item.error_message ?? 'unknown error'}`);
        if (item.status === 'canceled') throw new DOMException('Aborted', 'AbortError');
      } else if (++consecutiveErrors >= 5) {
        throw new Error(`InvokeAI stopped responding while generating (HTTP ${poll.status}).`);
      }
      // Abortable wait: resolve early the moment the run is canceled, so Stop doesn't hang for a poll cycle.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, POLL_INTERVAL_MS);
        function done() { opts.signal?.removeEventListener('abort', done); clearTimeout(timer); resolve(); }
        opts.signal?.addEventListener('abort', done, { once: true });
      });
    }
  } finally {
    watcher.close();
    // Best-effort cancel so an aborted run doesn't keep cooking on the server.
    if (opts.signal?.aborted && itemId != null) {
      fetch(`${base}/api/v1/queue/default/i/${itemId}/cancel`, { method: 'PUT', headers: auth }).catch(() => {});
    }
  }
};
