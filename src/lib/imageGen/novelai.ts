// NovelAI image provider. Unlike the other cloud provider, this one fetches straight from the renderer:
// image.novelai.net answers the preflight with `access-control-allow-origin: *` and allows `Authorization`,
// so no desktop bridge is involved and the web build can use it too. POST /ai/generate-image returns a ZIP
// holding the PNG. Request shape verified against the caru-ini/novelai-sdk client.
import { unzipSync } from 'fflate';
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';
import { trimUrl, authHeaders } from './http';
import { bytesToDataUrl } from '../imageOptim';

/** A model the dropdown offers. NovelAI has no model-listing endpoint, so the list is maintained here. */
export interface NovelAIModel {
  id: string;
  label: string;
}

export const NOVELAI_MODELS: readonly NovelAIModel[] = [
  { id: 'nai-diffusion-5-full', label: 'Diffusion V5 Full' },
  { id: 'nai-diffusion-5-curated', label: 'Diffusion V5 Curated' },
  { id: 'nai-diffusion-4-5-full', label: 'Diffusion V4.5 Full' },
  { id: 'nai-diffusion-4-5-curated', label: 'Diffusion V4.5 Curated' },
  { id: 'nai-diffusion-4-full', label: 'Diffusion V4 Full' },
  { id: 'nai-diffusion-4-curated', label: 'Diffusion V4 Curated' },
  { id: 'nai-diffusion-3', label: 'Diffusion V3 (Anime)' },
  { id: 'nai-diffusion-3-furry', label: 'Diffusion V3 (Furry)' },
];

/** Values a preset switching to NovelAI starts on: one image at these settings falls inside the Opus
 *  subscription's free window (at most 1,048,576 pixels and 28 steps). */
export const NOVELAI_DEFAULTS = {
  model: 'nai-diffusion-4-5-full',
  width: 1024,
  height: 1024,
  steps: 28,
} as const;

/** NovelAI's own sampler vocabulary. */
const NOVELAI_SAMPLERS: readonly string[] = [
  'k_euler', 'k_euler_ancestral', 'k_dpm_2', 'k_dpm_2_ancestral',
  'k_dpmpp_2m', 'k_dpmpp_2s_ancestral', 'k_dpmpp_sde', 'ddim',
];

const FALLBACK_SAMPLER = 'k_euler_ancestral';

/** A1111 sampler names (lowercased) mapped onto NovelAI's. */
const SAMPLER_ALIASES: Record<string, string> = {
  'euler a': 'k_euler_ancestral',
  'euler': 'k_euler',
  'dpm2': 'k_dpm_2',
  'dpm2 a': 'k_dpm_2_ancestral',
  'dpm++ 2m': 'k_dpmpp_2m',
  'dpm++ 2m karras': 'k_dpmpp_2m',
  'dpm++ 2s a': 'k_dpmpp_2s_ancestral',
  'dpm++ sde': 'k_dpmpp_sde',
  'dpm++ sde karras': 'k_dpmpp_sde',
  'ddim': 'ddim',
};

/** Resolve a sampler name to one NovelAI accepts; anything unrecognized becomes Euler Ancestral. */
export function toNovelAISampler(name: string): string {
  const key = (name ?? '').trim().toLowerCase();
  if (NOVELAI_SAMPLERS.includes(key)) return key;
  return SAMPLER_ALIASES[key] ?? FALLBACK_SAMPLER;
}

/** V4, V4.5 and V5 take the caption-wrapped prompts; V3 takes the flat ones. */
const isV4Model = (model: string): boolean => /^nai-diffusion-(4|5)\b/.test(model);
const isV5Model = (model: string): boolean => /^nai-diffusion-5\b/.test(model);

const clamp = (n: number, min: number, max: number, dflt: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : dflt));

/** Snap a dimension to NovelAI's grid: a multiple of 64, between 64 and 1600. */
export const toNovelAIDimension = (n: number): number =>
  clamp(Math.round(clamp(n, 64, 1600, NOVELAI_DEFAULTS.width) / 64) * 64, 64, 1600, NOVELAI_DEFAULTS.width);

interface V4Caption {
  caption: { base_caption: string; char_captions: never[] };
  use_coords?: boolean;
  use_order?: boolean;
  legacy_uc?: boolean;
}

