import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toInvokeScheduler,
  resolveInvokeSeed,
  findModel,
  resolveSubmodels,
  encodersFor,
  vaesFor,
  parseImageName,
  fetchInvokeMeta,
  invokeaiProvider,
  parseSocketFrame,
  readInvokeProgress,
  resolveBoardId,
  pickDetailBox,
  scaledSize,
  zoomBox,
  nodeImageName,
  type BBox,
  type InvokeBoard,
  type InvokeModel,
} from './invokeai';
import type { ImageGenParams } from './types';

const sdxl: InvokeModel = { key: 'k-sdxl', hash: 'blake3:aa', name: 'My SDXL', base: 'sdxl', type: 'main' };
const sd1: InvokeModel = { key: 'k-sd1', hash: 'blake3:bb', name: 'Photon', base: 'sd-1', type: 'main' };
const zimg: InvokeModel = { key: 'k-z', hash: 'blake3:cc', name: 'Z Turbo', base: 'z-image', type: 'main' };
const encoder: InvokeModel = { key: 'k-enc', hash: 'blake3:dd', name: 'Qwen3 Enc', base: 'any', type: 'qwen3_encoder', variant: 'qwen3_4b' };
const anima: InvokeModel = { key: 'k-a', hash: 'blake3:a1', name: 'Anima Base', base: 'anima', type: 'main' };
const animaEncoder: InvokeModel = { key: 'k-aenc', hash: 'blake3:a2', name: 'Anima Qwen3 0.6B', base: 'any', type: 'qwen3_encoder', variant: 'qwen3_06b' };
const animaVae: InvokeModel = { key: 'k-avae', hash: 'blake3:a3', name: 'Anima QwenImage VAE', base: 'anima', type: 'vae' };
const fluxVae: InvokeModel = { key: 'k-fvae', hash: 'blake3:ee', name: 'Flux VAE', base: 'flux', type: 'vae' };
const sdxlVae: InvokeModel = { key: 'k-svae', hash: 'blake3:ff', name: 'SDXL VAE', base: 'sdxl', type: 'vae' };

const boards: InvokeBoard[] = [
  { board_id: 'b-1', board_name: 'Formamorph' },
  { board_id: 'b-2', board_name: 'Realism' },
  { board_id: 'b-old', board_name: 'Archived Stuff', archived: true },
];

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

describe('encodersFor', () => {
  // Every Qwen3 encoder reports base "any", so variant is the only discriminator. A real install carries
  // one per architecture, and taking the first would hand Z-Image an Anima encoder.
  const all = [animaEncoder, { ...encoder, key: 'k-flux8', name: 'FLUX.2 Qwen3 8B', variant: 'qwen3_8b' }, encoder];

  it('picks by variant rather than list order', () => {
    expect(encodersFor(all, 'z-image').map((m) => m.key)).toEqual(['k-enc']);
    expect(encodersFor(all, 'anima').map((m) => m.key)).toEqual(['k-aenc']);
  });

  it('keeps a variant-less record as a fallback instead of hiding it', () => {
    const legacy = { ...encoder, key: 'k-old', variant: undefined };
    expect(encodersFor([legacy], 'anima').map((m) => m.key)).toEqual(['k-old']);
    expect(encodersFor([animaEncoder, legacy], 'anima').map((m) => m.key)).toEqual(['k-aenc', 'k-old']);
  });
});

describe('vaesFor', () => {
  it('prefers the architecture\'s own VAE and offers FLUX as the fallback', () => {
    expect(vaesFor([sdxlVae, fluxVae, animaVae], 'anima').map((m) => m.key)).toEqual(['k-avae', 'k-fvae']);
  });

  it('leaves Z-Image on FLUX and never offers an unrelated VAE', () => {
    expect(vaesFor([sdxlVae, fluxVae, animaVae], 'z-image').map((m) => m.key)).toEqual(['k-fvae']);
  });
});

