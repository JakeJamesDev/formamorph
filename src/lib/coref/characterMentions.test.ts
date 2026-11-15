import { describe, expect, it, vi, type Mock } from 'vitest';
import { createCharacterMentions, PROBE_LIMIT_MS, type CharacterMentionsDeps, type CorefHostPort, type CorefModelChoice } from './characterMentions';
import { COREF_CACHE_NAME, sha256Hex, type CorefStoreDeps } from './corefModelStore';
import { PROBE_PASSAGE } from './probePassage';

const ORIGIN = 'https://assets.test/coref/';
const enc = (text: string) => new TextEncoder().encode(text);

/** One published version's four files, with distinct bytes per model and version. */
function filesOf(model: string, version: number) {
  const hostConfig = JSON.stringify({
    architecture: model === 'big' ? 'lingmess' : 'fcoref', top_lambda: 0.4, max_span_length: 30, max_segment_len: 512, graphContract: 1,
  });
  return {
    graph_a: enc(`${model}${version}-graph-a-${'x'.repeat(2000)}`),
    graph_b: enc(`${model}${version}-graph-b`),
    tokenizer: enc(JSON.stringify({ model: { vocab: {}, merges: [] }, added_tokens: [] })),
    hostConfig: enc(hostConfig),
  };
}

const NAMES = { graph_a: 'graph_a.onnx', graph_b: 'graph_b.onnx', tokenizer: 'tokenizer.json', hostConfig: 'host-config.json' } as const;

/** A server holding manifest versions and their files. `corrupt` serves the listed file with other bytes. */
class FakeServer {
  files = new Map<string, Uint8Array>();
  versions: Record<string, number> = {};
  corrupt = new Set<string>();
  requests: string[] = [];

  publish(model: 'big' | 'small', version: number) {
    for (const [key, bytes] of Object.entries(filesOf(model, version))) {
      this.files.set(`${ORIGIN}${model}/${version}/${NAMES[key as keyof typeof NAMES]}`, bytes);
    }
    this.versions[model] = version;
  }

  async manifest() {
    const models: Record<string, unknown> = {};
    for (const [model, version] of Object.entries(this.versions)) {
      const files: Record<string, unknown> = {};
      for (const [key, name] of Object.entries(NAMES)) {
        const url = `${ORIGIN}${model}/${version}/${name}`;
        const bytes = this.files.get(url)!;
        files[key] = { url, size: bytes.length, sha256: await sha256Hex(new Uint8Array(bytes)) };
      }
      models[model] = { version, architecture: model === 'big' ? 'lingmess' : 'fcoref', minHostVersion: 1, scores: {}, files };
    }
    return { format: 1, models };
  }

  fetch = async (url: string): Promise<Response> => {
    this.requests.push(url);
    if (url === `${ORIGIN}manifest.json`) return new Response(JSON.stringify(await this.manifest()));
    const bytes = this.files.get(url);
    if (!bytes) return new Response('missing', { status: 404 });
    const body = this.corrupt.has(url) ? bytes.map((b) => b ^ 1) : bytes;
    // Two chunks, so progress reports mid-file.
    const half = Math.floor(body.length / 2);
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(body.slice(0, half));
        controller.enqueue(body.slice(half));
        controller.close();
      },
    }));
  };
}

/** CacheStorage with one cache, in memory. */
class FakeCaches {
  entries = new Map<string, { bytes: ArrayBuffer; headers: Headers }>();
  async open(name: string) {
    expect(name).toBe(COREF_CACHE_NAME);
    const entries = this.entries;
    const key = (r: RequestInfo | URL) => (typeof r === 'string' ? r : r instanceof URL ? r.href : r.url);
    return {
      async match(r: RequestInfo | URL) {
        const hit = entries.get(key(r));
        return hit ? new Response(hit.bytes.slice(0), { headers: hit.headers }) : undefined;
      },
      async put(r: RequestInfo | URL, response: Response) {
        entries.set(key(r), { bytes: await response.arrayBuffer(), headers: new Headers(response.headers) });
      },
      async keys() {
        return [...entries.keys()].map((url) => ({ url }) as Request);
      },
      async delete(r: RequestInfo | URL) {
        return entries.delete(key(r));
      },
    } as unknown as Cache;
  }
  async delete() {
    const had = this.entries.size > 0;
    this.entries.clear();
    return had;
  }
  /** The cached files, by base URL. */
  urls() {
    return [...new Set([...this.entries.keys()].map((k) => k.replace(/\?fm-part=\d+$/, '')))].sort();
  }
  parts(url: string) {
    return [...this.entries.keys()].filter((k) => k.startsWith(`${url}?fm-part=`)).length;
  }
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}

