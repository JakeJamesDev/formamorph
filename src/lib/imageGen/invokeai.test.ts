import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toInvokeScheduler,
  resolveInvokeSeed,
  findModel,
  resolveZImageSubmodels,
  parseImageName,
  fetchInvokeMeta,
  invokeaiProvider,
  type InvokeModel,
} from './invokeai';
import type { ImageGenParams } from './types';

const sdxl: InvokeModel = { key: 'k-sdxl', hash: 'blake3:aa', name: 'My SDXL', base: 'sdxl', type: 'main' };
const sd1: InvokeModel = { key: 'k-sd1', hash: 'blake3:bb', name: 'Photon', base: 'sd-1', type: 'main' };
const zimg: InvokeModel = { key: 'k-z', hash: 'blake3:cc', name: 'Z Turbo', base: 'z-image', type: 'main' };
const encoder: InvokeModel = { key: 'k-enc', hash: 'blake3:dd', name: 'Qwen3 Enc', base: 'any', type: 'qwen3_encoder' };
const fluxVae: InvokeModel = { key: 'k-fvae', hash: 'blake3:ee', name: 'Flux VAE', base: 'flux', type: 'vae' };
const sdxlVae: InvokeModel = { key: 'k-svae', hash: 'blake3:ff', name: 'SDXL VAE', base: 'sdxl', type: 'vae' };

const params: ImageGenParams = {
  prompt: 'a knight',
  negativePrompt: 'blurry',
  width: 832,
  height: 1216,
  steps: 25,
  cfg: 7,
  sampler: 'Euler a',
  seed: 42,
  model: 'My SDXL',
};

describe('toInvokeScheduler', () => {
  it('maps common A1111 names to InvokeAI schedulers', () => {
    expect(toInvokeScheduler('Euler a')).toBe('euler_a');
    expect(toInvokeScheduler('Euler')).toBe('euler');
    expect(toInvokeScheduler('DPM++ 2M Karras')).toBe('dpmpp_2m_k');
  });
  it('passes an unknown name through lowercased, empty falls back to euler', () => {
    expect(toInvokeScheduler('dpmpp_3m_k')).toBe('dpmpp_3m_k');
    expect(toInvokeScheduler('')).toBe('euler');
  });
});

