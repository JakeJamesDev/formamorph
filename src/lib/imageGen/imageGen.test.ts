import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildA1111Body, parseA1111Response, a1111Provider } from './a1111';
import { nearestOpenAISize, parseOpenAIResponse } from './openai';
import { generateImage } from './index';
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
