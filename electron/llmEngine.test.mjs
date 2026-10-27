import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import llmEngine from './llmEngine.cjs';
import llamaServer from './llamaServer.cjs';
import { countFakeTokens, createFakeLlamaServer, isCpuStart, loadFixture, loadGemmaFixture, loadThinkingFixture, renderChatMl } from './fakeLlamaServer.mjs';

const { createEngine, getState } = llmEngine;
const { GPU_LAYERS_AUTO, GPU_LAYERS_MAX, STATUS_EVENT, freePort } = llamaServer;

// The renderer's LocalLlmState (src/lib/imageGen/desktop.ts) promises every one of these on every status.
// A branch that forgets one hands the UI `undefined` where the type says `number | null`.
const STATE_KEYS = [
  'status', 'modelPath', 'modelId', 'port', 'error', 'loadProgress',
  'contextSize', 'gpuLayers', 'flashAttention', 'parallelRequests', 'unifiedKvCache', 'kCacheType', 'vCacheType', 'kvCacheInRam', 'maxContextSize', 'engineVramMB',
  'gpuBackend', 'gpuDeviceNames', 'deviceVramTotalMB', 'deviceVramFreeMB',
  'gpuDeviceIndex', 'gpuDeviceRawIndex', 'gpuDeviceOrigin', 'gpuDeviceOptions', 'serverPid',
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
  const chatEvents = [];
  engine = createEngine({ spawn: fake.spawn, binaryPath, platform, workRoot, listProcesses: fake.listProcesses, onChatEvent: (e) => chatEvents.push(e) });
  const seen = [];
  engine.onStatus((s) => seen.push(s));
  return { fake, seen, chatEvents };
}

afterEach(async () => {
  await engine?.stop();
  engine = null;
  if (workRoot) rmSync(workRoot, { recursive: true, force: true });
  workRoot = null;
});

/** A model and its `mmproj-<file name>` projector in a fresh folder under `root`. */
function visionModel(root) {
  const dir = mkdtempSync(path.join(root, 'models-'));
  const model = path.join(dir, 'Tiny-Q4_K_M.gguf');
  const projector = path.join(dir, 'mmproj-Tiny-Q4_K_M.gguf');
  writeFileSync(model, '');
  writeFileSync(projector, '');
  return { model, projector };
}