describe('resolveSubmodels', () => {
  it('auto-picks the Z-Image encoder and a FLUX-type VAE', () => {
    const { encoder: e, vae: v } = resolveSubmodels([zimg, encoder, fluxVae, sdxlVae], 'z-image', '', '');
    expect(e).toBe(encoder);
    expect(v).toBe(fluxVae); // FLUX vae, not the sdxl one
  });

  it('auto-picks Anima\'s 0.6B encoder and its own VAE, past a Z-Image encoder listed first', () => {
    const { encoder: e, vae: v } = resolveSubmodels([anima, encoder, fluxVae, animaEncoder, animaVae], 'anima', '', '');
    expect(e).toBe(animaEncoder);
    expect(v).toBe(animaVae);
  });

  it('honors explicit overrides by name', () => {
    const { vae: v } = resolveSubmodels([encoder, fluxVae], 'z-image', '', 'Flux VAE');
    expect(v).toBe(fluxVae);
  });

  it('throws a user-actionable error when the encoder is missing', () => {
    expect(() => resolveSubmodels([fluxVae], 'z-image', '', '')).toThrow(/Qwen3 4B text encoder/);
    expect(() => resolveSubmodels([fluxVae], 'anima', '', '')).toThrow(/Qwen3 0\.6B text encoder/);
  });

  it('throws a user-actionable error when no usable VAE is installed', () => {
    expect(() => resolveSubmodels([encoder, sdxlVae], 'z-image', '', '')).toThrow(/FLUX-type VAE/);
    expect(() => resolveSubmodels([animaEncoder, sdxlVae], 'anima', '', '')).toThrow(/QwenImage\/Wan 2\.1 VAE/);
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

/** Stand-in for the browser WebSocket the provider opens against InvokeAI's socket.io endpoint. Tests drive
 *  it by hand (`emit`) so the handshake and event order are deterministic. */
class FakeSocket {
  static last: FakeSocket | null = null;
  sent: string[] = [];
  closed = false;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(public url: string) { FakeSocket.last = this; }
  send(frame: string) { this.sent.push(frame); }
  close() { this.closed = true; }
  emit(data: unknown) { this.onmessage?.({ data }); }
  /** Run the engine.io open → namespace-connect exchange the server would drive. */
  handshake() { this.emit('0{"sid":"eio"}'); this.emit('40{"sid":"ns"}'); }
  /** Send one `invocation_progress` event frame. */
  progress(payload: Record<string, unknown>) { this.emit(`42${JSON.stringify(['invocation_progress', payload])}`); }
}

/** Route a mocked fetch by URL+method, verifying the provider's request sequence. */
function stubServer(
  models: InvokeModel[],
  opts: { statuses?: string[]; failMsg?: string; beforePoll?: (n: number) => void; boards?: InvokeBoard[]; boardsFail?: boolean } = {},
) {
  const statuses = opts.statuses ?? ['in_progress', 'completed'];
  let poll = 0;
  const enqueued: unknown[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/v2/models/')) {
      return { ok: true, json: async () => ({ models }) } as Response;
    }
    if (url.includes('/api/v1/boards/')) {
      if (opts.boardsFail) throw new TypeError('Failed to fetch');
      return { ok: true, json: async () => (opts.boards ?? boards) } as Response;
    }
    if (url.endsWith('/enqueue_batch')) {
      enqueued.push(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ item_ids: [7] }) } as Response;
    }
    if (url.includes('/queue/default/i/7')) {
      opts.beforePoll?.(poll);
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
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket);
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

  it('builds the Anima graph with its own node set and submodels', async () => {
    const server = stubServer([anima, encoder, fluxVae, animaEncoder, animaVae]);
    await invokeaiProvider({ ...params, model: 'Anima Base' }, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    const nodes = server.enqueued[0].batch.graph.nodes as Record<string, { type: string; qwen3_encoder_model?: { key: string }; vae_model?: { key: string } }>;
    const types = Object.values(nodes).map((n) => n.type);
    expect(types).toContain('anima_model_loader');
    expect(types).toContain('anima_text_encoder');
    expect(types).toContain('anima_denoise');
    expect(types).toContain('anima_l2i');
    expect(types).not.toContain('z_image_denoise');
    // The Z-Image encoder and FLUX VAE are installed and listed first — Anima must still take its own.
    expect(nodes.loader.qwen3_encoder_model?.key).toBe('k-aenc');
    expect(nodes.loader.vae_model?.key).toBe('k-avae');
  });

  it('falls back to euler when the preset carries a sampler Anima rejects', async () => {
    const server = stubServer([anima, animaEncoder, animaVae]);
    await invokeaiProvider(
      { ...params, model: 'Anima Base', sampler: 'DPM++ 2M Karras' },
      { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' },
    );
    const nodes = server.enqueued[0].batch.graph.nodes as Record<string, { scheduler?: string }>;
    expect(nodes.denoise.scheduler).toBe('euler'); // dpmpp_2m_k is not in Anima's six
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

  it('blames the API token, not CORS, when the server rejects the request', async () => {
    // The server IS reachable — it answered 401. Sending the user to allow_origins is the wrong fix.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 } as Response)));
    const run = invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: 'wrong' });
    await expect(run).rejects.toThrow(/API Token/);
    await expect(run).rejects.not.toThrow(/allow_origins/);
  });

  it('reports a server-side status rather than a connection problem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 } as Response)));
    await expect(invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' }))
      .rejects.toThrow(/HTTP 500/);
  });

  it('decodes through an fp32 VAE when the model\'s own defaults ask for it', async () => {
    // A model whose defaults say fp32 renders solid black through an fp16 VAE — the detail pass already
    // honored this; the base render hardcoded fp16 and produced the black image it exists to avoid.
    const fp32Model: InvokeModel = { ...sdxl, default_settings: { vae_precision: 'fp32' } };
    const server = stubServer([fp32Model]);
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect((server.enqueued[0].batch.graph.nodes.l2i as { fp32?: boolean }).fp32).toBe(true);
  });

  it('leaves fp16 alone for a model that does not ask for fp32', async () => {
    const server = stubServer([sdxl]);
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect((server.enqueued[0].batch.graph.nodes.l2i as { fp32?: boolean }).fp32).toBe(false);
  });

  it('rides out transient network errors while polling instead of failing the render', async () => {
    // The server is still rendering; two polls dying mid-flight (not just non-OK) must not kill the run.
    let polls = 0;
    stubServer([sdxl], { beforePoll: () => { if (++polls <= 2) throw new TypeError('Failed to fetch'); } });
    const url = await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect(url).toMatch(/^data:image\/png;base64,/);
  }, 10000);

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

describe('resolveBoardId', () => {
  it('accepts a board id or a board name (case-insensitive)', () => {
    expect(resolveBoardId(boards, 'b-2')).toBe('b-2');
    expect(resolveBoardId(boards, 'formamorph')).toBe('b-1');
  });

  it('falls back to Uncategorized for a blank or deleted board', () => {
    expect(resolveBoardId(boards, '')).toBe('');
    expect(resolveBoardId(boards, '   ')).toBe('');
    expect(resolveBoardId(boards, 'b-deleted')).toBe('');
  });
});

describe('invokeaiProvider board filing', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** The `board` field the enqueued graph put on its l2i node, or undefined. */
  const l2iBoard = (server: { enqueued: Array<{ batch: { graph: { nodes: Record<string, unknown> } } }> }) =>
    (server.enqueued[0].batch.graph.nodes.l2i as { board?: { board_id: string } }).board;

  it('files an SDXL image under the configured board', async () => {
    const server = stubServer([sdxl]);
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '', invokeBoard: 'b-2' });
    expect(l2iBoard(server)).toEqual({ board_id: 'b-2' });
  });

  it('files a Z-Image image under the configured board too', async () => {
    const server = stubServer([zimg, encoder, fluxVae]);
    await invokeaiProvider({ ...params, model: 'Z Turbo' }, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', invokeBoard: 'Formamorph',
    });
    expect(l2iBoard(server)).toEqual({ board_id: 'b-1' });
  });

  it('omits the board field entirely when none is configured', async () => {
    const server = stubServer([sdxl]);
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect(l2iBoard(server)).toBeUndefined();
    expect('board' in (server.enqueued[0].batch.graph.nodes.l2i as object)).toBe(false);
  });

  it('generates into Uncategorized rather than failing when the board was deleted', async () => {
    const server = stubServer([sdxl]);
    const url = await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', invokeBoard: 'b-deleted',
    });
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(l2iBoard(server)).toBeUndefined();
  });

  it('generates into Uncategorized rather than failing when the board list is unreachable', async () => {
    const server = stubServer([sdxl], { boardsFail: true });
    const url = await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', invokeBoard: 'b-1',
    });
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(l2iBoard(server)).toBeUndefined();
  });
});