interface NovelAIParameters {
  params_version: number;
  width: number;
  height: number;
  steps: number;
  scale: number;
  sampler: string;
  n_samples: number;
  seed?: number;
  prompt?: string;
  negative_prompt: string;
  v4_prompt?: V4Caption;
  v4_negative_prompt?: V4Caption;
  qualityToggle: boolean;
  ucPreset: number;
  image_format: 'png';
  legacy: boolean;
  legacy_v3_extend: boolean;
  legacy_uc: boolean;
  dynamic_thresholding: boolean;
  use_coords: boolean;
  sm: boolean;
  sm_dyn: boolean;
  autoSmea: boolean;
  prefer_brownian: boolean;
  noise_schedule: string;
  cfg_rescale: number;
}

export interface NovelAIRequest {
  action: 'generate';
  input: string;
  model: string;
  parameters: NovelAIParameters;
}

/** Map the shared A1111-shaped params onto NovelAI's request body. */
export function buildNovelAIBody(params: ImageGenParams): NovelAIRequest {
  const model = params.model || NOVELAI_DEFAULTS.model;
  const sampler = toNovelAISampler(params.sampler);
  const parameters: NovelAIParameters = {
    params_version: isV5Model(model) ? 4 : 3,
    width: toNovelAIDimension(params.width),
    height: toNovelAIDimension(params.height),
    steps: Math.round(clamp(params.steps, 1, 50, NOVELAI_DEFAULTS.steps)),
    scale: clamp(params.cfg, 0, 10, 5),
    sampler,
    n_samples: 1,
    negative_prompt: params.negativePrompt,
    qualityToggle: true,
    ucPreset: 0,
    image_format: 'png',
    // The rest is the fixed block a working NovelAI client sends; left off, the server picks per-model
    // defaults that don't match what its own web UI produces.
    legacy: false,
    legacy_v3_extend: false,
    legacy_uc: false,
    dynamic_thresholding: false,
    use_coords: false,
    sm: false,
    sm_dyn: false,
    autoSmea: false,
    prefer_brownian: true,
    // The pairing NovelAI's own UI produces: DDIM runs on the native schedule, the k_* samplers on karras.
    noise_schedule: sampler === 'ddim' ? 'native' : 'karras',
    cfg_rescale: 0,
  };
  if (isV4Model(model)) {
    parameters.v4_prompt = {
      caption: { base_caption: params.prompt, char_captions: [] },
      use_coords: false,
      use_order: true,
    };
    parameters.v4_negative_prompt = {
      caption: { base_caption: params.negativePrompt, char_captions: [] },
      legacy_uc: false,
    };
  } else {
    parameters.prompt = params.prompt;
  }
  // A seed left off is randomized server-side, which is what -1 asks for.
  if (Number.isFinite(params.seed) && params.seed >= 0) parameters.seed = Math.round(params.seed);
  return { action: 'generate', input: params.prompt, model, parameters };
}

// "PK" covers both a local file header and the end-of-central-directory record an empty archive starts
// with; no image format opens on those two bytes.
const ZIP_MAGIC = [0x50, 0x4b];
const isZip = (bytes: Uint8Array): boolean => ZIP_MAGIC.every((b, i) => bytes[i] === b);

/** Pull the image out of a generate-image response body: a ZIP of one PNG, or bare image bytes. */
export function extractImageBytes(bytes: Uint8Array): Uint8Array {
  if (!isZip(bytes)) return bytes;
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  const name = names.find((n) => /\.png$/i.test(n)) ?? names[0];
  if (!name) throw new Error('NovelAI returned an empty archive');
  return files[name];
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'NovelAI rejected the API token. Generate a fresh persistent token in your NovelAI account settings.',
  402: 'NovelAI declined the request for lack of Anlas. Top up, or lower the resolution and steps.',
  429: 'NovelAI is already generating for this account. Wait for that image to finish, then retry.',
};

/** Whatever the server said, if it said anything readable — its errors are `{ message }` JSON. */
function errorDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // not JSON — fall through to the raw text
  }
  return trimmed.slice(0, 200);
}

/** Turn a failed response into the message the player sees. */
async function novelaiErrorMessage(res: Pick<Response, 'status' | 'text'>): Promise<string> {
  const detail = errorDetail(await res.text().catch(() => ''));
  const base = STATUS_MESSAGES[res.status] ?? `NovelAI request failed (HTTP ${res.status})`;
  return detail ? `${base} (${detail})` : base;
}

export const novelaiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const res = await fetch(`${trimUrl(opts.endpointUrl)}/ai/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(opts.apiToken, 'Bearer') },
    body: JSON.stringify(buildNovelAIBody(params)),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(await novelaiErrorMessage(res));
  return bytesToDataUrl(extractImageBytes(new Uint8Array(await res.arrayBuffer())), 'image/png');
};
