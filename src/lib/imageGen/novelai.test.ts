import { describe, it, expect, vi, afterEach } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  NOVELAI_DEFAULTS,
  buildNovelAIBody,
  toNovelAISampler,
  toNovelAIDimension,
  extractImageBytes,
  novelaiProvider,
} from './novelai';
import type { ImageGenParams } from './types';

const params: ImageGenParams = {
  prompt: 'a knight, shiny armor',
  negativePrompt: 'blurry',
  width: 1024,
  height: 1024,
  steps: 28,
  cfg: 5,
  sampler: 'Euler a',
  seed: 42,
  model: 'nai-diffusion-4-5-full',
};

const ENDPOINT = 'https://image.novelai.net';

/** A one-entry ZIP the way the API sends it back. */
const zipOf = (name: string, body: string): Uint8Array => zipSync({ [name]: strToU8(body) });

/** An ArrayBuffer holding exactly `bytes` (a fflate view can sit inside a larger buffer). */
const bufferOf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

describe('toNovelAISampler', () => {
  it('maps common A1111 names onto NovelAI names', () => {
    expect(toNovelAISampler('Euler a')).toBe('k_euler_ancestral');
    expect(toNovelAISampler('Euler')).toBe('k_euler');
    expect(toNovelAISampler('DPM++ 2M')).toBe('k_dpmpp_2m');
    expect(toNovelAISampler('DPM++ SDE Karras')).toBe('k_dpmpp_sde');
    expect(toNovelAISampler('DDIM')).toBe('ddim');
  });

  it('passes a name already in NovelAI vocabulary through', () => {
    expect(toNovelAISampler('k_dpmpp_2s_ancestral')).toBe('k_dpmpp_2s_ancestral');
  });

  it('falls back to Euler Ancestral for an unknown or empty name', () => {
    expect(toNovelAISampler('dpmpp_3m_sde_gpu')).toBe('k_euler_ancestral');
    expect(toNovelAISampler('')).toBe('k_euler_ancestral');
  });
});

describe('toNovelAIDimension', () => {
  it('rounds to the nearest multiple of 64', () => {
    expect(toNovelAIDimension(830)).toBe(832);
    expect(toNovelAIDimension(1000)).toBe(1024);
    expect(toNovelAIDimension(1024)).toBe(1024);
  });

  it('clamps to NovelAI 64..1600 range', () => {
    expect(toNovelAIDimension(9000)).toBe(1600);
    expect(toNovelAIDimension(10)).toBe(64);
  });

  it('falls back to the default width when handed a non-number', () => {
    expect(toNovelAIDimension(Number.NaN)).toBe(NOVELAI_DEFAULTS.width);
  });
});

describe('buildNovelAIBody', () => {
  it('sends the prompt as `input` and wraps both prompts as V4 captions on a V4.5 model', () => {
    const body = buildNovelAIBody(params);
    expect(body.action).toBe('generate');
    expect(body.input).toBe('a knight, shiny armor');
    expect(body.model).toBe('nai-diffusion-4-5-full');
    expect(body.parameters.v4_prompt?.caption.base_caption).toBe('a knight, shiny armor');
    expect(body.parameters.v4_negative_prompt?.caption.base_caption).toBe('blurry');
    expect(body.parameters.negative_prompt).toBe('blurry');
    // V4+ takes its positive prompt only through the caption wrapper.
    expect(body.parameters.prompt).toBeUndefined();
    expect(body.parameters.params_version).toBe(3);
  });

  it('sends the flat prompt and no captions on a V3 model', () => {
    const body = buildNovelAIBody({ ...params, model: 'nai-diffusion-3' });
    expect(body.parameters.prompt).toBe('a knight, shiny armor');
    expect(body.parameters.v4_prompt).toBeUndefined();
    expect(body.parameters.v4_negative_prompt).toBeUndefined();
  });

  it('bumps params_version to 4 on a V5 model', () => {
    expect(buildNovelAIBody({ ...params, model: 'nai-diffusion-5-full' }).parameters.params_version).toBe(4);
    expect(buildNovelAIBody({ ...params, model: 'nai-diffusion-5-curated' }).parameters.v4_prompt).toBeDefined();
  });

  it('falls back to the default model when the preset has none', () => {
    expect(buildNovelAIBody({ ...params, model: '' }).model).toBe(NOVELAI_DEFAULTS.model);
  });

  it('rounds the size to NovelAI multiples and clamps steps and scale', () => {
    const body = buildNovelAIBody({ ...params, width: 830, height: 1700, steps: 80, cfg: 15 });
    expect(body.parameters.width).toBe(832);
    expect(body.parameters.height).toBe(1600);
    expect(body.parameters.steps).toBe(50);
    expect(body.parameters.scale).toBe(10);
    expect(buildNovelAIBody({ ...params, cfg: -3 }).parameters.scale).toBe(0);
  });

  it('omits the seed on -1 so the server randomizes, and passes a real one through', () => {
    expect(buildNovelAIBody({ ...params, seed: -1 }).parameters).not.toHaveProperty('seed');
    expect(buildNovelAIBody({ ...params, seed: 42 }).parameters.seed).toBe(42);
  });

  it('pairs the noise schedule with the sampler the way NovelAI does', () => {
    expect(buildNovelAIBody({ ...params, sampler: 'DDIM' }).parameters.noise_schedule).toBe('native');
    expect(buildNovelAIBody({ ...params, sampler: 'Euler a' }).parameters.noise_schedule).toBe('karras');
    expect(buildNovelAIBody({ ...params, sampler: 'DPM++ 2M' }).parameters.noise_schedule).toBe('karras');
  });

  it('asks for exactly one PNG', () => {
    const body = buildNovelAIBody(params);
    expect(body.parameters.n_samples).toBe(1);
    expect(body.parameters.image_format).toBe('png');
  });
});

