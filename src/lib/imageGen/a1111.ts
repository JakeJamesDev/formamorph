// Automatic1111 / Forge txt2img provider. The user launches the WebUI with
// `--api --cors-allow-origins=<origin>`; we POST to `${endpointUrl}/sdapi/v1/txt2img`.
import type { ImageGenOpts, ImageGenParams, ImageProgress, ImageProvider } from './types';
import { trimUrl, authHeaders, toPngDataUrl, POLL_INTERVAL_MS } from './http';

interface A1111Body {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  sampler_name: string;
  seed: number;
  batch_size: number;
  n_iter: number;
  send_images: boolean;
  override_settings?: { sd_model_checkpoint: string };
  alwayson_scripts?: { ADetailer: { args: [boolean, boolean, { ad_model: string }] } };
}

interface A1111Response {
  images?: string[]; // bare base64 PNGs (no data: prefix)
}

/** Map the common params onto A1111's txt2img body. A model name switches the checkpoint via override_settings. */
export function buildA1111Body(params: ImageGenParams): A1111Body {
  const body: A1111Body = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    steps: params.steps,
    cfg_scale: params.cfg,
    sampler_name: params.sampler,
    seed: Number.isFinite(params.seed) ? params.seed : -1,
    batch_size: 1,
    n_iter: 1,
    send_images: true,
  };
  if (params.model) body.override_settings = { sd_model_checkpoint: params.model };
  // ADetailer runs a second face/hand inpainting pass. Requires the extension on the server.
  if (params.adetailer) body.alwayson_scripts = { ADetailer: { args: [true, false, { ad_model: 'face_yolov8n.pt' }] } };
  return body;
}

/** Pull the first image out of an A1111 response and turn the bare base64 into a PNG data-URL. */
export function parseA1111Response(json: unknown): string {
  const first = (json as A1111Response)?.images?.[0];
  if (typeof first !== 'string' || !first) throw new Error('No image in A1111 response');
  // A1111 returns bare base64; some builds already prefix a data-URL — accept both.
  return toPngDataUrl(first);
}

interface A1111Progress {
  progress?: number;
  current_image?: string | null;
}

/** Map an A1111 /progress response to our shape: clamp progress, turn the live frame into a data-URL. */
export function parseProgress(json: unknown): ImageProgress {
  const p = json as A1111Progress;
  const progress = Math.min(1, Math.max(0, typeof p?.progress === 'number' ? p.progress : 0));
  const img = p?.current_image;
  const preview = img ? toPngDataUrl(img) : undefined;
  return { progress, preview };
}

/** Best-effort progress polling for A1111. Recursive setTimeout so polls never overlap; stops on abort or
 *  when `.stop()` is called; swallows all errors (progress is non-critical). */
function startProgressPoller(base: string, opts: ImageGenOpts): { stop: () => void } {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const headers = authHeaders(opts.apiToken, 'Basic');
  const tick = async () => {
    if (stopped || opts.signal?.aborted) return;
    try {
      const res = await fetch(`${base}/sdapi/v1/progress?skip_current_image=false`, { headers, signal: opts.signal });
      if (res.ok && !stopped) opts.onProgress?.(parseProgress(await res.json()));
    } catch {
      // ignore — progress is best-effort
    }
    if (!stopped && !opts.signal?.aborted) timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  timer = setTimeout(tick, POLL_INTERVAL_MS);
  return { stop: () => { stopped = true; if (timer) clearTimeout(timer); } };
}

export const a1111Provider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const base = trimUrl(opts.endpointUrl);
  const poller = opts.onProgress ? startProgressPoller(base, opts) : undefined;
  try {
    const res = await fetch(`${base}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(opts.apiToken, 'Basic') },
      body: JSON.stringify(buildA1111Body(params)),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseA1111Response(await res.json());
  } finally {
    poller?.stop();
  }
};