interface Rig {
  server: FakeServer;
  caches: FakeCaches;
  storage: MemoryStorage;
  host: {
    load: Mock<CorefHostPort['load']>;
    resolve: Mock<CorefHostPort['resolve']>;
    dispose: Mock<CorefHostPort['dispose']>;
  };
  gpu: boolean;
  /** How long one probe run takes on the faked device. */
  probeMs: number;
}

function rig(partial: Partial<Pick<Rig, 'gpu' | 'probeMs'>> = {}, shared?: Pick<Rig, 'server' | 'caches' | 'storage'>) {
  const server = shared?.server ?? new FakeServer();
  const caches = shared?.caches ?? new FakeCaches();
  const storage = shared?.storage ?? new MemoryStorage();
  let clock = 0;
  const r: Rig = {
    server, caches, storage, gpu: partial.gpu ?? true, probeMs: partial.probeMs ?? 50,
    host: {
      load: vi.fn<CorefHostPort['load']>(async () => {}),
      resolve: vi.fn<CorefHostPort['resolve']>(async (text: string) => {
        if (text === PROBE_PASSAGE) clock += r.probeMs;
        return [];
      }),
      dispose: vi.fn<CorefHostPort['dispose']>(async () => {}),
    },
  };
  // Small parts, so the 2 KB graph splits across cache entries as a 370 MB one does.
  const store: CorefStoreDeps = { fetch: server.fetch, caches: caches as unknown as CacheStorage, sha256: sha256Hex, partBytes: 512 };
  const deps: CharacterMentionsDeps = {
    manifestUrl: `${ORIGIN}manifest.json`, store, host: r.host, hasWebGpu: async () => r.gpu, now: () => clock, storage,
  };
  const controller = createCharacterMentions(deps);
  const settled = () => vi.waitFor(() => {
    const { status } = controller.getState();
    if (status !== 'ready' && status !== 'error') throw new Error(`still ${status}`);
  });
  const enable = async (choice: CorefModelChoice = 'auto') => {
    controller.sync({ enabled: true, choice, blocked: false });
    await settled();
    return controller.getState();
  };
  return { ...r, controller, enable, settled };
}

const urlsOf = (model: string, version: number) => Object.values(NAMES).map((n) => `${ORIGIN}${model}/${version}/${n}`).sort();

