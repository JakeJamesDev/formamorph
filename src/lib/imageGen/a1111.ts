// Automatic1111 / Forge txt2img provider. The user launches the WebUI with
// `--api --cors-allow-origins=<origin>`; we POST to `${endpointUrl}/sdapi/v1/txt2img`.
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';

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
  return body;
}

/** Pull the first image out of an A1111 response and turn the bare base64 into a PNG data-URL. */
export function parseA1111Response(json: unknown): string {
  const first = (json as A1111Response)?.images?.[0];
  if (typeof first !== 'string' || !first) throw new Error('No image in A1111 response');
  // A1111 returns bare base64; some builds already prefix a data-URL — accept both.
  return first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
}

/** Strip a trailing slash so `${base}/sdapi/...` doesn't double up. */
const trimUrl = (u: string) => u.replace(/\/+$/, '');

export const a1111Provider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const res = await fetch(`${trimUrl(opts.endpointUrl)}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiToken ? { Authorization: `Basic ${opts.apiToken}` } : {}),
    },
    body: JSON.stringify(buildA1111Body(params)),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseA1111Response(await res.json());
};