describe('parseSocketFrame', () => {
  it('decodes an event frame', () => {
    expect(parseSocketFrame('42["invocation_progress",{"percentage":0.5}]'))
      .toEqual({ event: 'invocation_progress', payload: { percentage: 0.5 } });
  });

  it('ignores engine.io control frames and malformed payloads', () => {
    expect(parseSocketFrame('2')).toBeNull();
    expect(parseSocketFrame('40{"sid":"x"}')).toBeNull();
    expect(parseSocketFrame('42{not json')).toBeNull();
    expect(parseSocketFrame('42"just a string"')).toBeNull();
  });
});

describe('readInvokeProgress', () => {
  const prev = { progress: 0.4, preview: 'data:image/jpeg;base64,old' };

  it('reads percentage and preview from a full event', () => {
    expect(readInvokeProgress({ item_id: 7, percentage: 0.6, image: { dataURL: 'data:new' } }, 7, prev))
      .toEqual({ progress: 0.6, preview: 'data:new' });
  });

  it('ignores events for another queue item', () => {
    expect(readInvokeProgress({ item_id: 9, percentage: 0.9 }, 7, prev)).toBeNull();
  });

  it('keeps the last preview when the event omits the image', () => {
    // Single-user InvokeAI emits every event twice; the admin-room copy has `image` stripped to null.
    expect(readInvokeProgress({ item_id: 7, percentage: 0.6, image: null }, 7, prev))
      .toEqual({ progress: 0.6, preview: prev.preview });
  });

  it('keeps the last percentage while progress is indeterminate (model loading)', () => {
    expect(readInvokeProgress({ item_id: 7, percentage: null, image: { dataURL: 'data:new' } }, 7, prev))
      .toEqual({ progress: 0.4, preview: 'data:new' });
    expect(readInvokeProgress({ item_id: 7, percentage: null, image: null }, 7, prev)).toBeNull();
  });

  it('clamps out-of-range percentages', () => {
    expect(readInvokeProgress({ item_id: 7, percentage: 1.4 }, 7, prev)?.progress).toBe(1);
    expect(readInvokeProgress({ item_id: 7, percentage: -0.2 }, 7, prev)?.progress).toBe(0);
  });

  it('ignores every event until the queue item id is known', () => {
    // The watcher subscribes before enqueuing, so there is a window with no id to match on. Adopting
    // whatever arrives there lets the InvokeAI GUI generating in another tab drive this run's bar.
    expect(readInvokeProgress({ item_id: 9, percentage: 0.9 }, null, prev)).toBeNull();
    expect(readInvokeProgress({ item_id: 9, percentage: 0.9, image: { dataURL: 'data:other' } }, null, prev)).toBeNull();
  });
});

