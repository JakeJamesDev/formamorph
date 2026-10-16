import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_COMFY_WORKFLOW,
  buildComfyGraph,
  parseHistoryImages,
  viewUrl,
  decodePreviewFrame,
  toComfySampler,
  fetchComfyMeta,
  comfyRejection,
  comfyuiProvider,
  workflowOwnModels,
} from './comfyui';
import type { ImageGenParams } from './types';
import { DetailedError } from '../errorDetails';
import { ImageConnectionError } from './http';

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

  it('fills %prefix% with the file prefix, and a plain name without one', () => {
    const named = buildComfyGraph(DEFAULT_COMFY_WORKFLOW, { ...params, filePrefix: 'formamorph/W/Suya' }) as Record<string, { inputs: Record<string, unknown> }>;
    expect(named['9'].inputs.filename_prefix).toBe('formamorph/W/Suya');
    const plain = buildComfyGraph(DEFAULT_COMFY_WORKFLOW, params) as Record<string, { inputs: Record<string, unknown> }>;
    expect(plain['9'].inputs.filename_prefix).toBe('Formamorph');
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

// The /prompt 400 body ComfyUI sends for a checkpoint that isn't installed (shape from execution.py).
const missingCheckpointRejection = {
  error: {
    type: 'prompt_outputs_failed_validation',
    message: 'Prompt outputs failed validation',
    details: '',
    extra_info: {},
  },
  node_errors: {
    '4': {
      errors: [{
        type: 'value_not_in_list',
        message: 'Value not in list',
        details: "ckpt_name: 'sdxl.safetensors' not in ['a.safetensors', 'b.safetensors']",
        extra_info: {},
      }],
      dependent_outputs: ['9'],
      class_type: 'CheckpointLoaderSimple',
    },
  },
};

const CHECKPOINT_REASON =
  "CheckpointLoaderSimple #4: Value not in list: ckpt_name: 'sdxl.safetensors' not in ['a.safetensors', 'b.safetensors']";

describe('comfyRejection', () => {
  it("keeps ComfyUI's summary as the message and each node's reason as details", () => {
    const error = comfyRejection(400, missingCheckpointRejection);
    expect(error).toBeInstanceOf(DetailedError);
    expect(error.message).toBe('ComfyUI rejected the workflow: Prompt outputs failed validation');
    expect(error.details.split('\n\n')[0]).toBe(CHECKPOINT_REASON);
  });

  it('ends the details with the whole response, so a copy carries everything ComfyUI said', () => {
    const { details } = comfyRejection(400, missingCheckpointRejection);
    const [, response] = details.split('\n\n');
    expect(response.split('\n')[0]).toBe('Response (HTTP 400):');
    expect(JSON.parse(response.slice(response.indexOf('\n') + 1))).toEqual(missingCheckpointRejection);
  });

  it('lists every error across nodes, one per line', () => {
    const body = {
      ...missingCheckpointRejection,
      node_errors: {
        ...missingCheckpointRejection.node_errors,
        '3': {
          errors: [
            { message: 'Value not in list', details: "sampler_name: 'dpm' not in [...]" },
            { message: 'Value smaller than min', details: 'steps: 0' },
          ],
          class_type: 'KSampler',
        },
      },
    };
    expect(comfyRejection(400, body).details.split('\n\n')[0].split('\n')).toEqual([
      "KSampler #3: Value not in list: sampler_name: 'dpm' not in [...]",
      'KSampler #3: Value smaller than min: steps: 0',
      CHECKPOINT_REASON,
    ]);
  });

  it("adds the top-level error's own details when ComfyUI gives them", () => {
    const error = comfyRejection(400, { error: { message: 'Prompt outputs failed validation', details: 'Loop detected' } });
    expect(error.details.split('\n\n')[0]).toBe('Loop detected');
  });

  it('summarizes a string error, and the status when the body names none', () => {
    expect(comfyRejection(400, { error: 'invalid prompt' }).message).toBe('ComfyUI rejected the workflow: invalid prompt');
    expect(comfyRejection(400, {}).message).toBe('ComfyUI rejected the workflow: HTTP 400');
    expect(comfyRejection(400, null).message).toBe('ComfyUI rejected the workflow: HTTP 400');
  });
});

describe('comfyuiProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws the rejection with its node reasons when ComfyUI rejects the workflow', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => missingCheckpointRejection,
    } as Response)));
    const error = await comfyuiProvider(params, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DetailedError);
    expect((error as DetailedError).message).toBe('ComfyUI rejected the workflow: Prompt outputs failed validation');
    expect((error as DetailedError).details).toContain(CHECKPOINT_REASON);
  });

  it('keeps the HTTP status when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    } as unknown as Response)));
    const error = await comfyuiProvider(params, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(DetailedError);
    expect((error as Error).message).toBe('ComfyUI rejected the workflow: HTTP 502');
  });

  it('uses the first checkpoint the server lists when Model is empty', async () => {
    const posted: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/object_info/CheckpointLoaderSimple')) {
        return { ok: true, json: async () => ({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['a.safetensors', 'b.safetensors']] } } } }) } as Response;
      }
      if (url.includes('/object_info/')) return { ok: true, json: async () => ({}) } as Response;
      posted.push(JSON.parse(String(init?.body)));
      return { ok: false, status: 400, json: async () => ({ error: 'stop' }) } as Response;
    }));
    await comfyuiProvider({ ...params, model: '' }, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch(() => {});
    expect((posted[0] as { prompt: Record<string, { inputs: { ckpt_name?: string } }> }).prompt['4'].inputs.ckpt_name).toBe('a.safetensors');
  });

  it('passes the abort signal to the checkpoint lookup', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, json: async () => ({}) } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const signal = new AbortController().signal;
    await comfyuiProvider({ ...params, model: '' }, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '', signal }).catch(() => {});
    expect(fetchMock.mock.calls[0][0]).toContain('/object_info/CheckpointLoaderSimple');
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(signal);
  });

  it('reports a server it cannot reach during the checkpoint lookup as a connection error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const error = await comfyuiProvider({ ...params, model: '' }, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImageConnectionError);
  });

  it('keeps the HTTP status when the checkpoint lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as Response)));
    const error = await comfyuiProvider({ ...params, model: '' }, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch((e: unknown) => e);
    expect((error as Error).message).toBe('ComfyUI could not list its checkpoints: HTTP 500');
  });

  it('says so when Model is empty and the server has no checkpoints', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) } as Response)));
    const error = await comfyuiProvider({ ...params, model: '' }, { endpointUrl: 'http://127.0.0.1:8188', apiToken: '' }).catch((e: unknown) => e);
    expect((error as Error).message).toMatch(/no checkpoints installed/);
  });
});

