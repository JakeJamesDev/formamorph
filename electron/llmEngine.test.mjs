import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import llmEngine from './llmEngine.cjs';
import llamaServer from './llamaServer.cjs';
import { createFakeLlamaServer, loadFixture } from './fakeLlamaServer.mjs';

const { createEngine, getState } = llmEngine;
const { GPU_LAYERS_AUTO, GPU_LAYERS_MAX, STATUS_EVENT, freePort } = llamaServer;

// The renderer's LocalLlmState (src/lib/imageGen/desktop.ts) promises every one of these on every status.
// A branch that forgets one hands the UI `undefined` where the type says `number | null`.
const STATE_KEYS = [
  'status', 'modelPath', 'modelId', 'port', 'error', 'loadProgress',
  'contextSize', 'gpuLayers', 'flashAttention', 'parallelRequests', 'unifiedKvCache', 'kCacheType', 'vCacheType', 'kvCacheInRam', 'maxContextSize', 'engineVramMB',
  'gpuBackend', 'gpuDeviceNames', 'deviceVramTotalMB', 'deviceVramFreeMB',
  'gpuDeviceIndex', 'gpuDeviceRawIndex', 'gpuDeviceOrigin', 'gpuDeviceOptions',
];
const keysOf = (s) => Object.keys(s).sort();
const expectedKeys = [...STATE_KEYS].sort();

// Read at import: the renderer polls 'llm-status' on mount, so the declared initial state is what it sees on a
// desktop launch where no model was ever loaded.
const initialState = getState();

const fixture = loadFixture();
const MODEL = path.join(os.tmpdir(), 'models', 'Tiny-Q4_K_M.gguf');
const SETTINGS = { contextSize: 8192, gpuLayers: GPU_LAYERS_AUTO, flashAttention: true, parallelRequests: 2, unifiedKvCache: true, gpuDevice: 'auto' };

// A dGPU beside an iGPU, in the recorded line format: the case the device pin exists for.
const TWO_DEVICES = 'Available devices:\r\n  Vulkan0: Intel(R) UHD Graphics 770 (16252 MiB, 15000 MiB free)\r\n  Vulkan1: NVIDIA GeForce RTX 4080 (16376 MiB, 15500 MiB free)\r\n';

let engine = null;
let workRoot = null;

/** An engine over a fake server, recording every status it pushes. Windows unless `platform` says otherwise. */
function setup(fakeOptions = {}, { platform = 'win32', binaryPath = ({ cpu } = {}) => (cpu ? 'llama-server-cpu' : 'llama-server') } = {}) {
  const fake = createFakeLlamaServer(fakeOptions);
  workRoot = mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
  engine = createEngine({ spawn: fake.spawn, binaryPath, platform, workRoot });
  const seen = [];
  engine.onStatus((s) => seen.push(s));
  return { fake, seen };
}

afterEach(async () => {
  await engine?.stop();
  engine = null;
  if (workRoot) rmSync(workRoot, { recursive: true, force: true });
  workRoot = null;
});

const argsOf = (call) => call.args;
const after = (args, flag) => args[args.indexOf(flag) + 1];

describe('engine status shape', () => {
  it('declares every field up front, all null', () => {
    expect(keysOf(initialState)).toEqual(expectedKeys);
    expect(initialState.status).toBe('stopped');
    for (const k of STATE_KEYS.filter((k) => k !== 'status')) expect(initialState[k]).toBeNull();
  });

  it('keeps the full shape on the no-model error branch', async () => {
    setup();
    const s = await engine.start({ port: 1234 });
    expect(s.status).toBe('error');
    expect(keysOf(s)).toEqual(expectedKeys);
  });

  it('reports a missing bundled build by name, full shape', async () => {
    const fake = createFakeLlamaServer();
    engine = createEngine({ spawn: fake.spawn, binaryPath: () => null, platform: 'win32', workRoot: os.tmpdir() });
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/llama-server is missing/);
    expect(keysOf(s)).toEqual(expectedKeys);
  });

  it('hands out copies, so a caller cannot mutate the live state', () => {
    setup();
    const s = engine.getState();
    s.gpuBackend = 'cuda';
    expect(engine.getState().gpuBackend).toBeNull();
  });
});