describe('invokeaiProvider live progress', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports socket percentages + preview frames instead of a coarse status guess', async () => {
    const updates: Array<{ progress: number; preview?: string }> = [];
    stubServer([sdxl], {
      statuses: ['in_progress', 'in_progress', 'completed'],
      beforePoll: (n) => {
        const ws = FakeSocket.last;
        if (!ws) return;
        if (n === 0) {
          ws.handshake();
          ws.progress({ item_id: 7, percentage: 0.25, image: { dataURL: 'data:image/jpeg;base64,aaa' } });
        }
        if (n === 1) ws.progress({ item_id: 7, percentage: 0.75, image: null });
      },
    });

    await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '',
      onProgress: (p) => updates.push({ progress: p.progress, preview: p.preview }),
    });

    const ws = FakeSocket.last!;
    expect(ws.url).toBe('ws://127.0.0.1:9090/ws/socket.io/?EIO=4&transport=websocket');
    expect(ws.sent).toEqual(['40', '42["subscribe_queue",{"queue_id":"default"}]']);
    expect(ws.closed).toBe(true);
    // The 0.25/0.75 socket values land, and the second one keeps the earlier preview frame.
    expect(updates).toContainEqual({ progress: 0.25, preview: 'data:image/jpeg;base64,aaa' });
    expect(updates).toContainEqual({ progress: 0.75, preview: 'data:image/jpeg;base64,aaa' });
    // Once the socket is live the poll must not re-emit its coarse value on top of it.
    expect(updates.map((u) => u.progress).slice(updates.findIndex((u) => u.progress === 0.25)))
      .toEqual([0.25, 0.75, 1]);
  });

  it('never lets the bar move backwards when the socket takes over from the status estimate', async () => {
    const progress: number[] = [];
    stubServer([sdxl], {
      statuses: ['in_progress', 'in_progress', 'completed'],
      beforePoll: (n) => {
        const ws = FakeSocket.last;
        if (n === 0) { ws?.handshake(); return; }
        // Denoising starts at step 0 — below the coarse 'in_progress' estimate already reported.
        if (n === 1) ws?.progress({ item_id: 7, percentage: 0, image: { dataURL: 'data:x' } });
      },
    });
    await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', onProgress: (p) => progress.push(p.progress),
    });
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('sends the API token in the socket.io connect frame', async () => {
    stubServer([sdxl], { beforePoll: () => FakeSocket.last?.emit('0{"sid":"eio"}') });
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: 'tok' });
    expect(FakeSocket.last?.sent[0]).toBe('40{"token":"tok"}');
  });

  it('answers engine.io pings so the server does not drop the socket', async () => {
    stubServer([sdxl], { beforePoll: () => FakeSocket.last?.emit('2') });
    await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect(FakeSocket.last?.sent).toContain('3');
  });

  it('falls back to coarse status progress when the socket never delivers', async () => {
    stubServer([sdxl], { statuses: ['in_progress', 'completed'] });
    const progress: number[] = [];
    await invokeaiProvider(params, {
      endpointUrl: 'http://127.0.0.1:9090', apiToken: '', onProgress: (p) => progress.push(p.progress),
    });
    expect(progress.at(-1)).toBe(1);
    // No mid-run value may claim a fraction the server never reported (the old 0.5 status guess).
    expect(progress.filter((p) => p > 0.1 && p < 1)).toEqual([]);
  });

  it('survives a WebSocket constructor that throws', async () => {
    stubServer([sdxl]);
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('blocked'); } });
    const url = await invokeaiProvider(params, { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' });
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});