describe('Character Mentions on the device', () => {
  it('downloads, verifies and caches the chosen model, with progress in bytes', async () => {
    const r = rig({ gpu: false });
    r.server.publish('small', 1);
    const seen: number[] = [];
    r.controller.subscribe(() => {
      const p = r.controller.getState().progress;
      if (p) seen.push(p.loaded);
    });
    const state = await r.enable('small');
    expect(state).toMatchObject({ status: 'ready', model: 'small', version: 1, error: null });
    expect(r.caches.urls()).toEqual(urlsOf('small', 1));
    const total = [...r.server.files.entries()].filter(([u]) => u.includes('/small/1/')).reduce((s, [, b]) => s + b.length, 0);
    expect(seen.at(-1)).toBe(total);
    expect(seen.some((n) => n > 0 && n < total)).toBe(true);
    expect(r.caches.parts(`${ORIGIN}small/1/graph_a.onnx`)).toBeGreaterThan(1);
    const [files, device] = r.host.load.mock.calls[0];
    expect(device).toBe('wasm');
    expect(files.config).toMatchObject({ architecture: 'fcoref', topLambda: 0.4 });
    // The parts read back as the file that was served.
    expect(new Uint8Array(files.graphA)).toEqual(r.server.files.get(`${ORIGIN}small/1/graph_a.onnx`));
  });

  it('shows an error and caches nothing for a file whose hash does not match', async () => {
    const r = rig({ gpu: false });
    r.server.publish('small', 1);
    r.server.corrupt.add(`${ORIGIN}small/1/graph_b.onnx`);
    const state = await r.enable('small');
    expect(state.status).toBe('error');
    expect(state.error).toMatch(/checksum/);
    expect(r.caches.urls()).not.toContain(`${ORIGIN}small/1/graph_b.onnx`);
    expect(r.host.load).not.toHaveBeenCalled();

    // Retry once the server holds the right file.
    r.server.corrupt.clear();
    r.controller.retry();
    await r.settled();
    expect(r.controller.getState().status).toBe('ready');
  });

  it('deletes the cached files when the feature is turned off', async () => {
    const r = rig({ gpu: false });
    r.server.publish('small', 1);
    await r.enable('small');
    expect(r.caches.urls().length).toBe(4);
    r.controller.sync({ enabled: false, choice: 'small', blocked: false });
    await vi.waitFor(() => expect(r.caches.urls()).toEqual([]));
    expect(r.controller.getState().status).toBe('off');
    expect(r.host.dispose).toHaveBeenCalled();
  });

  it('downloads nothing while AI Language is not English', async () => {
    const r = rig();
    r.server.publish('small', 1);
    r.controller.sync({ enabled: true, choice: 'auto', blocked: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(r.server.requests).toEqual([]);
    expect(r.controller.getState().status).toBe('off');
  });

  describe('model choice', () => {
    it('picks Big on WebGPU when the probe runs under the limit', async () => {
      const r = rig({ gpu: true, probeMs: PROBE_LIMIT_MS - 1 });
      r.server.publish('big', 1);
      r.server.publish('small', 1);
      const state = await r.enable('auto');
      expect(state).toMatchObject({ status: 'ready', model: 'big' });
      expect(r.host.load).toHaveBeenLastCalledWith(expect.anything(), 'webgpu');
      expect(r.caches.urls()).toEqual(urlsOf('big', 1));
    });

    it('picks Small when the probe runs over the limit, and deletes the big files', async () => {
      const r = rig({ gpu: true, probeMs: PROBE_LIMIT_MS });
      r.server.publish('big', 1);
      r.server.publish('small', 1);
      const state = await r.enable('auto');
      expect(state).toMatchObject({ status: 'ready', model: 'small' });
      expect(r.caches.urls()).toEqual(urlsOf('small', 1));
    });

    it('picks Small without a WebGPU adapter, and never downloads Big', async () => {
      const r = rig({ gpu: false });
      r.server.publish('big', 1);
      r.server.publish('small', 1);
      const state = await r.enable('auto');
      expect(state.model).toBe('small');
      expect(r.server.requests.some((u) => u.includes('/big/'))).toBe(false);
    });

    it('lets the override beat the probe either way', async () => {
      const slow = rig({ gpu: true, probeMs: 10_000 });
      slow.server.publish('big', 1);
      slow.server.publish('small', 1);
      expect((await slow.enable('big')).model).toBe('big');

      const fast = rig({ gpu: true, probeMs: 1 });
      fast.server.publish('big', 1);
      fast.server.publish('small', 1);
      expect((await fast.enable('small')).model).toBe('small');
      expect(fast.host.resolve).not.toHaveBeenCalled();
    });

    it('keeps the verdict per device, and probes again for a new big version or a fresh Auto pick', async () => {
      const first = rig({ gpu: true, probeMs: 10 });
      first.server.publish('big', 1);
      first.server.publish('small', 1);
      await first.enable('auto');
      const probes = () => first.host.resolve.mock.calls.length;
      expect(probes()).toBe(2);

      // A new session on the same device: no probe, the cached model opens.
      const again = rig({ gpu: true, probeMs: 10 }, first);
      expect((await again.enable('auto')).model).toBe('big');
      expect(again.host.resolve).not.toHaveBeenCalled();

      // A new big version probes again.
      first.server.publish('big', 2);
      const updated = rig({ gpu: true, probeMs: 10 }, first);
      await updated.enable('auto');
      await vi.waitFor(() => expect(updated.controller.getState().version).toBe(2));
      expect(updated.host.resolve).toHaveBeenCalledWith(PROBE_PASSAGE);

      // Picking Auto again probes again.
      const repick = rig({ gpu: true, probeMs: 10 }, first);
      repick.controller.forgetProbe();
      await repick.enable('auto');
      await vi.waitFor(() => expect(repick.host.resolve).toHaveBeenCalledWith(PROBE_PASSAGE));
    });
  });

  describe('updates', () => {
    it('opens the cached version first, then switches only after the new one verifies', async () => {
      const r = rig({ gpu: false });
      r.server.publish('small', 1);
      await r.enable('small');
      r.server.publish('small', 2);

      const next = rig({ gpu: false }, r);
      const states: string[] = [];
      next.controller.subscribe(() => {
        const { status, version } = next.controller.getState();
        if (status === 'ready') states.push(`ready ${version}`);
      });
      next.controller.sync({ enabled: true, choice: 'small', blocked: false });
      await vi.waitFor(() => expect(next.controller.getState().version).toBe(2));
      expect(states).toEqual(['ready 1', 'ready 2']);
      expect(next.caches.urls()).toEqual(urlsOf('small', 2));
    });

    it('keeps reading with the old version when the new one fails its check', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = rig({ gpu: false });
      r.server.publish('small', 1);
      await r.enable('small');
      r.server.publish('small', 2);
      r.server.corrupt.add(`${ORIGIN}small/2/graph_a.onnx`);

      const next = rig({ gpu: false }, r);
      next.controller.sync({ enabled: true, choice: 'small', blocked: false });
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
      expect(next.controller.getState()).toMatchObject({ status: 'ready', version: 1, error: null });
      expect(next.caches.urls()).toEqual(expect.arrayContaining(urlsOf('small', 1)));
      expect(await next.controller.readPassage('Mira left.', [], {})).toMatchObject({ version: 1 });
      warn.mockRestore();
    });

    it('opens Auto’s cached model offline on a device without WebGPU', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = rig({ gpu: false });
      r.server.publish('big', 1);
      r.server.publish('small', 1);
      await r.enable('auto');
      const offline = rig({ gpu: false }, r);
      offline.server.fetch = async () => { throw new TypeError('Failed to fetch'); };
      const store = createCharacterMentions({
        manifestUrl: `${ORIGIN}manifest.json`,
        store: { fetch: offline.server.fetch, caches: offline.caches as unknown as CacheStorage, sha256: sha256Hex, partBytes: 512 },
        host: offline.host, hasWebGpu: async () => false, now: () => 0, storage: offline.storage,
      });
      store.sync({ enabled: true, choice: 'auto', blocked: false });
      await vi.waitFor(() => expect(store.getState()).toMatchObject({ status: 'ready', model: 'small' }));
      warn.mockRestore();
    });

    it('opens the cached model offline', async () => {
      vi.spyOn(console, 'warn').mockImplementationOnce(() => {});
      const r = rig({ gpu: false });
      r.server.publish('small', 1);
      await r.enable('small');
      const offline = rig({ gpu: false }, r);
      offline.server.fetch = async () => { throw new TypeError('Failed to fetch'); };
      const store = createCharacterMentions({
        manifestUrl: `${ORIGIN}manifest.json`,
        store: { fetch: offline.server.fetch, caches: offline.caches as unknown as CacheStorage, sha256: sha256Hex, partBytes: 512 },
        host: offline.host, hasWebGpu: async () => false, now: () => 0, storage: offline.storage,
      });
      store.sync({ enabled: true, choice: 'small', blocked: false });
      await vi.waitFor(() => expect(store.getState()).toMatchObject({ status: 'ready', model: 'small', version: 1 }));
    });
  });

  it('finishes a delete an earlier session left undone', async () => {
    const r = rig({ gpu: false });
    r.server.publish('small', 1);
    await r.enable('small');
    // The setting went off, but that session closed before the files were gone.
    const next = rig({ gpu: false }, r);
    next.controller.sync({ enabled: false, choice: 'small', blocked: false });
    await vi.waitFor(() => expect(next.caches.urls()).toEqual([]));
    expect(next.storage.getItem('FORMAMORPH_corefActive')).toBeNull();
  });

  it('lets a switch mid-download win: the old run records nothing and deletes nothing', async () => {
    const r = rig({ gpu: true, probeMs: 1 });
    r.server.publish('big', 1);
    r.server.publish('small', 1);
    // Hold the first load open, so the switch lands while the big model loads.
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let loading = 0;
    let overlap = false;
    r.host.load.mockImplementation(async () => {
      loading++;
      if (loading > 1) overlap = true;
      if (r.host.load.mock.calls.length === 1) await held;
      loading--;
    });
    r.controller.sync({ enabled: true, choice: 'big', blocked: false });
    await vi.waitFor(() => expect(r.host.load).toHaveBeenCalledTimes(1));
    r.controller.sync({ enabled: true, choice: 'small', blocked: false });
    // Long enough for an unqueued second run to download and reach its own load.
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await vi.waitFor(() => expect(r.controller.getState()).toMatchObject({ status: 'ready', model: 'small' }));
    expect(overlap).toBe(false);
    expect(JSON.parse(r.storage.getItem('FORMAMORPH_corefActive')!).model).toBe('small');
    expect(r.caches.urls()).toEqual(urlsOf('small', 1));
  });

  it('reads a passage only once ready', async () => {
    const r = rig({ gpu: false });
    r.server.publish('small', 1);
    expect(await r.controller.readPassage('Mira left.', [], {})).toBeNull();
    await r.enable('small');
    r.host.resolve.mockResolvedValueOnce([[[0, 4], [13, 16]]]);
    const result = await r.controller.readPassage('Mira nodded. She left.', [{ id: 'mira', name: 'Mira', aliases: [], kind: 'unique' } as never], {});
    expect(result).toMatchObject({ model: 'small', version: 1 });
    expect(result?.reading.mentions).toEqual(expect.arrayContaining([{ start: 13, end: 16, entityId: 'mira' }]));
  });
});
