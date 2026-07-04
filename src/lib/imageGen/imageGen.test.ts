import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildA1111Body, parseA1111Response, parseProgress, a1111Provider } from './a1111';
import { nearestOpenAISize, parseOpenAIResponse } from './openai';
import { generateImage, resolveImageEndpoint } from './index';
import type { ImageGenParams } from './types';

const params: ImageGenParams = {
  prompt: 'a knight',
  negativePrompt: 'blurry',
  width: 768,
  height: 512,
  steps: 25,
  cfg: 7,
  sampler: 'Euler a',
  seed: -1,
  model: '',
};

describe('buildA1111Body', () => {
  it('maps common params onto A1111 field names', () => {
    const body = buildA1111Body(params);
    expect(body).toMatchObject({
      prompt: 'a knight',
      negative_prompt: 'blurry',
      width: 768,
      height: 512,
      steps: 25,
      cfg_scale: 7,
      sampler_name: 'Euler a',
      seed: -1,
      batch_size: 1,
      n_iter: 1,
    });
  });

  it('omits override_settings when no model is set, includes it when present', () => {
    expect(buildA1111Body(params).override_settings).toBeUndefined();
    expect(buildA1111Body({ ...params, model: 'sdxl.safetensors' }).override_settings).toEqual({
      sd_model_checkpoint: 'sdxl.safetensors',
    });
  });

  it('coerces a non-finite seed to -1 (random)', () => {
    expect(buildA1111Body({ ...params, seed: NaN }).seed).toBe(-1);
  });

  it('omits alwayson_scripts unless ADetailer is enabled', () => {
    expect(buildA1111Body(params).alwayson_scripts).toBeUndefined();
    expect(buildA1111Body({ ...params, adetailer: false }).alwayson_scripts).toBeUndefined();
  });

  it('adds the ADetailer alwayson_scripts block when enabled', () => {
    const body = buildA1111Body({ ...params, adetailer: true });
    expect(body.alwayson_scripts?.ADetailer.args[0]).toBe(true);
    expect(body.alwayson_scripts?.ADetailer.args[2]).toHaveProperty('ad_model');
  });
});

describe('parseA1111Response', () => {
  it('prefixes a bare base64 image with a PNG data-URL', () => {
    expect(parseA1111Response({ images: ['QUJD'] })).toBe('data:image/png;base64,QUJD');
  });

  it('passes through an already-prefixed data-URL', () => {
    const url = 'data:image/png;base64,QUJD';
    expect(parseA1111Response({ images: [url] })).toBe(url);
  });

  it('throws when no image is present', () => {
    expect(() => parseA1111Response({ images: [] })).toThrow();
    expect(() => parseA1111Response({})).toThrow();
  });
});

describe('parseProgress', () => {
  it('passes through progress and clamps out-of-range values', () => {
    expect(parseProgress({ progress: 0.42 }).progress).toBe(0.42);
    expect(parseProgress({ progress: 1.5 }).progress).toBe(1);
    expect(parseProgress({ progress: -0.2 }).progress).toBe(0);
    expect(parseProgress({}).progress).toBe(0);
  });

  it('turns a bare current_image into a PNG data-URL, passes through a prefixed one', () => {
    expect(parseProgress({ progress: 0.5, current_image: 'QUJD' }).preview).toBe('data:image/png;base64,QUJD');
    expect(parseProgress({ progress: 0.5, current_image: 'data:image/png;base64,QUJD' }).preview).toBe('data:image/png;base64,QUJD');
  });

  it('leaves preview undefined when there is no current_image', () => {
    expect(parseProgress({ progress: 0.5, current_image: null }).preview).toBeUndefined();
    expect(parseProgress({ progress: 0.5 }).preview).toBeUndefined();
  });
});

describe('a1111Provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs to /sdapi/v1/txt2img (trimming a trailing slash) and returns a data-URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ images: ['QUJD'] }) });
    vi.stubGlobal('fetch', fetchMock);
    const out = await a1111Provider(params, { endpointUrl: 'http://127.0.0.1:7860/', apiToken: '' });
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:7860/sdapi/v1/txt2img', expect.objectContaining({ method: 'POST' }));
    expect(out).toBe('data:image/png;base64,QUJD');
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(a1111Provider(params, { endpointUrl: 'http://x', apiToken: '' })).rejects.toThrow('HTTP 500');
  });
});

describe('nearestOpenAISize', () => {
  it('maps aspect to the nearest allowed size', () => {
    expect(nearestOpenAISize(1024, 1024)).toBe('1024x1024');
    expect(nearestOpenAISize(1536, 512)).toBe('1536x1024'); // landscape
    expect(nearestOpenAISize(512, 1536)).toBe('1024x1536'); // portrait
  });
});

describe('parseOpenAIResponse', () => {
  it('prefers inline base64 → PNG data-URL', () => {
    expect(parseOpenAIResponse({ data: [{ b64_json: 'QUJD' }] })).toBe('data:image/png;base64,QUJD');
  });
  it('falls back to a url', () => {
    expect(parseOpenAIResponse({ data: [{ url: 'https://x/y.png' }] })).toBe('https://x/y.png');
  });
  it('throws when empty', () => {
    expect(() => parseOpenAIResponse({ data: [] })).toThrow();
  });
});

describe('generateImage dispatcher', () => {
  it('routes to the a1111 provider', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ images: ['QUJD'] }) });
    vi.stubGlobal('fetch', fetchMock);
    const out = await generateImage('a1111', params, { endpointUrl: 'http://x', apiToken: '' });
    expect(out).toBe('data:image/png;base64,QUJD');
    vi.unstubAllGlobals();
  });

  it('rejects a cloud provider with a desktop-only message when unavailable', async () => {
    await expect(generateImage('openai', params, { endpointUrl: 'http://x', apiToken: '' })).rejects.toThrow(/desktop app/);
  });
});

describe('resolveImageEndpoint', () => {
  it('falls back to the provider default when the endpoint is blank', () => {
    expect(resolveImageEndpoint('a1111', '')).toBe('http://127.0.0.1:7860');
    expect(resolveImageEndpoint('comfyui', '   ')).toBe('http://127.0.0.1:8188');
    expect(resolveImageEndpoint('openai', '')).toBe(''); // cloud has no local default
  });

  it('uses the entered endpoint when provided', () => {
    expect(resolveImageEndpoint('comfyui', 'http://192.168.0.5:8188')).toBe('http://192.168.0.5:8188');
  });
});