describe('pickDetailBox', () => {
  const face: BBox = { x_min: 300, y_min: 200, x_max: 600, y_max: 500, score: 0.62 };

  it('takes the highest-scoring usable box', () => {
    const other: BBox = { x_min: 0, y_min: 0, x_max: 200, y_max: 200, score: 0.41 };
    expect(pickDetailBox([other, face], 832, 1216)).toBe(face);
  });

  it('rejects a whole-canvas detection even when it scores highest', () => {
    // DINO's real failure mode: a box covering the whole image, returned with high confidence. Taking it
    // would turn the face fix into a full-image img2img.
    const canvasWide: BBox = { x_min: 0, y_min: 0, x_max: 832, y_max: 1216, score: 0.95 };
    expect(pickDetailBox([canvasWide, face], 832, 1216)).toBe(face);
    expect(pickDetailBox([canvasWide], 832, 1216)).toBeNull();
  });

  it('returns null for no detections, and ignores degenerate boxes', () => {
    expect(pickDetailBox([], 832, 1216)).toBeNull();
    expect(pickDetailBox([{ x_min: 40, y_min: 40, x_max: 40, y_max: 90, score: 0.9 }], 832, 1216)).toBeNull();
  });

  it('treats a missing score as the lowest rather than throwing it away', () => {
    const noScore: BBox = { x_min: 10, y_min: 10, x_max: 60, y_max: 60 };
    expect(pickDetailBox([noScore], 832, 1216)).toBe(noScore);
    expect(pickDetailBox([noScore, face], 832, 1216)).toBe(face);
  });
});

describe('scaledSize', () => {
  it('leaves a crop that already sits on an SDXL training bucket alone', () => {
    expect(scaledSize(832, 1216, 1024, 'sdxl')).toEqual([832, 1216]);
    expect(scaledSize(1216, 832, 1024, 'sdxl')).toEqual([1216, 832]);
  });

  it('scales a small crop up to roughly the model\'s optimal AREA, not its long edge', () => {
    const [w, h] = scaledSize(300, 400, 1024, 'sdxl');
    expect(w * h).toBeGreaterThanOrEqual(1024 * 1024);
    expect(Math.max(w, h)).toBeLessThan(1024 * 2); // long edge is NOT pinned to 1024
    expect(w % 8).toBe(0);
    expect(h % 8).toBe(0);
    expect(w / h).toBeCloseTo(300 / 400, 1); // aspect preserved
  });

  it('renders an SD1.5 crop at its own training resolution instead of SDXL\'s', () => {
    const [w, h] = scaledSize(300, 300, 512, 'sd-1');
    expect([w, h]).toEqual([512, 512]);
    // The SDXL bucket shortcut must not apply to a non-SDXL base.
    expect(scaledSize(1024, 1024, 512, 'sd-1')).toEqual([1024, 1024]);
  });

  it('leaves a crop already past the target area alone', () => {
    expect(scaledSize(1600, 1600, 1024, 'sd-1')).toEqual([1600, 1600]);
  });

  it('returns instead of spinning on a crop that rounds to zero on an axis', () => {
    // An axis under half the grid rounds to 0, leaving the aspect ratio non-finite and the growth loop
    // unable to raise the area — it would hang the main thread rather than return a bad size.
    expect(scaledSize(300, 3, 1024, 'sd-1')).toEqual([8, 8]);
    expect(scaledSize(3, 300, 1024, 'sd-1')).toEqual([8, 8]);
    expect(scaledSize(0, 0, 1024, 'sd-1')).toEqual([8, 8]);
  });
});