describe('engine lifecycle through the fake server', () => {
  it('goes start → loading with percent → ready → stop, full shape at each step', async () => {
    const { seen } = setup();
    const port = await freePort();
    const ready = await engine.start({ ...SETTINGS, modelPath: MODEL, port });
    await engine.stop();

    for (const s of seen) expect(keysOf(s)).toEqual(expectedKeys);
    expect(seen.at(-1).status).toBe('stopped');
    const loading = seen.filter((s) => s.status === 'loading');
    // The recorded run's progress events, in whole percents, rising from 0 to 100.
    const pcts = [...new Set(loading.map((s) => s.loadProgress))];
    expect(pcts[0]).toBe(0);
    expect(pcts.at(-1)).toBe(100);
    expect(pcts.length).toBeGreaterThan(4);
    expect(pcts.every((p, i) => Number.isInteger(p) && (i === 0 || p > pcts[i - 1]))).toBe(true);
    expect(loading.every((s) => s.modelId === 'Tiny-Q4_K_M.gguf' && s.contextSize === 8192)).toBe(true);

    expect(ready).toMatchObject({
      status: 'ready', modelPath: MODEL, modelId: 'Tiny-Q4_K_M.gguf', port, error: null, loadProgress: null,
      contextSize: 8192, gpuLayers: GPU_LAYERS_AUTO, flashAttention: true, parallelRequests: 2, unifiedKvCache: true,
      maxContextSize: 131072, engineVramMB: null,
      gpuBackend: 'vulkan', gpuDeviceNames: ['NVIDIA GeForce RTX 4090'], gpuDeviceOptions: ['NVIDIA GeForce RTX 4090'],
      gpuDeviceIndex: null, gpuDeviceOrigin: null,
    });
    for (const k of STATE_KEYS.filter((k) => k !== 'status')) expect(seen.at(-1)[k]).toBeNull();
  });

  it('serves the model from a one-section preset, offline, with an empty model cache', async () => {
    const { fake } = setup();
    let preset = null;
    const spawn = fake.spawn;
    engine = createEngine({
      spawn: (bin, args, opts) => {
        if (!args.includes('--list-devices')) preset = readFileSync(after(args, '--models-preset'), 'utf8');
        return spawn(bin, args, opts);
      },
      binaryPath: () => 'llama-server',
      platform: 'win32',
      workRoot,
    });
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    const call = fake.routerCalls()[0];
    expect(preset).toBe(`version = 1\n\n[Tiny-Q4_K_M.gguf]\nmodel = ${MODEL.replace(/\\/g, '/')}\n`);
    expect(argsOf(call)).toContain('--offline');
    const cache = call.env.LLAMA_CACHE;
    expect(cache.startsWith(workRoot)).toBe(true);
    expect(readdirSync(cache)).toEqual([]);
  });

  it('pins the router event name the pinned build emits', () => {
    // The README names it model_status; the recorded build emits the name the engine listens for.
    const progress = fixture.scenarios.loaded.loadEvents.filter((e) => e.data?.progress);
    expect(progress.length).toBeGreaterThan(0);
    expect(new Set(progress.map((e) => e.event))).toEqual(new Set([STATUS_EVENT]));
  });

  it('forwards a chat request to the router with the served model name, and the reply back', async () => {
    const { fake } = setup();
    const port = await freePort();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port });
    const body = { model: 'whatever', messages: [{ role: 'user', content: 'hi' }], temperature: 0.7, response_format: { type: 'json_object' } };
    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(body) });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const reply = await res.json();
    expect(reply.choices[0].message.content).toBe(fixture.scenarios.loaded.chat.choices[0].message.content);
    expect(fake.chatRequests[0]).toEqual({ ...body, model: 'Tiny-Q4_K_M.gguf' });

    const streamed = await (await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ ...body, stream: true }) })).text();
    expect(streamed).toContain('data: [DONE]');
  });

  it('answers the */models probe with the loaded model', async () => {
    setup();
    const port = await freePort();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port });
    const list = await (await fetch(`http://127.0.0.1:${port}/api/v0/models`)).json();
    expect(list.data[0]).toMatchObject({ id: 'Tiny-Q4_K_M.gguf', state: 'loaded' });
  });

  it('leaves no llama-server process after stop', async () => {
    const { fake } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(fake.liveProcesses()).toBe(2);
    await engine.stop();
    expect(fake.liveProcesses()).toBe(0);
    expect(engine.getState().status).toBe('stopped');
    expect(readdirSync(workRoot)).toEqual([]);
  });

  it('stops a load part-way and leaves nothing running', async () => {
    const { fake, seen } = setup({ stepMs: 30 });
    const started = engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    await expect.poll(() => seen.some((s) => (s.loadProgress ?? 0) > 0)).toBe(true);
    await engine.stop();
    const s = await started;
    expect(s.status).toBe('stopped');
    expect(fake.liveProcesses()).toBe(0);
  });

  it('reports a router that dies after the load, once, and frees it', async () => {
    const { fake, seen } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    fake.routers[0].child.crash(3);
    await expect.poll(() => engine.getState().status).toBe('error');
    expect(engine.getState().error).toMatch(/stopped unexpectedly \(exit code 3\)/);
    expect(keysOf(engine.getState())).toEqual(expectedKeys);
    expect(seen.filter((s) => s.status === 'error')).toHaveLength(1);
  });

  it('reports a model instance that dies under a live router, and ends the router', async () => {
    const { fake } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    fake.routers[0].crashInstance();
    await expect.poll(() => engine.getState().status).toBe('error');
    expect(engine.getState().error).toBe('The model stopped unexpectedly (exit code 1).');
    await expect.poll(() => fake.liveProcesses()).toBe(0);
  });
});