const callPart = (id) => ({ id, type: 'function', function: { name: 'roll', arguments: '{"sides":6}' } });
const toolCall = (id, content = null) => ({ role: 'assistant', content, tool_calls: [callPart(id)] });
const toolResult = (id, content) => ({ role: 'tool', tool_call_id: id, content });

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
      maxContextSize: 131072, engineVramMB: 3025, deviceVramTotalMB: 24138, deviceVramFreeMB: 23365,
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
      listProcesses: fake.listProcesses,
    });
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    const call = fake.routerCalls()[0];
    expect(preset).toBe(`version = 1\n\n[Tiny-Q4_K_M.gguf]\nmodel = ${MODEL.replace(/\\/g, '/')}\n`);
    expect(argsOf(call)).toContain('--offline');
    const cache = call.env.LLAMA_CACHE;
    expect(cache.startsWith(workRoot)).toBe(true);
    expect(readdirSync(cache)).toEqual([]);
  });

  it('adds a model’s paired projector to its preset section, and none to a model without one', async () => {
    const { fake } = setup();
    const presets = [];
    const spawn = fake.spawn;
    engine = createEngine({
      spawn: (bin, args, opts) => {
        if (!args.includes('--list-devices')) presets.push(readFileSync(after(args, '--models-preset'), 'utf8'));
        return spawn(bin, args, opts);
      },
      binaryPath: () => 'llama-server',
      platform: 'win32',
      workRoot,
    });
    const vision = visionModel(workRoot);
    await engine.start({ ...SETTINGS, modelPath: vision.model, port: await freePort() });
    await engine.stop();
    const plain = path.join(path.dirname(vision.model), 'Plain-Q4_K_M.gguf');
    writeFileSync(plain, '');
    await engine.start({ ...SETTINGS, modelPath: plain, port: await freePort() });
    /** The preset's key → value lines, the section header aside. */
    const keys = (ini) => Object.fromEntries(ini.split('\n').filter((l) => l.includes(' = ')).map((l) => l.split(' = ')));
    const vis = keys(presets[0]);
    expect(Object.keys(vis)).toEqual(['version', 'model', 'mmproj']);
    expect(path.resolve(vis.mmproj)).toBe(vision.projector);
    expect(vis.mmproj).not.toContain('\\');
    expect(presets[0]).toContain('[Tiny-Q4_K_M.gguf]');
    expect(Object.keys(keys(presets[1]))).toEqual(['version', 'model']);
    expect(path.resolve(keys(presets[1]).model)).toBe(plain);
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

describe('proxy request path', () => {
  /** A ready engine over a fake server; `chat(body)` posts to its front port. */
  async function ready(fakeOptions, { vision = false } = {}) {
    const { fake } = setup(fakeOptions);
    const port = await freePort();
    const modelPath = vision ? visionModel(workRoot).model : MODEL;
    // A failed start names its error here rather than as a refused connection later.
    expect(await engine.start({ ...SETTINGS, modelPath, port })).toMatchObject({ status: 'ready', error: null });
    const chat = (body, init = {}) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(body), ...init });
    return { fake, port, chat };
  }
  const sent = (fake) => fake.chatRequests.at(-1);
  const image = (n) => ({ type: 'image_url', image_url: { url: `data:image/png;base64,${n}` } });

  it('drops image parts the model cannot see and counts them in an exposed header', async () => {
    const { fake, chat } = await ready();
    const res = await chat({ messages: [
      { role: 'user', content: [{ type: 'text', text: 'Look.' }, image(1)] },
      { role: 'assistant', content: 'A cat.' },
      { role: 'user', content: [image(2), { type: 'text', text: 'And this?' }, image(3)] },
    ] });
    expect(res.headers.get('x-formamorph-images-dropped')).toBe('3');
    expect(res.headers.get('access-control-expose-headers')).toContain('X-Formamorph-Images-Dropped');
    expect(sent(fake).messages).toEqual([
      { role: 'user', content: 'Look.' },
      { role: 'assistant', content: 'A cat.' },
      { role: 'user', content: 'And this?' },
    ]);
  });

  it('passes image parts through when the model has a projector', async () => {
    const { fake, chat } = await ready(undefined, { vision: true });
    const res = await chat({ messages: [
      { role: 'system', content: [{ type: 'text', text: 'Narrate.' }, image(0)] },
      { role: 'user', content: [{ type: 'text', text: 'Look.' }, image(1)] },
      { role: 'assistant', content: 'A cat.' },
      { role: 'user', content: [image(2), { type: 'text', text: 'And this?' }] },
    ] });
    // A system message merges into one string, so its image still drops and counts.
    expect(res.headers.get('x-formamorph-images-dropped')).toBe('1');
    expect(sent(fake).messages).toEqual([
      { role: 'system', content: 'Narrate.' },
      { role: 'user', content: [{ type: 'text', text: 'Look.' }, image(1)] },
      { role: 'assistant', content: 'A cat.' },
      { role: 'user', content: [image(2), { type: 'text', text: 'And this?' }] },
    ]);
  });

  it('sets no image header when a projector sees every image', async () => {
    const { chat } = await ready(undefined, { vision: true });
    const res = await chat({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Look.' }, image(1)] }] });
    expect(res.headers.get('x-formamorph-images-dropped')).toBeNull();
  });

  it('sets no image header on a text-only request', async () => {
    const { chat } = await ready();
    const res = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.headers.get('x-formamorph-images-dropped')).toBeNull();
  });

  it('merges every system message into one at the top', async () => {
    const { fake, chat } = await ready();
    await chat({ messages: [
      { role: 'system', content: 'Rules.' },
      { role: 'user', content: 'u1' },
      { role: 'system', content: [{ type: 'text', text: 'World.' }] },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
    ] });
    expect(sent(fake).messages).toEqual([
      { role: 'system', content: 'Rules.\nWorld.' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
    ]);
  });

  it('sends the last message as a user turn, whatever its role, and drops other roles', async () => {
    const { fake, chat } = await ready();
    await chat({ messages: [
      { role: 'user', content: 'u1' },
      { role: 'tool', content: 'result', tool_call_id: 't1' },
      { role: 'assistant', content: 'Continue from here.' },
    ] });
    expect(sent(fake).messages).toEqual([
      { role: 'user', content: 'u1' },
      { role: 'user', content: 'Continue from here.' },
    ]);
    await chat({ messages: [{ role: 'user', content: 'u1' }, { role: 'system', content: 'Last word.' }] });
    expect(sent(fake).messages).toEqual([{ role: 'user', content: 'u1' }, { role: 'user', content: 'Last word.' }]);
  });

  it('sends every tool round unchanged: calls, results and reasoning, with a trailing tool message kept', async () => {
    const { fake, chat } = await ready();
    const messages = [
      { role: 'system', content: 'Narrate.' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1', reasoning_content: 'Plain thought.' },
      { role: 'user', content: 'Roll for it.' },
      { ...toolCall('call_1'), reasoning_content: 'I need a roll.' },
      toolResult('call_1', '4'),
      { role: 'assistant', content: 'Once more.', tool_calls: [callPart('call_2'), callPart('call_3')], reasoning_content: 'Two more.' },
      toolResult('call_2', '6'),
      toolResult('call_3', '1'),
    ];
    await chat({ messages });
    expect(sent(fake).messages).toEqual(messages);
  });

  it('keeps the other message rules in a tool conversation', async () => {
    const { fake, chat } = await ready();
    await chat({ messages: [
      { role: 'user', content: 'u1' },
      { role: 'system', content: 'Rules.' },
      { ...toolCall('call_1'), reasoning: 'Another field name.' },
      toolResult('call_1', [{ type: 'text', text: 'One.' }, { type: 'text', text: 'Two.' }]),
      { role: 'developer', content: 'Unknown role.' },
      { role: 'assistant', content: 'Continue from here.' },
    ] });
    expect(sent(fake).messages).toEqual([
      { role: 'system', content: 'Rules.' },
      { role: 'user', content: 'u1' },
      toolCall('call_1'),
      toolResult('call_1', 'One.\n\nTwo.'),
      { role: 'user', content: 'Continue from here.' },
    ]);
  });

  it('joins a message’s text parts with a blank line', async () => {
    const { fake, chat } = await ready();
    await chat({ messages: [{ role: 'user', content: [{ type: 'text', text: 'One.' }, { type: 'text', text: 'Two.' }] }] });
    expect(sent(fake).messages).toEqual([{ role: 'user', content: 'One.\n\nTwo.' }]);
  });

  it('passes every other request field through unchanged', async () => {
    const { fake, chat } = await ready();
    const fields = {
      response_format: { type: 'json_schema', json_schema: { name: 'turn', schema: { type: 'object', properties: { a: { type: 'string' } } } } },
      top_a: 0.2, // an Extra Parameter the app knows nothing about
      temperature: 0.7, top_p: 0.9, top_k: 40, min_p: 0.05, max_tokens: 300, stop: ['\n\n'],
      repetition_penalty: 1.1, repeat_penalty: 1.1,
      thinking_budget_tokens: 256, reasoning_budget_tokens: 128, reasoning_effort: 'none',
      chat_template_kwargs: { enable_thinking: false },
      seed: 42,
    };
    await chat({ model: 'whatever', messages: [{ role: 'user', content: 'hi' }], ...fields });
    const { model, messages, ...rest } = sent(fake);
    expect(rest).toEqual(fields);
    expect(model).toBe('Tiny-Q4_K_M.gguf');
    expect(messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('keeps the OpenAI reply shape, streamed and not', async () => {
    const { chat } = await ready();
    const expected = fixture.scenarios.loaded.chat.choices[0].message.content;
    const reply = await (await chat({ messages: [{ role: 'user', content: 'hi' }] })).json();
    expect(reply).toMatchObject({ object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: expected }, finish_reason: 'stop' }] });

    const res = await chat({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }, image(1)] }], stream: true });
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(res.headers.get('x-formamorph-images-dropped')).toBe('1');
    const frames = (await res.text()).split('\n\n').filter(Boolean).map((f) => f.replace(/^data: /, ''));
    expect(frames.at(-1)).toBe('[DONE]');
    const chunks = frames.slice(0, -1).map((f) => JSON.parse(f));
    expect(chunks.every((c) => c.object === 'chat.completion.chunk')).toBe(true);
    // The recorded stream is its own request, so its text can differ from the non-streamed reply.
    const recordedStream = fixture.scenarios.loaded.chatStream.split('\n\n').filter((f) => f.startsWith('data: {')).map((f) => JSON.parse(f.slice(6)));
    expect(chunks.map((c) => c.choices[0].delta.content ?? '').join('')).toBe(recordedStream.map((c) => c.choices[0].delta.content ?? '').join(''));
    expect(chunks.at(-1).choices[0].finish_reason).toBe('stop');
  });

  it('cancels the upstream request when the client hangs up mid-stream', async () => {
    const { fake, port } = await ready({ holdReply: true });
    // node:http, not fetch: the test environment's AbortSignal is not the one Node's fetch takes.
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/v1/chat/completions' });
    const firstFrame = new Promise((resolve) => req.on('response', (res) => res.once('data', resolve)));
    req.on('error', () => {});
    req.end(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }));
    await firstFrame; // the reply is mid-decode
    expect(fake.chatHangups).toHaveLength(0);
    req.destroy();
    await expect.poll(() => fake.chatHangups.length).toBe(1);
  });

  it('cancels the upstream request when the client hangs up before a non-stream reply', async () => {
    const { fake, port } = await ready({ holdReply: true });
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/v1/chat/completions' });
    req.on('error', () => {});
    req.end(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }));
    await expect.poll(() => fake.chatRequests.length).toBe(1); // upstream is decoding
    expect(fake.chatHangups).toHaveLength(0);
    req.destroy();
    await expect.poll(() => fake.chatHangups.length).toBe(1);
  });

  it('answers every */models path with the loaded model and its state', async () => {
    const { port } = await ready();
    for (const p of ['/v1/models', '/api/v0/models', '/models']) {
      const list = await (await fetch(`http://127.0.0.1:${port}${p}`)).json();
      expect(list).toEqual({ object: 'list', data: [{ id: 'Tiny-Q4_K_M.gguf', object: 'model', owned_by: 'formamorph', state: 'loaded' }] });
    }
  });

  it('runs the router with a separate reasoning field', async () => {
    const { fake } = await ready();
    expect(after(argsOf(fake.routerCalls()[0]), '--reasoning-format')).toBe('deepseek');
  });

  describe.each([
    ['a Qwen-style thinking model', loadThinkingFixture],
    ['a Gemma 4 model', loadGemmaFixture],
  ])('for %s', (_name, load) => {
    const THOUGHT_TAGS = /<think>|<\/think>|<\|channel>|<channel\|>/;
    const serve = async () => {
      const recorded = load();
      // The recorded turn, served by the loaded scenario of the pinned run.
      const loaded = { ...fixture.scenarios.loaded, chat: recorded.chat, chatStream: recorded.chatStream };
      return ready({ fixture: { ...fixture, scenarios: { ...fixture.scenarios, loaded } } });
    };

    it('passes the thought through in reasoning_content and keeps content free of thought tags', async () => {
      const { chat } = await serve();
      const message = (await (await chat({ messages: [{ role: 'user', content: 'What is 2+2? One word.' }] })).json()).choices[0].message;
      expect(message.reasoning_content.length).toBeGreaterThan(0);
      expect(message.content).not.toMatch(THOUGHT_TAGS);
    });

    it('streams the thought in reasoning_content deltas and none in content deltas', async () => {
      const { chat } = await serve();
      const deltas = (await (await chat({ messages: [{ role: 'user', content: 'hi' }], stream: true })).text())
        .split('\n\n').filter((f) => f.startsWith('data: {')).map((f) => JSON.parse(f.slice(6)).choices[0]?.delta ?? {});
      expect(deltas.map((d) => d.reasoning_content ?? '').join('').length).toBeGreaterThan(0);
      expect(deltas.map((d) => d.content ?? '').join('')).not.toMatch(THOUGHT_TAGS);
    });
  });
});