describe('zoomBox', () => {
  it('grows the box about its center', () => {
    expect(zoomBox({ x_min: 400, y_min: 400, x_max: 500, y_max: 500 }, 2, 832, 1216))
      .toEqual({ x_min: 350, y_min: 350, x_max: 550, y_max: 550 });
  });

  it('clamps to the canvas instead of running off it', () => {
    expect(zoomBox({ x_min: 10, y_min: 10, x_max: 110, y_max: 110 }, 4, 832, 1216))
      .toEqual({ x_min: 0, y_min: 0, x_max: 260, y_max: 260 });
  });
});

describe('nodeImageName', () => {
  const item = {
    session: {
      results: { p: { type: 'image_output', image: { image_name: 'pasted.png' } }, b: { type: 'image_output', image: { image_name: 'blended.png' } } },
      source_prepared_mapping: { paste: ['p'], blend: ['b'] },
    },
  };

  it('picks the output of the named node, not just the first image', () => {
    expect(nodeImageName(item, 'paste')).toBe('pasted.png');
    expect(nodeImageName(item, 'blend')).toBe('blended.png');
  });

  it('throws when the node produced nothing', () => {
    expect(() => nodeImageName(item, 'crop')).toThrow(/node "crop"/);
  });
});

/** A face-sized detection inside the 832x1216 test canvas (~9% of it). */
const faceBox: BBox = { x_min: 300, y_min: 200, x_max: 600, y_max: 500, score: 0.62 };
/** What SAM's mask bounds come back as, once `margin` has been applied server-side. */
const maskBounds: BBox = { x_min: 280, y_min: 180, x_max: 620, y_max: 520 };

/** Route a mocked fetch for a multi-pass run, answering each enqueue according to the graph it received.
 *  Records the graphs in order and the image the provider ultimately downloaded. */
function stubDetailServer(
  models: InvokeModel[],
  o: { boxes?: BBox[]; bbox?: BBox | null; failPass?: number } = {},
) {
  const graphs: Array<{ nodes: Record<string, Record<string, unknown>>; edges: unknown[] }> = [];
  const items = new Map<number, unknown>();
  let nextId = 100;
  let downloaded = '';

  const completed = (results: Record<string, unknown>, mapping?: Record<string, string[]>) => ({
    status: 'completed', session: { results, ...(mapping ? { source_prepared_mapping: mapping } : {}) },
  });

  const answer = (graph: { nodes: Record<string, Record<string, unknown>> }, pass: number) => {
    if (o.failPass === pass) return { status: 'failed', error_message: 'detector exploded' };
    const types = Object.values(graph.nodes).map((n) => n.type);
    if (types.includes('grounding_dino')) {
      return completed({ a: { type: 'bounding_box_collection_output', collection: o.boxes ?? [faceBox] } });
    }
    if (types.includes('segment_anything')) {
      const bbox = o.bbox === undefined ? maskBounds : o.bbox;
      return completed({
        ...(bbox ? { a: { type: 'bounding_box_output', bounding_box: bbox } } : {}),
        b: { type: 'image_output', image: { image_name: 'mask.png' } },
      });
    }
    if (types.includes('img_paste')) {
      // The blend's crop-sized output is listed FIRST: taking "the first image_output" would hand back
      // the patch instead of the composite, and nothing about its shape would give that away.
      return completed(
        { q: { type: 'image_output', image: { image_name: 'blend.png' } }, p: { type: 'image_output', image: { image_name: 'fixed.png' } } },
        { blend: ['q'], paste: ['p'] },
      );
    }
    return completed({ r: { type: 'image_output', image: { image_name: 'base.png' } } });
  };

  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/v2/models/')) return { ok: true, json: async () => ({ models }) } as Response;
    if (url.includes('/api/v1/boards/')) return { ok: true, json: async () => boards } as Response;
    if (url.endsWith('/enqueue_batch')) {
      const graph = JSON.parse(String(init?.body)).batch.graph;
      graphs.push(graph);
      const id = nextId++;
      items.set(id, answer(graph, graphs.length));
      return { ok: true, json: async () => ({ item_ids: [id] }) } as Response;
    }
    const queued = url.match(/\/queue\/default\/i\/(\d+)/);
    if (queued) return { ok: true, json: async () => items.get(Number(queued[1])) } as Response;
    if (url.includes('/images/i/')) {
      downloaded = decodeURIComponent(url.split('/images/i/')[1].split('/full')[0]);
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      } as unknown as Response;
    }
    throw new Error(`unexpected url ${url}`);
  }));
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket);
  return { graphs, downloaded: () => downloaded };
}