describe('settings → server arguments', () => {
  const startWith = async (options, fakeOptions) => {
    const { fake } = setup(fakeOptions);
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort(), ...options });
    return { args: argsOf(fake.routerCalls()[0]), state: s, fake };
  };

  it('Context Size → -c', async () => {
    expect(after((await startWith({ contextSize: 12288 })).args, '-c')).toBe('12288');
  });

  it('GPU Layers Auto → -ngl auto with fit on', async () => {
    const { args } = await startWith({ gpuLayers: GPU_LAYERS_AUTO });
    expect(after(args, '-ngl')).toBe('auto');
    expect(after(args, '--fit')).toBe('on');
  });

  it('GPU Layers Max → -ngl all with fit off', async () => {
    const { args, state } = await startWith({ gpuLayers: GPU_LAYERS_MAX });
    expect(after(args, '-ngl')).toBe('all');
    expect(after(args, '--fit')).toBe('off');
    expect(state.gpuLayers).toBe(GPU_LAYERS_MAX);
  });

  it('GPU Layers Custom → -ngl N with fit off', async () => {
    const { args } = await startWith({ gpuLayers: 17 });
    expect(after(args, '-ngl')).toBe('17');
    expect(after(args, '--fit')).toBe('off');
  });

  it('Flash Attention on → -fa on, off → -fa off', async () => {
    expect(after((await startWith({ flashAttention: true })).args, '-fa')).toBe('on');
    await engine.stop();
    const off = await startWith({ flashAttention: false });
    expect(after(off.args, '-fa')).toBe('off');
    expect(off.state.flashAttention).toBe(false);
  });

  it('Parallel Requests → -np N on every start, one included', async () => {
    expect(after((await startWith({ parallelRequests: 3 })).args, '-np')).toBe('3');
    await engine.stop();
    expect(after((await startWith({ parallelRequests: 1 })).args, '-np')).toBe('1');
    await engine.stop();
    expect(after((await startWith({ parallelRequests: undefined })).args, '-np')).toBe('1');
  });

  it('Unified KV Cache on → --kv-unified and -c Context Size', async () => {
    const { args, state } = await startWith({ unifiedKvCache: true, contextSize: 8192, parallelRequests: 3 });
    expect(args).toContain('--kv-unified');
    expect(after(args, '-c')).toBe('8192');
    expect(state.unifiedKvCache).toBe(true);
  });

  it('Unified KV Cache off → -c Context Size × Parallel Requests, no --kv-unified', async () => {
    const { args, state } = await startWith({ unifiedKvCache: false, contextSize: 8192, parallelRequests: 3 });
    expect(args).not.toContain('--kv-unified');
    expect(after(args, '-c')).toBe('24576');
    expect(state.unifiedKvCache).toBe(false);
  });

  it('Unified KV Cache unset counts as on', async () => {
    const { args, state } = await startWith({ unifiedKvCache: undefined });
    expect(args).toContain('--kv-unified');
    expect(state.unifiedKvCache).toBe(true);
  });

  it('K and V Cache Type → -ctk and -ctv, and the applied types show in the status', async () => {
    const { args, state } = await startWith({ kCacheType: 'q8_0', vCacheType: 'q4_0' });
    expect(after(args, '-ctk')).toBe('q8_0');
    expect(after(args, '-ctv')).toBe('q4_0');
    expect(state).toMatchObject({ kCacheType: 'q8_0', vCacheType: 'q4_0' });
  });

  it('K and V Cache Type unset or unknown count as F16', async () => {
    const { args, state } = await startWith({ kCacheType: 'q5_1', vCacheType: undefined });
    expect(after(args, '-ctk')).toBe('f16');
    expect(after(args, '-ctv')).toBe('f16');
    expect(state).toMatchObject({ kCacheType: 'f16', vCacheType: 'f16' });
  });

  it('a quantized V cache with Flash Attention off falls back to F16; a quantized K stays', async () => {
    const { args, state } = await startWith({ kCacheType: 'q8_0', vCacheType: 'q8_0', flashAttention: false });
    expect(after(args, '-fa')).toBe('off');
    expect(after(args, '-ctk')).toBe('q8_0');
    expect(after(args, '-ctv')).toBe('f16');
    expect(state.vCacheType).toBe('f16');
  });

  it('KV Cache in RAM on → -nkvo; off or unset → no -nkvo', async () => {
    const on = await startWith({ kvCacheInRam: true });
    expect(on.args).toContain('-nkvo');
    expect(on.state.kvCacheInRam).toBe(true);
    const off = await startWith({ kvCacheInRam: undefined });
    expect(off.args).not.toContain('-nkvo');
    expect(off.state.kvCacheInRam).toBe(false);
  });

  it('GPU Device by name → --device with that device id, resolved by name', async () => {
    const { args, state } = await startWith({ gpuDevice: 'NVIDIA GeForce RTX 4080' }, { listDevices: TWO_DEVICES });
    expect(after(args, '--device')).toBe('Vulkan1');
    expect(state).toMatchObject({
      gpuDeviceIndex: 1, gpuDeviceOrigin: 'manual', gpuDeviceNames: ['NVIDIA GeForce RTX 4080'],
      gpuDeviceOptions: ['Intel(R) UHD Graphics 770', 'NVIDIA GeForce RTX 4080'],
    });
  });

  it('GPU Device Auto pins the one real card beside an iGPU', async () => {
    const { args, state } = await startWith({ gpuDevice: 'auto', nvidiaGpus: [{ name: 'NVIDIA GeForce RTX 4080' }] }, { listDevices: TWO_DEVICES });
    expect(after(args, '--device')).toBe('Vulkan1');
    expect(state.gpuDeviceOrigin).toBe('auto');
  });

  it('GPU Device All passes no --device', async () => {
    const { args, state } = await startWith({ gpuDevice: 'all' }, { listDevices: TWO_DEVICES });
    expect(args).not.toContain('--device');
    expect(state.gpuDeviceIndex).toBeNull();
  });

  it('a chosen device that is gone falls back to Auto and says so', async () => {
    const { args, state } = await startWith({ gpuDevice: 'AMD Radeon RX 7900 XTX' }, { listDevices: TWO_DEVICES });
    expect(after(args, '--device')).toBe('Vulkan1');
    expect(state.gpuDeviceOrigin).toBe('fallback-auto');
  });

  it('uses one pinning scheme only: no Vulkan visibility variable', async () => {
    const { fake } = await startWith({ gpuDevice: 'NVIDIA GeForce RTX 4080' }, { listDevices: TWO_DEVICES });
    expect(fake.routerCalls()[0].env).not.toHaveProperty('GGML_VK_VISIBLE_DEVICES');
  });
});