describe('extractImageBytes', () => {
  it('unpacks the image out of the ZIP the API returns', () => {
    const out = extractImageBytes(zipOf('image_0.png', 'PNGBYTES'));
    expect(new TextDecoder().decode(out)).toBe('PNGBYTES');
  });

  it('prefers the image entry when the archive carries others', () => {
    const zip = zipSync({ 'metadata.json': strToU8('{}'), 'image_0.png': strToU8('PNGBYTES') });
    expect(new TextDecoder().decode(extractImageBytes(zip))).toBe('PNGBYTES');
  });

  it('falls back to the first entry rather than matching a non-PNG image name', () => {
    const zip = zipSync({ 'metadata.json': strToU8('{}'), 'image_0.webp': strToU8('WEBPBYTES') });
    expect(new TextDecoder().decode(extractImageBytes(zip))).toBe('{}');
  });

  it('passes bare image bytes through when the body is not a ZIP', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    expect(extractImageBytes(png)).toEqual(png);
  });

  it('throws on an empty archive', () => {
    expect(() => extractImageBytes(zipSync({}))).toThrow(/empty archive/);
  });
});

describe('novelaiProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubOk = () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: async () => bufferOf(zipOf('image_0.png', 'PNGBYTES')),
      } as unknown as Response);
    });
    return calls;
  };

  const stubFail = (status: number, body: string) => {
    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: false,
      status,
      text: async () => body,
    } as unknown as Response));
  };

  it('posts to /ai/generate-image with a Bearer token and returns a PNG data-URL', async () => {
    const calls = stubOk();
    const url = await novelaiProvider(params, { endpointUrl: `${ENDPOINT}/`, apiToken: 'pst-abc' });
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(calls[0].url).toBe(`${ENDPOINT}/ai/generate-image`);
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer pst-abc');
    expect(JSON.parse(calls[0].init.body as string).model).toBe('nai-diffusion-4-5-full');
  });

  it('carries the abort signal into the request and rejects when it fires', async () => {
    let seen: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      seen = init.signal;
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const controller = new AbortController();
    const pending = novelaiProvider(params, { endpointUrl: ENDPOINT, apiToken: 't', signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow(/Aborted/);
    expect(seen).toBe(controller.signal);
  });

  it('explains an invalid token on 401, quoting the server', async () => {
    stubFail(401, JSON.stringify({ statusCode: 401, message: 'Invalid accessToken.' }));
    await expect(novelaiProvider(params, { endpointUrl: ENDPOINT, apiToken: 'bad' }))
      .rejects.toThrow(/token[\s\S]*Invalid accessToken\./i);
  });

  it('explains an Anlas shortfall on 402', async () => {
    stubFail(402, '');
    await expect(novelaiProvider(params, { endpointUrl: ENDPOINT, apiToken: 't' })).rejects.toThrow(/Anlas/);
  });

  it('explains the concurrent-generation limit on 429', async () => {
    stubFail(429, '');
    await expect(novelaiProvider(params, { endpointUrl: ENDPOINT, apiToken: 't' }))
      .rejects.toThrow(/already generating/i);
  });

  it('surfaces the status and body for any other failure', async () => {
    stubFail(500, 'upstream exploded');
    await expect(novelaiProvider(params, { endpointUrl: ENDPOINT, apiToken: 't' }))
      .rejects.toThrow(/500[\s\S]*upstream exploded/);
  });
});