describe('invokeaiProvider detail pass', () => {
  afterEach(() => vi.unstubAllGlobals());

  const detailParams: ImageGenParams = { ...params, adetailer: true };
  const endpoint = { endpointUrl: 'http://127.0.0.1:9090', apiToken: '' };
  const typesOf = (g: { nodes: Record<string, Record<string, unknown>> }) => Object.values(g.nodes).map((n) => n.type as string);

  it('detects, segments, re-renders and returns the pasted composite', async () => {
    const server = stubDetailServer([sdxl]);
    const progress: number[] = [];
    const url = await invokeaiProvider(detailParams, { ...endpoint, onProgress: (p) => progress.push(p.progress) });

    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(server.graphs).toHaveLength(4);
    expect(typesOf(server.graphs[1])).toEqual(['grounding_dino']);
    expect(typesOf(server.graphs[2])).toContain('segment_anything');

    const detailTypes = typesOf(server.graphs[3]);
    expect(detailTypes).toContain('create_gradient_mask');
    expect(detailTypes).toContain('invokeai_img_blend');
    expect(detailTypes).toContain('img_paste');
    // The composite is what we hand back, not the blend that also comes out of that graph.
    expect(server.downloaded()).toBe('fixed.png');
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('masks the denoise in latent space rather than repairing the region afterwards', async () => {
    const server = stubDetailServer([sdxl]);
    await invokeaiProvider(detailParams, endpoint);
    const edges = server.graphs[3].edges as Array<{ source: { node_id: string; field: string }; destination: { node_id: string; field: string } }>;
    expect(edges).toContainEqual({
      source: { node_id: 'grad', field: 'denoise_mask' },
      destination: { node_id: 'denoise', field: 'denoise_mask' },
    });
    // img_paste must be given no mask — a mask there premultiplies and traces a dark halo on every edge.
    expect(server.graphs[3].nodes.paste.mask).toBeUndefined();
  });

  it('renders the crop scaled up, then lays it back at the crop\'s own size', async () => {
    const server = stubDetailServer([sdxl]);
    await invokeaiProvider(detailParams, endpoint);
    const n = server.graphs[3].nodes;
    // zoom 2.2 about the mask bounds (280,180)-(620,520) wants 76..824 x -24..724; the top clamps to 0.
    expect(n.down).toMatchObject({ width: 748, height: 724 });
    expect((n.up as { width: number }).width).toBeGreaterThan(748); // scaled up to ~1MP for the render
    expect(n.paste).toMatchObject({ x: 76, y: 0 });
  });

  it('carries the fp32 VAE flag from the model, since fp16 renders such a model black', async () => {
    const fp32Model = { ...sdxl, default_settings: { vae_precision: 'fp32' } };
    const server = stubDetailServer([fp32Model]);
    await invokeaiProvider(detailParams, endpoint);
    const n = server.graphs[3].nodes;
    expect(n.i2l).toMatchObject({ fp32: true });
    expect(n.l2i).toMatchObject({ fp32: true });
    expect(n.grad).toMatchObject({ fp32: true });
  });

  it('files only the composite on the board, leaving the un-fixed base out of the gallery', async () => {
    const server = stubDetailServer([sdxl]);
    await invokeaiProvider(detailParams, { ...endpoint, invokeBoard: 'b-2' });
    expect(server.graphs[0].nodes.l2i).toMatchObject({ is_intermediate: true });
    expect(server.graphs[0].nodes.l2i.board).toBeUndefined();
    expect(server.graphs[3].nodes.paste).toMatchObject({ board: { board_id: 'b-2' }, is_intermediate: false });
  });

  it('returns the base image untouched when no face is found', async () => {
    const server = stubDetailServer([sdxl], { boxes: [] });
    const progress: number[] = [];
    const url = await invokeaiProvider(detailParams, { ...endpoint, onProgress: (p) => progress.push(p.progress) });
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(server.graphs).toHaveLength(2); // generation + detection, then it stops
    expect(server.downloaded()).toBe('base.png');
    expect(progress.at(-1)).toBe(1); // the bar still finishes rather than sticking mid-pass
  });

  it('stops before SAM when the only detection covers the whole canvas', async () => {
    const server = stubDetailServer([sdxl], {
      boxes: [{ x_min: 0, y_min: 0, x_max: 832, y_max: 1216, score: 0.95 }],
    });
    await invokeaiProvider(detailParams, endpoint);
    expect(server.graphs).toHaveLength(2);
    expect(server.downloaded()).toBe('base.png');
  });

  it('returns the base image when SAM produces an empty mask', async () => {
    const server = stubDetailServer([sdxl], { bbox: null });
    await invokeaiProvider(detailParams, endpoint);
    expect(server.graphs).toHaveLength(3);
    expect(server.downloaded()).toBe('base.png');
  });

  it('keeps the generation when the detail pass fails outright', async () => {
    // A failed face fix must not lose an image that already rendered.
    const server = stubDetailServer([sdxl], { failPass: 4 });
    const url = await invokeaiProvider(detailParams, endpoint);
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(server.graphs).toHaveLength(4);
    expect(server.downloaded()).toBe('base.png');
  });

  it('builds the SD1.5 detail graph with single-clip compel', async () => {
    const server = stubDetailServer([sd1]);
    await invokeaiProvider({ ...detailParams, model: 'Photon' }, endpoint);
    const detailTypes = typesOf(server.graphs[3]);
    expect(detailTypes).toContain('main_model_loader');
    expect(detailTypes).toContain('compel');
    expect(detailTypes).not.toContain('sdxl_compel_prompt');
  });

  it('skips the pass entirely for Z-Image, whose denoise node has no mask input', async () => {
    const server = stubDetailServer([zimg, encoder, fluxVae]);
    const url = await invokeaiProvider({ ...detailParams, model: 'Z Turbo' }, endpoint);
    expect(url).toMatch(/^data:image\/png;base64,/);
    expect(server.graphs).toHaveLength(1);
    // Skipped, not degraded: the image still files on its board like any normal generation.
    expect(server.graphs[0].nodes.l2i.is_intermediate).toBeUndefined();
  });

  it('leaves the single-pass flow alone when the setting is off', async () => {
    const server = stubDetailServer([sdxl]);
    await invokeaiProvider(params, endpoint);
    expect(server.graphs).toHaveLength(1);
    expect(server.downloaded()).toBe('base.png');
  });
});

describe('fetchInvokeMeta', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('filters main models to supported bases and passes submodels through for per-base narrowing', async () => {
    const all = [sdxl, sd1, zimg, anima, encoder, animaEncoder, fluxVae, sdxlVae, animaVae, { ...sdxl, key: 'flux1', name: 'Flux', base: 'flux', type: 'main' }];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/boards/') ? boards : { models: all }),
    } as Response)));
    const meta = await fetchInvokeMeta('http://127.0.0.1:9090');
    expect(meta.models.map((m) => m.name)).toEqual(['My SDXL', 'Photon', 'Z Turbo', 'Anima Base']); // flux main excluded
    // Both lists stay whole here: which entries are usable depends on the selected model, so the
    // Settings rows narrow them with encodersFor/vaesFor rather than this call guessing.
    expect(meta.encoders).toEqual([encoder, animaEncoder]);
    expect(meta.vaes).toEqual([fluxVae, sdxlVae, animaVae]);
    expect(meta.boards.map((b) => b.board_name)).toEqual(['Formamorph', 'Realism']); // archived excluded
  });

  it('still returns the models when the boards endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/boards/')) return { ok: false, status: 404 } as Response;
      return { ok: true, json: async () => ({ models: [sdxl] }) } as Response;
    }));
    const meta = await fetchInvokeMeta('http://127.0.0.1:9090');
    expect(meta.models).toEqual([sdxl]);
    expect(meta.boards).toEqual([]);
  });
});
