// ComfyUI provider. ComfyUI has no fixed txt2img endpoint — you POST a full node-graph to `/prompt`,
// watch a WebSocket (`/ws`) for progress + preview frames, then pull the result from `/history` → `/view`.
// The user launches ComfyUI with `--enable-cors-header` (see SettingsModal help). Direct browser fetch +
// WS, so this works in the web dev build and the desktop app (not the hosted https build — mixed content).
import { randomUUID } from "@/lib/uuid";
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';
import { bytesToDataUrl } from '../imageOptim';
import { trimUrl, authHeaders, POLL_INTERVAL_MS } from './http';

/** The canonical ComfyUI txt2img API-format graph, with %tokens% for the values we inject. Users can edit
 *  this in Settings or paste their own "Save (API Format)" export as long as the tokens are present. */
export const DEFAULT_COMFY_WORKFLOW = `{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": %seed%,
      "steps": %steps%,
      "cfg": %cfg%,
      "sampler_name": "%sampler%",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "%ckpt%" }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": { "width": %width%, "height": %height%, "batch_size": 1 }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "%prompt%", "clip": ["4", 1] }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "%negative%", "clip": ["4", 1] }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": { "filename_prefix": "Formamorph", "images": ["8", 0] }
  }
}`;

/** ComfyUI wants a concrete integer seed; -1 (our "random") becomes a fresh 15-digit int. Gameplay RNG —
 *  Math.random is fine (this is not an id). */
function resolveSeed(seed: number): number {
  return Number.isFinite(seed) && seed >= 0 ? seed : Math.floor(Math.random() * 1e15);
}

// The Sampler field is shared with A1111 (default "Euler a"), but ComfyUI uses its own lowercase names.
// Map the common A1111 names so the default preset works out of the box; anything already ComfyUI-shaped
// (or unknown) passes through unchanged.
const COMFY_SAMPLER_ALIASES: Record<string, string> = {
  'euler': 'euler',
  'euler a': 'euler_ancestral',
  'heun': 'heun',
  'dpm2': 'dpm_2',
  'dpm2 a': 'dpm_2_ancestral',
  'lms': 'lms',
  'dpm fast': 'dpm_fast',
  'dpm adaptive': 'dpm_adaptive',
  'dpm++ 2s a': 'dpmpp_2s_ancestral',
  'dpm++ 2m': 'dpmpp_2m',
  'dpm++ sde': 'dpmpp_sde',
  'dpm++ 2m sde': 'dpmpp_2m_sde',
  'dpm++ 3m sde': 'dpmpp_3m_sde',
  'ddim': 'ddim',
  'unipc': 'uni_pc',
  'lcm': 'lcm',
  'restart': 'restart',
};

/** Normalize a sampler name to ComfyUI's vocabulary: map a known A1111 name, else pass the value through
 *  (users who typed a real ComfyUI name like `dpmpp_2m` keep it verbatim). */
export function toComfySampler(name: string): string {
  const key = name.trim().toLowerCase();
  return COMFY_SAMPLER_ALIASES[key] ?? name.trim();
}

/** Substitute the %tokens% into the workflow template and parse to a graph object. String tokens replace
 *  the *quoted* form so the value is JSON-escaped safely; numeric tokens replace bare. Throws on bad JSON. */
export function buildComfyGraph(template: string, params: ImageGenParams): unknown {
  let out = template;
  const str = (token: string, value: string) => {
    out = out.split(`"%${token}%"`).join(JSON.stringify(value));
  };
  const num = (token: string, value: number) => {
    out = out.split(`%${token}%`).join(String(value));
  };
  str('prompt', params.prompt);
  str('negative', params.negativePrompt);
  str('sampler', toComfySampler(params.sampler));
  str('ckpt', params.model);
  num('width', params.width);
  num('height', params.height);
  num('steps', params.steps);
  num('cfg', params.cfg);
  num('seed', resolveSeed(params.seed));
  try {
    return JSON.parse(out);
  } catch (error) {
    throw new Error(`Invalid ComfyUI workflow JSON: ${(error as Error).message}`);
  }
}

interface ComfyImageRef {
  filename: string;
  subfolder: string;
  type: string;
}

interface ComfyHistoryEntry {
  outputs?: Record<string, { images?: ComfyImageRef[] }>;
}

/** Pull the first output image reference for a prompt out of a /history payload. */
export function parseHistoryImages(history: unknown, promptId: string): ComfyImageRef {
  const entry = (history as Record<string, ComfyHistoryEntry>)?.[promptId];
  const outputs = entry?.outputs ?? {};
  for (const node of Object.values(outputs)) {
    const img = node.images?.[0];
    if (img?.filename) return img;
  }
  throw new Error('No image in ComfyUI history');
}

/** Build a /view URL for a history image reference. */
export function viewUrl(base: string, img: ComfyImageRef): string {
  const q = new URLSearchParams({
    filename: img.filename,
    subfolder: img.subfolder ?? '',
    type: img.type ?? 'output',
  });
  return `${base}/view?${q.toString()}`;
}

/** Decode a ComfyUI binary WS frame into a preview data-URL. Layout: [4B BE event][4B BE image-type][bytes],
 *  event 1 = PREVIEW_IMAGE, image-type 1 = JPEG / 2 = PNG. Returns undefined for other event types. */
export function decodePreviewFrame(buf: ArrayBuffer): string | undefined {
  if (buf.byteLength < 8) return undefined;
  const view = new DataView(buf);
  const event = view.getUint32(0);
  if (event !== 1) return undefined; // only standard PREVIEW_IMAGE
  const mime = view.getUint32(4) === 1 ? 'image/jpeg' : 'image/png';
  return bytesToDataUrl(new Uint8Array(buf, 8), mime);
}