describe('CPU fallback and load errors', () => {
  it('retries a failed GPU load once on the CPU and reports the CPU backend', async () => {
    const { fake, seen } = setup({ scenarioFor: (args) => (args.includes('none') ? 'cpu' : 'kvFail') });
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('ready');
    expect(s.gpuBackend).toBe('cpu');
    expect(s.error).toBeNull();
    const calls = fake.routerCalls();
    expect(calls).toHaveLength(2);
    expect(after(argsOf(calls[1]), '--device')).toBe('none');
    expect(after(argsOf(calls[1]), '-ngl')).toBe('0');
    // The failed GPU router is gone before the CPU one runs.
    expect(fake.routers[0].child.alive).toBe(false);
    expect(seen.filter((x) => x.status === 'loading').at(-1).gpuBackend).toBe('cpu');
  });

  it('reports a failed CPU retry with the GPU attempt’s error in setting names', async () => {
    const { fake } = setup({ scenarioFor: () => 'kvFail' });
    const s = await engine.start({ ...SETTINGS, unifiedKvCache: false, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('error');
    expect(s.error).toBe("Context Size 8192 with 2 Parallel Requests doesn't fit in this GPU's VRAM. Lower Context Size or Parallel Requests.");
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(fake.routerCalls()).toHaveLength(2);
    expect(fake.liveProcesses()).toBe(0);
  });

  it('falls back to the separate CPU build on Linux, under the supervising shell', async () => {
    const { fake } = setup({ scenarioFor: (args) => (args.includes('none') ? 'cpu' : 'kvFail') }, { platform: 'linux' });
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('ready');
    expect(s.gpuBackend).toBe('cpu');
    expect(fake.routerCalls().map((c) => [c.bin, c.wrapped])).toEqual([['llama-server', true], ['llama-server-cpu', true]]);
  });

  it('reports a failed CPU-only load in setting names, naming RAM', async () => {
    const { fake } = setup({ listDevices: 'Available devices:\r\n', scenarioFor: () => 'kvFail' });
    const s = await engine.start({ ...SETTINGS, unifiedKvCache: false, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('error');
    expect(s.error).toBe("Context Size 8192 with 2 Parallel Requests doesn't fit in this computer's RAM. Lower Context Size or Parallel Requests.");
    expect(fake.routerCalls()).toHaveLength(1);
  });

  it('loads straight on the CPU when there is no GPU device', async () => {
    const { fake } = setup({ listDevices: 'Available devices:\r\n' });
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(s.status).toBe('ready');
    expect(s.gpuBackend).toBe('cpu');
    expect(fake.routerCalls()).toHaveLength(1);
    expect(after(argsOf(fake.routerCalls()[0]), '--device')).toBe('none');
  });
});

describe('device listing', () => {
  it('lists every device --list-devices reports', async () => {
    setup({ listDevices: TWO_DEVICES });
    await expect(engine.listDevices()).resolves.toEqual({
      gpuBackend: 'vulkan', gpuDeviceNames: ['Intel(R) UHD Graphics 770', 'NVIDIA GeForce RTX 4080'],
    });
  });
});