describe('workflowOwnModels', () => {
  const graph = (nodes: Record<string, unknown>) => JSON.stringify(nodes);

  it('names the files the checkpoint and diffusion-model loaders load', () => {
    expect(workflowOwnModels(graph({
      1: { class_type: 'UNETLoader', inputs: { unet_name: 'z-image-turbo.safetensors', weight_dtype: 'default' } },
      2: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'sdxl.safetensors' } },
      3: { class_type: 'KSampler', inputs: { steps: '%steps%' } },
    }))).toEqual(['z-image-turbo.safetensors', 'sdxl.safetensors']);
  });

  it('skips other loaders that name a model file', () => {
    expect(workflowOwnModels(graph({
      1: { class_type: 'UNETLoader', inputs: { unet_name: 'flux.safetensors' } },
      2: { class_type: 'UpscaleModelLoader', inputs: { model_name: '4x-UltraSharp.pth' } },
    }))).toEqual(['flux.safetensors']);
  });

  it('parses a workflow with bare number tokens', () => {
    const template = '{ "1": { "class_type": "UNETLoader", "inputs": { "unet_name": "u.safetensors" } }, "2": { "class_type": "EmptyLatentImage", "inputs": { "width": %width% } } }';
    expect(workflowOwnModels(template)).toEqual(['u.safetensors']);
  });

  it('is empty for a workflow that takes the Model setting, or does not parse', () => {
    expect(workflowOwnModels(DEFAULT_COMFY_WORKFLOW)).toEqual([]);
    expect(workflowOwnModels('{ not json')).toEqual([]);
  });
});
