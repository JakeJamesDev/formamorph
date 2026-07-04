import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_COMFY_WORKFLOW,
  buildComfyGraph,
  parseHistoryImages,
  viewUrl,
  decodePreviewFrame,
  toComfySampler,
  fetchComfyMeta,
} from './comfyui';
import type { ImageGenParams } from './types';

const params: ImageGenParams = {
  prompt: 'a knight, "shiny" armor\nby a river',
  negativePrompt: 'blurry',
  width: 832,
  height: 1216,
  steps: 25,
  cfg: 7,
  sampler: 'euler',
  seed: 42,
  model: 'sdxl.safetensors',
};

describe('buildComfyGraph', () => {
  it('substitutes tokens and parses to a valid graph (default workflow)', () => {
    const graph = buildComfyGraph(DEFAULT_COMFY_WORKFLOW, params) as Record<string, { inputs: Record<string, unknown> }>;
    expect(graph['6'].inputs.text).toBe('a knight, "shiny" armor\nby a river'); // quotes/newlines survive JSON.parse
    expect(graph['7'].inputs.text).toBe('blurry');
    expect(graph['4'].inputs.ckpt_name).toBe('sdxl.safetensors');
    expect(graph['5'].inputs.width).toBe(832); // numeric token → JSON number, not a string
    expect(graph['5'].inputs.height).toBe(1216);
    expect(graph['3'].inputs.steps).toBe(25);
    expect(graph['3'].inputs.cfg).toBe(7);
    expect(graph['3'].inputs.sampler_name).toBe('euler');
    expect(graph['3'].inputs.seed).toBe(42); // explicit seed passes through
  });

  it('replaces a -1 seed with a concrete non-negative integer', () => {
    const graph = buildComfyGraph(DEFAULT_COMFY_WORKFLOW, { ...params, seed: -1 }) as Record<string, { inputs: Record<string, number> }>;
    const seed = graph['3'].inputs.seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  it('maps the A1111 default sampler name to a ComfyUI name', () => {
    const graph = buildComfyGraph(DEFAULT_COMFY_WORKFLOW, { ...params, sampler: 'Euler a' }) as Record<string, { inputs: Record<string, unknown> }>;
    expect(graph['3'].inputs.sampler_name).toBe('euler_ancestral');
  });

  it('throws a clear error on invalid JSON', () => {
    expect(() => buildComfyGraph('{ "x": %width%, }', params)).toThrow(/Invalid ComfyUI workflow JSON/);
  });
});

describe('toComfySampler', () => {
  it('maps common A1111 names', () => {
    expect(toComfySampler('Euler a')).toBe('euler_ancestral');
    expect(toComfySampler('DPM++ 2M')).toBe('dpmpp_2m');
    expect(toComfySampler('Euler')).toBe('euler');
  });

  it('passes through a name it does not recognize (assumed already ComfyUI)', () => {
    expect(toComfySampler('dpmpp_2m_sde_gpu')).toBe('dpmpp_2m_sde_gpu');
  });
});

describe('parseHistoryImages', () => {
  it('returns the first output image reference', () => {
    const history = {
      abc: { outputs: { '9': { images: [{ filename: 'out_1.png', subfolder: '', type: 'output' }] } } },
    };
    expect(parseHistoryImages(history, 'abc')).toEqual({ filename: 'out_1.png', subfolder: '', type: 'output' });
  });

  it('throws when there are no output images', () => {
    expect(() => parseHistoryImages({ abc: { outputs: {} } }, 'abc')).toThrow(/No image/);
    expect(() => parseHistoryImages({}, 'missing')).toThrow(/No image/);
  });
});

describe('viewUrl', () => {
  it('builds an encoded /view URL', () => {
    const url = viewUrl('http://127.0.0.1:8188', { filename: 'a b.png', subfolder: 'sub dir', type: 'output' });
    expect(url).toBe('http://127.0.0.1:8188/view?filename=a+b.png&subfolder=sub+dir&type=output');
  });
});

describe('decodePreviewFrame', () => {
  it('decodes a PREVIEW_IMAGE (event 1) PNG frame to a data-URL', () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const buf = new ArrayBuffer(8 + body.length);
    const view = new DataView(buf);
    view.setUint32(0, 1); // event = PREVIEW_IMAGE
    view.setUint32(4, 2); // image-type = PNG
    new Uint8Array(buf, 8).set(body);
    const url = decodePreviewFrame(buf);
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('ignores non-preview event types and short buffers', () => {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setUint32(0, 3); // TEXT event
    expect(decodePreviewFrame(buf)).toBeUndefined();
    expect(decodePreviewFrame(new ArrayBuffer(4))).toBeUndefined();
  });
});

describe('fetchComfyMeta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses checkpoint/sampler/scheduler enums from /object_info', async () => {
    const responses: Record<string, unknown> = {
      CheckpointLoaderSimple: {
        CheckpointLoaderSimple: { input: { required: { ckpt_name: [['a.safetensors', 'b.safetensors'], {}] } } },
      },
      KSampler: {
        KSampler: { input: { required: { sampler_name: [['euler', 'euler_ancestral'], {}], scheduler: [['normal', 'karras'], {}] } } },
      },
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const node = url.split('/object_info/')[1];
      return { ok: true, json: async () => responses[node] } as Response;
    }));
    const meta = await fetchComfyMeta('http://127.0.0.1:8188/');
    expect(meta.checkpoints).toEqual(['a.safetensors', 'b.safetensors']);
    expect(meta.samplers).toEqual(['euler', 'euler_ancestral']);
    expect(meta.schedulers).toEqual(['normal', 'karras']);
  });

  it('throws when the server responds with an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 } as Response)));
    await expect(fetchComfyMeta('http://127.0.0.1:8188')).rejects.toThrow(/403/);
  });
});