describe('Context Overflow', () => {
  // A 256-token slot. Each message costs 3 tokens plus its words in the fake's ChatML; the prompt adds 2.
  const N_CTX = 256;
  const words = (tag, n) => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');
  const sys = { role: 'system', content: words('s', 20) };
  const u1 = { role: 'user', content: words('first', 20) };
  const middle = ['a1', 'u2', 'a2', 'u3', 'a3'].map((t) => ({ role: t[0] === 'a' ? 'assistant' : 'user', content: words(t, 30) }));
  const latest = { role: 'user', content: words('latest', 20) };
  // 236 tokens: fits 256, overflows once 64 are kept for the answer.
  const story = [sys, u1, ...middle, latest];
  const tokensOf = (messages) => countFakeTokens(renderChatMl(messages));

  async function ready(policy, fakeOptions) {
    const { fake, chatEvents } = setup(fakeOptions);
    const port = await freePort();
    expect(await engine.start({ ...SETTINGS, contextSize: N_CTX, modelPath: MODEL, port, contextOverflow: policy })).toMatchObject({ status: 'ready' });
    const chat = (body) => fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(body) });
    return { fake, port, chat, chatEvents };
  }
  const sent = (fake) => fake.chatRequests.at(-1);

  it('passes a prompt that fits unchanged, under every policy', async () => {
    expect(tokensOf(story)).toBe(236);
    const { fake, chat } = await ready('truncateMiddle');
    for (const policy of ['truncateMiddle', 'rollingWindow', 'stopAtLimit']) {
      engine.setContextOverflow(policy);
      expect((await chat({ messages: story })).status).toBe(200);
      expect(sent(fake).messages).toEqual(story);
    }
  });

  it('Truncate Middle keeps the system prompt, the first user message and the latest, and drops whole messages between', async () => {
    const { fake, chat } = await ready('truncateMiddle');
    expect((await chat({ messages: story, max_tokens: 64 })).status).toBe(200);
    // The smallest cut that keeps turns alternating: a1 alone would put u2 after u1.
    expect(sent(fake).messages).toEqual([sys, u1, ...middle.slice(2), latest]);
    expect(tokensOf(sent(fake).messages)).toBeLessThanOrEqual(N_CTX - 64);
    expect(sent(fake).max_tokens).toBe(64);
  });

  it('Rolling Window keeps the system prompt and drops the oldest messages first', async () => {
    const { fake, chat } = await ready('rollingWindow');
    expect((await chat({ messages: story, max_tokens: 64 })).status).toBe(200);
    // u1 alone would leave a1 first after the system prompt, so a1 drops with it.
    expect(sent(fake).messages).toEqual([sys, ...middle.slice(1), latest]);
    expect(tokensOf(sent(fake).messages)).toBeLessThanOrEqual(N_CTX - 64);
  });

  it('Stop at Limit returns a context-length stop and sends nothing to the model', async () => {
    const { fake, chat } = await ready('stopAtLimit');
    const res = await chat({ messages: story, max_tokens: 64, stream: true });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatchObject({ type: 'exceed_context_size_error', n_prompt_tokens: 236, n_ctx: N_CTX });
    expect(error.message).toBe('This request needs 236 tokens, and “Context Size” leaves room for 192. Set “Context Overflow” to “Truncate Middle”, raise “Context Size”, or lower “Max Output Tokens”.');
    expect(fake.chatRequests).toHaveLength(0);
  });

  it('stops the same way when the messages a policy keeps are too long on their own', async () => {
    const longFirst = { role: 'user', content: words('first', 240) };
    const { fake, chat } = await ready('truncateMiddle');
    const res = await chat({ messages: [sys, longFirst, ...middle, latest] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe('The messages this request must keep need more than 256 tokens. Raise “Context Size”.');
    expect(fake.chatRequests).toHaveLength(0);
  });

  it('drops one more message rather than put two user turns together', async () => {
    const [a1, u2, a2] = [{ ...middle[0], content: words('a1', 60) }, middle[1], middle[2]];
    const { fake, chat } = await ready('truncateMiddle');
    // Dropping a1 alone fits, but leaves u1 then u2.
    expect((await chat({ messages: [sys, u1, a1, u2, a2, latest], max_tokens: 64 })).status).toBe(200);
    expect(sent(fake).messages).toEqual([sys, u1, a2, latest]);
  });

  it('breaks the turn order only when no cut that keeps it fits', async () => {
    const big = { role: 'assistant', content: words('big', 100) };
    const { fake, chat } = await ready('truncateMiddle');
    expect((await chat({ messages: [sys, u1, big, latest], max_tokens: 150 })).status).toBe(200);
    expect(sent(fake).messages).toEqual([sys, u1, latest]);
  });

  const shortReply = { role: 'assistant', content: words('a1', 10) };

  it('drops an older tool round only as a unit, call and results together', async () => {
    const older = [toolCall('call_1', words('call', 120)), toolResult('call_1', words('result', 10))];
    const current = [toolCall('call_2'), toolResult('call_2', words('now', 10))];
    const { fake, chat } = await ready('truncateMiddle');
    // Dropping the call alone fits, but leaves its result with no call.
    expect((await chat({ messages: [sys, u1, ...older, shortReply, latest, ...current], max_tokens: 64 })).status).toBe(200);
    expect(sent(fake).messages).toEqual([sys, u1, shortReply, latest, ...current]);
  });

  it('drops one older round of several without touching the next', async () => {
    const first = [toolCall('call_1', words('call', 60)), toolResult('call_1', words('result', 5))];
    const second = [toolCall('call_2', words('again', 60)), toolResult('call_2', words('result', 5))];
    const current = [toolCall('call_3'), toolResult('call_3', words('now', 10))];
    const { fake, chat } = await ready('truncateMiddle');
    expect((await chat({ messages: [sys, u1, ...first, ...second, shortReply, latest, ...current], max_tokens: 64 })).status).toBe(200);
    expect(sent(fake).messages).toEqual([sys, u1, ...second, shortReply, latest, ...current]);
  });

  it('Rolling Window drops older tool rounds whole and keeps the current one', async () => {
    const older = [toolCall('call_1', words('call', 120)), toolResult('call_1', words('result', 10))];
    const current = [toolCall('call_2'), toolResult('call_2', words('now', 10))];
    const { fake, chat } = await ready('rollingWindow');
    expect((await chat({ messages: [sys, u1, ...older, shortReply, latest, ...current], max_tokens: 64 })).status).toBe(200);
    expect(sent(fake).messages).toEqual([sys, latest, ...current]);
  });

  it('never cuts into the current tool round, and stops when it does not fit', async () => {
    const current = [toolCall('call_1'), toolResult('call_1', words('now', 200))];
    const { fake, chat } = await ready('truncateMiddle');
    const res = await chat({ messages: [sys, u1, shortReply, latest, ...current] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe('The messages this request must keep need more than 256 tokens. Raise “Context Size”.');
    expect(fake.chatRequests).toHaveLength(0);
  });

  it('counts the prompt as the router renders the whole request, not the messages alone', async () => {
    const { fake, chat } = await ready('truncateMiddle');
    const tools = [{ type: 'function', function: { name: 'roll', parameters: { type: 'object' } } }];
    await chat({ messages: story, max_tokens: 64, tools, stream: true });
    expect(fake.templateRequests.length).toBeGreaterThan(0);
    for (const r of fake.templateRequests) {
      expect(r).toMatchObject({ model: 'Tiny-Q4_K_M.gguf', tools, max_tokens: 64 });
      expect(r.stream).toBeUndefined();
    }
  });

  it('keeps at most half the slot for the answer, so a large max_tokens still leaves room for the prompt', async () => {
    const { fake, chat } = await ready('truncateMiddle');
    const res = await chat({ messages: story, max_tokens: 1000 });
    expect(res.status).toBe(200);
    expect(sent(fake).messages.slice(0, 2)).toEqual([sys, u1]);
    expect(sent(fake).messages.at(-1)).toEqual(latest);
    expect(tokensOf(sent(fake).messages)).toBeLessThanOrEqual(N_CTX / 2);
  });

  it('restates the server’s own context error, for a prompt the server counts longer, in the same words', async () => {
    // 200 tokens the template text doesn't show, as image embeddings are.
    const { chat } = await ready('stopAtLimit', { chatExtraTokens: 200 });
    const res = await chat({ messages: story });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toMatchObject({ type: 'exceed_context_size_error', n_prompt_tokens: 436, n_ctx: N_CTX });
    expect(error.message).toBe('This request needs 436 tokens, and “Context Size” leaves room for 256. Set “Context Overflow” to “Truncate Middle”, or raise “Context Size”.');
  });

  it('stops counting and sends nothing when the client hangs up mid-count', async () => {
    // The first count's tokenize stays held until the engine has seen the hangup.
    const { fake, port, chatEvents } = await ready('truncateMiddle', { holdTokenize: true });
    // node:http, not fetch: the test environment's AbortSignal is not the one Node's fetch takes.
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/v1/chat/completions' });
    req.on('error', () => {});
    req.end(JSON.stringify({ messages: story, max_tokens: 64 }));
    await expect.poll(() => fake.heldTokenize.length).toBe(1);
    req.destroy();
    await expect.poll(() => chatEvents).toEqual(['hangup']);
    fake.releaseTokenize();
    // The engine's end for this request: anything it would have sent upstream went out before it.
    await expect.poll(() => chatEvents.length).toBe(2);
    expect(chatEvents).toEqual(['hangup', 'dropped']);
    expect(fake.templateRequests).toHaveLength(1);
    expect(fake.heldTokenize).toHaveLength(1);
    expect(fake.chatRequests).toHaveLength(0);
  });

  it('applies a policy change to the next request with no reload', async () => {
    const { fake, chat } = await ready('truncateMiddle');
    engine.setContextOverflow('stopAtLimit');
    expect((await chat({ messages: story, max_tokens: 64 })).status).toBe(400);
    engine.setContextOverflow('rollingWindow');
    expect((await chat({ messages: story, max_tokens: 64 })).status).toBe(200);
    expect(sent(fake).messages[1]).toEqual(middle[1]);
    expect(fake.routerCalls()).toHaveLength(1);
  });

  it('reads an unknown policy as Truncate Middle', async () => {
    const { fake, chat } = await ready('dropEverything');
    await chat({ messages: story, max_tokens: 64 });
    expect(sent(fake).messages.slice(0, 2)).toEqual([sys, u1]);
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
    const { fake, seen } = setup({ scenarioFor: (args) => (isCpuStart(args) ? 'cpu' : 'kvFail') });
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
    const { fake } = setup({ scenarioFor: (args) => (isCpuStart(args) ? 'cpu' : 'kvFail') }, { platform: 'linux' });
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

describe('VRAM viewer fields from the load log', () => {
  /** The first status after `ready` that carries the instance pid. */
  const pidStatus = (seen) => new Promise((resolve) => {
    const hit = () => seen.find((s) => s.status === 'ready' && s.serverPid != null);
    if (hit()) return resolve(hit());
    const off = engine.onStatus(() => { if (hit()) { off(); resolve(hit()); } });
  });

  it('passes -lv 4, the verbosity that logs the device and buffer lines', async () => {
    const { fake } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(after(argsOf(fake.routerCalls()[0]), '-lv')).toBe('4');
  });

  it('fills share, free-at-load, total, names and backend from an Auto load', async () => {
    setup();
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    // Recorded: Vulkan0 model 2430.74 + KV 512 + compute 82.01 MiB; the CPU_Mapped and Vulkan_Host buffers stay out.
    expect(s).toMatchObject({
      engineVramMB: 3025, deviceVramFreeMB: 23365, deviceVramTotalMB: 24138,
      gpuBackend: 'vulkan', gpuDeviceNames: ['NVIDIA GeForce RTX 4090'],
    });
  });

  it('fills them from a fit-off load too', async () => {
    setup({ scenarioFor: () => 'max' });
    const s = await engine.start({ ...SETTINGS, gpuLayers: GPU_LAYERS_MAX, modelPath: MODEL, port: await freePort() });
    expect(s).toMatchObject({ engineVramMB: 3025, deviceVramFreeMB: 23370, deviceVramTotalMB: 24138 });
  });

  it('reports no share and no device VRAM after a CPU fallback', async () => {
    setup({ scenarioFor: (args) => (isCpuStart(args) ? 'cpu' : 'kvFail') });
    const s = await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect(s).toMatchObject({ status: 'ready', gpuBackend: 'cpu', engineVramMB: null, deviceVramFreeMB: null, deviceVramTotalMB: null });
  });

  it('totals only the devices the instance logged, not every enumerated one', async () => {
    // GPU Device All with an iGPU listed after the card; the recorded instance used Vulkan0 alone.
    setup({ listDevices: `${fixture.listDevices}  Vulkan1: Intel(R) UHD Graphics 770 (16252 MiB, 15000 MiB free)\r\n` });
    const s = await engine.start({ ...SETTINGS, gpuDevice: 'all', modelPath: MODEL, port: await freePort() });
    expect(s).toMatchObject({ deviceVramTotalMB: 24138, deviceVramFreeMB: 23365 });
  });

  it('drops the share when the model is lost, keeping the device line for the error', async () => {
    const { fake, seen } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    fake.routers[0].child.crash();
    await expect.poll(() => seen.at(-1).status).toBe('error');
    expect(seen.at(-1)).toMatchObject({ engineVramMB: null, serverPid: null, deviceVramTotalMB: 24138 });
  });

  it('attributes the model instance, not the router, and drops it on stop', async () => {
    const { fake, seen } = setup();
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    const s = await pidStatus(seen);
    expect(s.serverPid).toBe(fake.routers[0].instancePid);
    expect(s.serverPid).not.toBe(fake.routers[0].pid);
    await engine.stop();
    expect(engine.getState().serverPid).toBeNull();
  });

  it('finds the instance under the POSIX supervising shell', async () => {
    const { fake, seen } = setup({}, { platform: 'linux' });
    await engine.start({ ...SETTINGS, modelPath: MODEL, port: await freePort() });
    expect((await pidStatus(seen)).serverPid).toBe(fake.routers[0].instancePid);
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