describe('resolveInvokeSeed', () => {
  it('keeps a concrete non-negative seed', () => {
    expect(resolveInvokeSeed(42)).toBe(42);
  });
  it('replaces -1 with a concrete non-negative integer', () => {
    const s = resolveInvokeSeed(-1);
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe('findModel', () => {
  const models = [sdxl, sd1, zimg];
  it('matches by exact key', () => expect(findModel(models, 'k-z')).toBe(zimg));
  it('matches by case-insensitive name', () => expect(findModel(models, 'my sdxl')).toBe(sdxl));
  it('returns undefined for blank or unknown', () => {
    expect(findModel(models, '')).toBeUndefined();
    expect(findModel(models, 'nope')).toBeUndefined();
  });
});

describe('resolveZImageSubmodels', () => {
  it('auto-picks the first Qwen3 encoder and a FLUX-type VAE', () => {
    const { encoder: e, vae: v } = resolveZImageSubmodels([zimg, encoder, fluxVae, sdxlVae], '', '');
    expect(e).toBe(encoder);
    expect(v).toBe(fluxVae); // FLUX vae, not the sdxl one
  });
  it('honors explicit overrides by name', () => {
    const { vae: v } = resolveZImageSubmodels([encoder, fluxVae], '', 'Flux VAE');
    expect(v).toBe(fluxVae);
  });
  it('throws a user-actionable error when the encoder is missing', () => {
    expect(() => resolveZImageSubmodels([fluxVae], '', '')).toThrow(/Qwen3 text encoder/);
  });
  it('throws a user-actionable error when a FLUX VAE is missing', () => {
    expect(() => resolveZImageSubmodels([encoder, sdxlVae], '', '')).toThrow(/FLUX-type VAE/);
  });
});

describe('parseImageName', () => {
  it('returns the first image_output result name', () => {
    const item = { session: { results: {
      a: { type: 'string_output' },
      b: { type: 'image_output', image: { image_name: 'out.png' } },
    } } };
    expect(parseImageName(item)).toBe('out.png');
  });
  it('throws when there is no image output', () => {
    expect(() => parseImageName({ session: { results: {} } })).toThrow(/No image/);
  });
});

/** Route a mocked fetch by URL+method, verifying the provider's request sequence. */
function stubServer(models: InvokeModel[], opts: { statuses?: string[]; failMsg?: string } = {}) {
  const statuses = opts.statuses ?? ['in_progress', 'completed'];
  let poll = 0;
  const enqueued: unknown[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/v2/models/')) {
      return { ok: true, json: async () => ({ models }) } as Response;
    }
    if (url.endsWith('/enqueue_batch')) {
      enqueued.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ item_ids: [7] }) } as Response;
    }
    if (url.includes('/queue/default/i/7')) {
      const status = statuses[Math.min(poll++, statuses.length - 1)];
      const body = status === 'completed'
        ? { status, session: { results: { r: { type: 'image_output', image: { image_name: 'out.png' } } } } }
        : { status, error_message: opts.failMsg };
      return { ok: true, json: async () => body } as Response;
    }
    if (url.includes('/images/i/')) {
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      } as unknown as Response;
    }
    throw new Error(`unexpected url ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { enqueued: enqueued as Array<{ batch: { graph: { nodes: Record<string, { type: string }> } } }> };
}

describe('invokeaiProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('enqueues an SDXL graph, polls to completion, and returns a data-URL', async () => {
    const server = stubServer([sdxl]);
    const progress: number[] = [];
    const url = await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', onProgress: (p) => progress.push(p.progress),
    });
    expect(url).toMatch(/^data:image\/png;base64,/);
    const nodes = server.enqueued[0].batch.graph.nodes;
    const types = Object.values(nodes).map((n) => n.type);
    expect(types).toContain('sdxl_model_loader');
    expect(types).toContain('sdxl_compel_prompt');
    expect(types).toContain('denoise_latents');
    expect(progress.at(-1)).toBe(1);
  });

  it('builds the SD1.5 linear graph with main_model_loader + compel', async () => {
    const server = stubServer([sd1]);
    await invokeaiProvider({ ...params, model: 'Photon' }, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    const types = Object.values(server.enqueued[0].batch.graph.nodes).map((n) => n.type);
    expect(types).toContain('main_model_loader');
    expect(types).toContain('compel');
    expect(types).not.toContain('sdxl_model_loader');
  });

  it('builds the Z-Image graph with auto-picked submodels', async () => {
    const server = stubServer([zimg, encoder, fluxVae]);
    await invokeaiProvider({ ...params, model: 'Z Turbo' }, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    const nodes = server.enqueued[0].batch.graph.nodes as Record<string, { type: string; qwen3_encoder_model?: { key: string }; vae_model?: { key: string } }>;
    const types = Object.values(nodes).map((n) => n.type);
    expect(types).toContain('z_image_model_loader');
    expect(types).toContain('z_image_denoise');
    expect(nodes.loader.qwen3_encoder_model?.key).toBe('k-enc');
    expect(nodes.loader.vae_model?.key).toBe('k-fvae');
  });

  it('throws when the requested model is not installed', async () => {
    stubServer([sdxl]);
    await expect(invokeaiProvider({ ...params, model: 'ghost' }, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' }))
      .rejects.toThrow(/not found/);
  });

  it('throws with the server error message on a failed item', async () => {
    stubServer([sdxl], { statuses: ['failed'], failMsg: 'out of memory' });
    await expect(invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' }))
      .rejects.toThrow(/out of memory/);
  });

  it('gives an actionable message when the server is unreachable (CORS/network)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' }))
      .rejects.toThrow(/allow_origins/);
  });

  it('stops polling instead of hanging when the item endpoint keeps erroring', async () => {
    // enqueue succeeds, then every poll returns a non-OK response.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v2/models/')) return { ok: true, json: async () => ({ models: [sdxl] }) } as Response;
      if (url.endsWith('/enqueue_batch')) return { ok: true, json: async () => ({ item_ids: [7] }) } as Response;
      return { ok: false, status: 500 } as Response; // poll always fails
    }));
    await expect(invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' }))
      .rejects.toThrow(/stopped responding/);
  }, 10000);
});

describe('fetchInvokeMeta', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('filters to supported main models, Qwen3 encoders, and FLUX VAEs', async () => {
    const all = [sdxl, sd1, zimg, encoder, fluxVae, sdxlVae, { ...sdxl, key: 'flux1', name: 'Flux', base: 'flux', type: 'main' }];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ models: all }) } as Response)));
    const meta = await fetchInvokeMeta('http://127.0.0.1:9090');
    expect(meta.models.map((m) => m.name)).toEqual(['My SDXL', 'Photon', 'Z Turbo']); // flux main excluded
    expect(meta.encoders).toEqual([encoder]);
    expect(meta.vaes).toEqual([fluxVae]); // sdxl vae excluded
  });
});