export interface ComfyMeta {
  checkpoints: string[];
  samplers: string[];
  schedulers: string[];
}

/** Read a node input's enum list from an /object_info payload: `info[node].input.required[field][0]`. */
function extractEnum(info: unknown, node: string, field: string): string[] {
  const required = (info as Record<string, { input?: { required?: Record<string, unknown> } }>)?.[node]?.input?.required;
  const spec = required?.[field];
  const list = Array.isArray(spec) ? spec[0] : undefined;
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [];
}

/** Fetch the installed checkpoint / sampler / scheduler lists from ComfyUI's /object_info (per-node so the
 *  payload stays small). Requires --enable-cors-header, same as generation. */
export async function fetchComfyMeta(endpointUrl: string, apiToken?: string): Promise<ComfyMeta> {
  const base = trimUrl(endpointUrl);
  const headers = authHeaders(apiToken, 'Bearer');
  const get = async (node: string): Promise<unknown> => {
    const res = await fetch(`${base}/object_info/${node}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  const [ckpt, ks] = await Promise.all([get('CheckpointLoaderSimple'), get('KSampler')]);
  return {
    checkpoints: extractEnum(ckpt, 'CheckpointLoaderSimple', 'ckpt_name'),
    samplers: extractEnum(ks, 'KSampler', 'sampler_name'),
    schedulers: extractEnum(ks, 'KSampler', 'scheduler'),
  };
}

const WS_SETTLE_MS = 3000; // if the WS never opens/signals, fall back to /history polling after this

/** Live progress + preview over the ComfyUI WebSocket. Resolves when generation for `promptId` finishes
 *  (or when the socket dies — the caller then falls back to /history polling). Best-effort; never rejects. */
function watchComfyProgress(
  base: string,
  clientId: string,
  promptId: () => string | null,
  opts: ImageGenOpts,
): { done: Promise<void>; close: () => void } {
  const wsUrl = `${base.replace(/^http/, 'ws')}/ws?clientId=${clientId}`;
  let ws: WebSocket | undefined;
  let settled = false;
  let lastProgress = 0; // carried onto preview frames so they don't reset the bar
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => { resolveDone = resolve; });
  const finish = () => { if (!settled) { settled = true; resolveDone(); } };

  try {
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        const preview = decodePreviewFrame(ev.data as ArrayBuffer);
        if (preview) opts.onProgress?.({ progress: lastProgress, preview });
        return;
      }
      try {
        const msg = JSON.parse(ev.data) as { type?: string; data?: Record<string, unknown> };
        if (msg.type === 'progress' && msg.data) {
          const value = Number(msg.data.value) || 0;
          const max = Number(msg.data.max) || 1;
          lastProgress = Math.min(1, Math.max(0, value / max));
          opts.onProgress?.({ progress: lastProgress });
        } else if (msg.type === 'executing' && msg.data?.node === null && msg.data?.prompt_id === promptId()) {
          finish();
        }
      } catch {
        // ignore malformed frames — progress is best-effort
      }
    };
    ws.onerror = finish;
    ws.onclose = finish;
  } catch {
    finish();
  }

  return { done, close: () => { finish(); try { ws?.close(); } catch { /* already closed */ } } };
}

/** Poll /history until the prompt has an output image; the authoritative result fetch. */
async function pollHistory(base: string, promptId: string, opts: ImageGenOpts): Promise<ComfyImageRef> {
  const headers = authHeaders(opts.apiToken, 'Bearer');
  for (;;) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const res = await fetch(`${base}/history/${promptId}`, { headers, signal: opts.signal });
    if (res.ok) {
      try {
        return parseHistoryImages(await res.json(), promptId);
      } catch {
        // not ready yet — keep polling
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export const comfyuiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const base = trimUrl(opts.endpointUrl);
  const clientId = randomUUID();
  const graph = buildComfyGraph((opts.workflow ?? '').trim() || DEFAULT_COMFY_WORKFLOW, params);
  const auth = authHeaders(opts.apiToken, 'Bearer');

  let promptId: string | null = null;
  const watcher = watchComfyProgress(base, clientId, () => promptId, opts);

  try {
    const res = await fetch(`${base}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ prompt: graph, client_id: clientId }),
      signal: opts.signal,
    });
    if (!res.ok) {
      // ComfyUI returns 400 with { error, node_errors } on a bad graph (e.g. missing checkpoint).
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.error?.message || body?.error || JSON.stringify(body?.node_errors ?? body);
      } catch { /* keep the status */ }
      throw new Error(`ComfyUI rejected the workflow: ${detail}`);
    }
    const submit = (await res.json()) as { prompt_id?: string };
    if (!submit.prompt_id) throw new Error('ComfyUI did not return a prompt_id');
    promptId = submit.prompt_id;

    // Wait for the WS "done" signal, but don't hang forever if the socket never connected.
    await Promise.race([
      watcher.done,
      new Promise<void>((r) => setTimeout(r, WS_SETTLE_MS)),
    ]);

    const img = await pollHistory(base, promptId, opts);
    const view = await fetch(viewUrl(base, img), { headers: auth, signal: opts.signal });
    if (!view.ok) throw new Error(`Failed to fetch image: HTTP ${view.status}`);
    const bytes = new Uint8Array(await view.arrayBuffer());
    return bytesToDataUrl(bytes, view.headers.get('content-type') || 'image/png');
  } finally {
    watcher.close();
    // Best-effort interrupt so an aborted run doesn't keep cooking on the server.
    if (opts.signal?.aborted && promptId) {
      fetch(`${base}/interrupt`, { method: 'POST', headers: auth }).catch(() => {});
    }
  }
};
