import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toInvokeScheduler,
  resolveInvokeSeed,
  findModel,
  resolveZImageSubmodels,
  parseImageName,
  fetchInvokeMeta,
  invokeaiProvider,
  parseSocketFrame,
  readInvokeProgress,
  resolveBoardId,
  type InvokeBoard,
  type InvokeModel,
} from './invokeai';
import type { ImageGenParams } from './types';

const sdxl: InvokeModel = { key: 'k-sdxl', hash: 'blake3:aa', name: 'My SDXL', base: 'sdxl', type: 'main' };
const sd1: InvokeModel = { key: 'k-sd1', hash: 'blake3:bb', name: 'Photon', base: 'sd-1', type: 'main' };
const zimg: InvokeModel = { key: 'k-z', hash: 'blake3:cc', name: 'Z Turbo', base: 'z-image', type: 'main' };
const encoder: InvokeModel = { key: 'k-enc', hash: 'blake3:dd', name: 'Qwen3 Enc', base: 'any', type: 'qwen3_encoder' };
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

describe('fetchInvokeMeta', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('filters to supported main models, Qwen3 encoders, and FLUX VAEs', async () => {
    const all = [sdxl, sd1, zimg, encoder, fluxVae, sdxlVae, { ...sdxl, key: 'flux1', name: 'Flux', base: 'flux', type: 'main' }];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/boards/') ? boards : { models: all }),
    } as Response)));
    const meta = await fetchInvokeMeta('http://127.0.0.1:9090');
    expect(meta.models.map((m) => m.name)).toEqual(['My SDXL', 'Photon', 'Z Turbo']); // flux main excluded
    expect(meta.encoders).toEqual([encoder]);
    expect(meta.vaes).toEqual([fluxVae]); // sdxl vae excluded
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
