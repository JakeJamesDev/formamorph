// Desktop-only local LLM engine. Loads a GGUF via node-llama-cpp and serves a minimal OpenAI-compatible
// chat-completions endpoint on 127.0.0.1, so the renderer can point its normal OpenAI endpoint at
// http://localhost:<port>/v1 with no other changes.
//
// Hosted in a child process (llmEngineHost.cjs), not the Electron main process: model loads and token
// decoding are synchronous native work, and the main process's event loop is also the app's window message
// pump. The main process reaches it through llmEngineProxy.cjs, which keeps this module's exact API.
//
// Single model; N in-flight requests via a pool of context sequences (see start/handleChatCompletion).
// node-llama-cpp is ESM-only, so it's pulled in via dynamic import() from this CommonJS module.
const http = require('node:http');
const path = require('node:path');

const DEFAULT_PORT = 8977;

// gpuLayers sentinels (kept as numbers so the setting/IPC stay numeric): AUTO = offload as many layers as fit
// VRAM (node-llama-cpp default, omit the option); MAX = offload every layer ("max"). Any value >= 0 is a
// literal layer count. Mirror of GPU_LAYERS_AUTO/MAX in the renderer's settingsDefaults.
const GPU_LAYERS_AUTO = -1;
const GPU_LAYERS_MAX = -2;

// The load-dependent half of the status: the options the current model was loaded with, and the device
// node-llama-cpp picked for it. All null when nothing is loaded.
const NO_ENGINE = {
  contextSize: null,
  gpuLayers: null,
  flashAttention: null,
  parallelRequests: null,
  maxContextSize: null,
  engineVramMB: null,
  gpuBackend: null,
  gpuDeviceNames: null,
  deviceVramTotalMB: null,
  deviceVramFreeMB: null,
  gpuDeviceIndex: null,
  gpuDeviceOrigin: null,
  gpuDeviceOptions: null,
};

// Serializable status shared with the renderer (no live handles). status: stopped|loading|ready|error.
// contextSize/gpuLayers/flashAttention are the options the current model was loaded with, so the renderer
// can tell whether pending settings differ from what's actually applied.
/** The idle status, every field the renderer expects declared. Also the proxy's starting mirror. */
function stoppedState() {
  return { status: 'stopped', modelPath: null, modelId: null, port: null, error: null, loadProgress: null, ...NO_ENGINE };
}

let state = stoppedState();

let server = null;
let llama = null;
let model = null;
let context = null;
// The model's chat template, resolved once at load time. LlamaChatSession resolves it per session when left
// on "auto", which re-parses the template on every request (~250-430ms of synchronous work).
let chatWrapper = null;

// Parallel request slots: the context is created with N sequences (llama.cpp batches them), so up to N
// requests decode at once. `freeSequences` holds the idle ones; when all are busy, incoming requests wait in
// `waitQueue` (resolved as slots free) rather than being rejected. N sequences share the context's KV, so each
// slot's usable window is ~contextSize / N.
let sequences = [];
const freeSequences = [];
const waitQueue = [];

/** Take a free sequence, or wait in line until one is released. */
function acquireSequence() {
  return new Promise((resolve, reject) => {
    if (!sequences.length) return reject(new Error('Engine not ready.'));
    if (freeSequences.length) resolve(freeSequences.pop());
    else waitQueue.push(resolve);
  });
}

/** Return a sequence to the pool (clearing its KV first so no state bleeds into the next request), handing it
 *  straight to the next waiter if one is queued. */
async function releaseSequence(seq) {
  try { await seq.clearHistory?.(); } catch { /* a failed clear must not strand the slot */ }
  const next = waitQueue.shift();
  if (next) next(seq);
  else freeSequences.push(seq);
}

const statusListeners = new Set();

function getState() {
  return { ...state };
}

/** Replace the status and notify listeners (main forwards these to the renderer). */
function setState(next) {
  state = next;
  for (const cb of statusListeners) {
    try { cb(getState()); } catch { /* a bad listener must not break the engine */ }
  }
}

/** Subscribe to status changes; returns an unsubscribe function. */
function onStatus(cb) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

/** Split an OpenAI messages array into a node-llama-cpp chat history + the final prompt text. */
function splitMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const last = list[list.length - 1];
  const history = [];
  let system = '';
  for (const m of list.slice(0, -1)) {
    if (m.role === 'system') system += (system ? '\n' : '') + (m.content || '');
    else if (m.role === 'user') history.push({ type: 'user', text: m.content || '' });
    else if (m.role === 'assistant') history.push({ type: 'model', response: [m.content || ''] });
  }
  const chatHistory = system ? [{ type: 'system', text: system }, ...history] : history;
  return { chatHistory, promptText: last ? last.content || '' : '' };
}

/** Options passed to session.prompt(), mapped from the OpenAI request body. */
function promptOptions(body, onResponseChunk, signal) {
  const opts = { onResponseChunk };
  if (signal) opts.signal = signal;
  if (typeof body.temperature === 'number') opts.temperature = body.temperature;
  if (typeof body.top_p === 'number') opts.topP = body.top_p;
  if (typeof body.top_k === 'number') opts.topK = body.top_k;
  if (typeof body.min_p === 'number') opts.minP = body.min_p;
  if (typeof body.max_tokens === 'number') opts.maxTokens = body.max_tokens;
  // Reasoning cap (llama.cpp-server field name): budget the model's thought segment. 0 = no thinking.
  if (typeof body.thinking_budget_tokens === 'number') opts.budgets = { thoughtTokens: body.thinking_budget_tokens };
  if (typeof body.repetition_penalty === 'number') opts.repeatPenalty = { penalty: body.repetition_penalty };
  const stop = body.stop == null ? [] : Array.isArray(body.stop) ? body.stop : [body.stop];
  if (stop.length) opts.customStopTriggers = stop;
  return opts;
}

/**
 * Reconstruct the model's *verbatim* output from node-llama-cpp response chunks. `onTextChunk` drops
 * thought segments, so a reasoning model whose answer lands inside a `<think>` block (common with small
 * models, even under /no_think) would stream nothing — an empty completion. Instead we re-wrap thought
 * segments in `<think>…</think>` so the raw output reaches the client (which strips reasoning itself for
 * narration but needs the real content for choices/stats and the raw-output viewer). Comment segments and
 * main text pass through untagged. Returns { feed(chunk) → text delta, flush() → closing tag or '' }.
 */
function makeRawReconstructor() {
  let openTag = null;
  const tagFor = (chunk) => (chunk.type === 'segment' && chunk.segmentType === 'thought' ? 'think' : null);
  return {
    feed(chunk) {
      const tag = tagFor(chunk);
      let out = '';
      if (tag !== openTag) {
        if (openTag) out += `</${openTag}>`;
        if (tag) out += `<${tag}>`;
        openTag = tag;
      }
      return out + (chunk.text || '');
    },
    flush() {
      const out = openTag ? `</${openTag}>` : '';
      openTag = null;
      return out;
    },
  };
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function sendJson(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** node-llama-cpp lazy-imports the chat session class the first time we need it. */
let LlamaChatSession = null;

async function handleChatCompletion(req, res) {
  if (state.status !== 'ready') return sendJson(res, 503, { error: { message: 'Model is not loaded.' } });
  const body = JSON.parse((await readBody(req)) || '{}');
  const { chatHistory, promptText } = splitMessages(body.messages);
  const streaming = body.stream === true;
  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${created}`;

  // Abort the generation if the client disconnects — otherwise a canceled request would hold its slot until
  // it finished decoding on its own.
  const ac = new AbortController();
  const onClose = () => ac.abort();
  res.on('close', onClose);

  // Wait for a free parallel slot (queues transparently when all N are busy). A null slot means the engine was
  // torn down while we waited.
  let seq;
  try { seq = await acquireSequence(); } catch { seq = null; }
  if (!seq) { res.off('close', onClose); return sendJson(res, 503, { error: { message: 'Model is not loaded.' } }); }
  const session = new LlamaChatSession(chatWrapper ? { contextSequence: seq, chatWrapper } : { contextSequence: seq });
  session.setChatHistory(chatHistory);
  const raw = makeRawReconstructor();

  try {
    if (streaming) {
      cors(res);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const frame = (delta, finish = null) => {
        const chunk = { id, object: 'chat.completion.chunk', created, model: state.modelId, choices: [{ index: 0, delta, finish_reason: finish }] };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };
      frame({ role: 'assistant' });
      await session.prompt(promptText, promptOptions(body, (chunk) => {
        const delta = raw.feed(chunk);
        if (delta) frame({ content: delta });
      }, ac.signal));
      const tail = raw.flush();
      if (tail) frame({ content: tail });
      frame({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      let text = '';
      await session.prompt(promptText, promptOptions(body, (chunk) => { text += raw.feed(chunk); }, ac.signal));
      text += raw.flush();
      sendJson(res, 200, {
        id, object: 'chat.completion', created, model: state.modelId,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      });
    }
  } catch (e) {
    // A client-disconnect abort is expected — swallow it; anything else surfaces as a 500 (if not already sent).
    if (!ac.signal.aborted && !res.headersSent) sendJson(res, 500, { error: { message: String((e && e.message) || e) } });
    else if (!res.writableEnded) res.end();
  } finally {
    res.off('close', onClose);
    await releaseSequence(seq);
  }
}

async function router(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    // This matches ANY */models path, including LM Studio's native /api/v0/models — which callers probe
    // first and read `state` from. Reporting it keeps a reachability check honest about a loaded model
    // whatever name the request asks for; without it a probe reads "reachable, but no such model".
    return sendJson(res, 200, {
      object: 'list',
      data: [{
        id: state.modelId,
        object: 'model',
        owned_by: 'formamorph',
        state: state.status === 'ready' ? 'loaded' : 'not-loaded',
      }],
    });
  }
  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    return handleChatCompletion(req, res);
  }
  return sendJson(res, 404, { error: { message: `Unknown route ${req.method} ${url.pathname}` } });
}

/**
 * Load `modelPath` and start the local OpenAI server. Idempotent while loading/ready.
 * `contextSize` bounds the KV cache (VRAM); omit/0 for node-llama-cpp's auto sizing. `gpuLayers` is a
 * layer count (0 = CPU-only); omit/null to auto-offload as many layers as fit. `parallelRequests` is the
 * number of requests that can decode at once (context sequences); they share the KV, so each slot's window
 * is ~contextSize / parallelRequests. `gpuDeviceIndex` restricts the backend to one GPU (omit/null to leave
 * every visible one in play), `gpuDeviceOrigin` records where that choice came from, and `gpuDeviceOptions`
 * is the unfiltered device list it was chosen from — both for the readout.
 */
async function start({ modelPath, port = DEFAULT_PORT, contextSize, gpuLayers, flashAttention, parallelRequests, gpuDeviceIndex, gpuDeviceOrigin, gpuDeviceOptions } = {}) {
  if (state.status === 'loading' || state.status === 'ready') return getState();
  const slots = Math.max(1, typeof parallelRequests === 'number' ? parallelRequests : 1);
  // The options this model is (being) loaded with — surfaced in state so the renderer can compare against
  // pending settings.
  const applied = {
    contextSize: typeof contextSize === 'number' ? contextSize : null,
    // Store the requested value (incl. AUTO/MAX sentinels) so the renderer compares against exactly what it asked for.
    gpuLayers: typeof gpuLayers === 'number' ? gpuLayers : null,
    flashAttention: flashAttention === true,
    parallelRequests: slots,
    maxContextSize: null, // filled in once the model loads and reports its trained context length
    engineVramMB: null, // filled in from the device VRAM delta across load (our footprint per llama.cpp)
  };
  // Which backend and device node-llama-cpp selected, and the VRAM it sizes the load against. Captured
  // before the load so a failure still reports the device it tried: when CUDA breaks and llama.cpp falls
  // back to Vulkan on an iGPU, every model reports "not enough VRAM" while the discrete card sits idle.
  const device = {
    gpuBackend: null, gpuDeviceNames: null, deviceVramTotalMB: null, deviceVramFreeMB: null,
    gpuDeviceIndex: typeof gpuDeviceIndex === 'number' ? gpuDeviceIndex : null,
    gpuDeviceOrigin: typeof gpuDeviceOrigin === 'string' ? gpuDeviceOrigin : null,
    // The unfiltered enumeration the pin was resolved against — the engine itself can't report it once
    // pinned, and "which device, out of which" is the whole answer to a wrong-device report.
    gpuDeviceOptions: Array.isArray(gpuDeviceOptions) ? [...gpuDeviceOptions] : null,
  };
  // Restrict the Vulkan backend to one adapter before anything can initialize it. With several visible,
  // llama.cpp's memory accounting aggregates them and sizes the load against a figure belonging to no real
  // card. The variable is read once at backend init, so a changed pin needs a fresh process — which is why
  // the proxy ends the child on stop (see llmEngineProxy.cjs) rather than reusing it.
  if (device.gpuDeviceIndex != null) process.env.GGML_VK_VISIBLE_DEVICES = String(device.gpuDeviceIndex);
  else delete process.env.GGML_VK_VISIBLE_DEVICES;
  if (!modelPath) { setState({ status: 'error', modelPath: null, modelId: null, port, error: 'No modelPath provided.', loadProgress: null, ...NO_ENGINE, ...device }); return getState(); }
  setState({ status: 'loading', modelPath, modelId: path.basename(modelPath), port, error: null, loadProgress: 0, ...applied, ...device });
  try {
    const nlc = await import('node-llama-cpp');
    LlamaChatSession = nlc.LlamaChatSession;
    llama = await nlc.getLlama();
    // llama.gpu is false when no GPU backend was selected; report that as 'cpu' so the field is always a name.
    device.gpuBackend = llama.gpu === false ? 'cpu' : llama.gpu;
    try { device.gpuDeviceNames = await llama.getGpuDeviceNames(); } catch { /* not every backend enumerates devices */ }
    // Device VRAM before we allocate anything — the delta after load+context is our footprint (weights +
    // KV cache), from llama.cpp's own accounting. Robust across GPUs where per-process nvidia-smi is null.
    let vramUsedBefore = null;
    try {
      const vram = await llama.getVramState();
      vramUsedBefore = vram.used;
      device.deviceVramTotalMB = Math.round(vram.total / 1024 / 1024);
      device.deviceVramFreeMB = Math.round(vram.free / 1024 / 1024);
    } catch { /* not all backends report VRAM */ }
    // Publish the device now rather than at 'ready', so a slow load shows what it's loading onto.
    setState({ ...getState(), ...device });
    const loadOpts = { modelPath };
    // AUTO → fit layers around the KV cache we're about to allocate; MAX → "max" (all layers); else the
    // literal layer count. Auto-fitting without `fitContext` sizes layers to free VRAM alone and offloads
    // enough to leave the context no room, so createContext then rejects a size that would have fit — and
    // the more VRAM is free, the more it over-offloads. Requesting above the trained max only over-reserves
    // (createContext clamps below), which is the safe direction.
    if (gpuLayers === GPU_LAYERS_MAX) loadOpts.gpuLayers = 'max';
    else if (typeof gpuLayers === 'number' && gpuLayers >= 0) loadOpts.gpuLayers = gpuLayers;
    else if (typeof contextSize === 'number' && contextSize > 0) {
      loadOpts.gpuLayers = { fitContext: { contextSize } };
    }
    // llama.cpp reports load progress far more often than a status push is worth; whole percents cap this at
    // 100 messages for a load that otherwise sits silent for a minute on a 20GB model.
    let lastPct = -1;
    loadOpts.onLoadProgress = (p) => {
      const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
      if (pct === lastPct || state.status !== 'loading') return;
      lastPct = pct;
      setState({ ...getState(), loadProgress: pct });
    };
    model = await llama.loadModel(loadOpts);
    // Wrappers are immutable once constructed, so one instance serves every request's session. A resolution
    // failure falls back to per-session "auto", which is what an unresolved wrapper means to LlamaChatSession.
    try { chatWrapper = nlc.resolveChatWrapper(model); } catch { chatWrapper = null; }
    // The model's trained context length is the hard ceiling for contextSize — surface it so the UI can cap
    // its slider, and clamp our request to it (createContext rejects a contextSize above the trained max).
    const trainedMax = typeof model.trainContextSize === 'number' ? model.trainContextSize : null;
    applied.maxContextSize = trainedMax;
    const ctxOpts = { sequences: slots };
    if (typeof contextSize === 'number' && contextSize > 0) {
      ctxOpts.contextSize = trainedMax ? Math.min(contextSize, trainedMax) : contextSize;
    }
    if (flashAttention) ctxOpts.flashAttention = true;
    context = await model.createContext(ctxOpts);
    sequences = Array.from({ length: slots }, () => context.getSequence());
    freeSequences.length = 0;
    freeSequences.push(...sequences);
    waitQueue.length = 0;

    // Our VRAM footprint = how much device usage grew across load + context allocation.
    if (vramUsedBefore != null) {
      try {
        const grew = (await llama.getVramState()).used - vramUsedBefore;
        applied.engineVramMB = Math.max(0, Math.round(grew / 1024 / 1024));
      } catch { /* leave null */ }
    }

    server = http.createServer((req, res) => {
      router(req, res).catch((e) => {
        if (!res.headersSent) sendJson(res, 500, { error: { message: String((e && e.message) || e) } });
        else res.end();
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    setState({ status: 'ready', modelPath, modelId: path.basename(modelPath), port, error: null, loadProgress: null, ...applied, ...device });
  } catch (e) {
    await stop();
    // Keep the device diagnostics: which backend a failed load ran on is exactly what an out-of-VRAM error
    // can't tell you on its own.
    setState({ status: 'error', modelPath, modelId: null, port, error: String((e && e.message) || e), loadProgress: null, ...NO_ENGINE, ...device });
  }
  return getState();
}

/** Tear everything down and return to `stopped`. Safe to call when already stopped. */
async function stop() {
  try {
    if (server) {
      const s = server;
      // close() alone waits for keep-alive sockets (our streaming responses keep them open) to end,
      // which never happens — so destroy active connections too, letting close() actually resolve.
      await new Promise((resolve) => { s.close(resolve); s.closeAllConnections?.(); });
    }
  } catch { /* ignore */ }
  for (const seq of sequences) { try { seq?.dispose?.(); } catch { /* ignore */ } }
  try { if (context?.dispose) await context.dispose(); } catch { /* ignore */ }
  try { if (model?.dispose) await model.dispose(); } catch { /* ignore */ }
  // Reject anyone still queued for a slot so their request fails cleanly instead of hanging.
  for (const resolve of waitQueue.splice(0)) { try { resolve(null); } catch { /* ignore */ } }
  server = null; sequences = []; freeSequences.length = 0; context = null; model = null; llama = null; chatWrapper = null;
  setState(stoppedState());
  return getState();
}

/**
 * Enumerate every GPU the backend can see, without loading a model — the unfiltered list a pinned engine
 * can no longer report, and what the device picker offers. Meant for a short-lived process of its own:
 * initializing the backend here settles this process's device visibility for the rest of its life.
 */
async function listDevices() {
  delete process.env.GGML_VK_VISIBLE_DEVICES;
  const nlc = await import('node-llama-cpp');
  const backend = await nlc.getLlama();
  let gpuDeviceNames = null;
  try { gpuDeviceNames = await backend.getGpuDeviceNames(); } catch { /* not every backend enumerates devices */ }
  return { gpuBackend: backend.gpu === false ? 'cpu' : backend.gpu, gpuDeviceNames };
}

module.exports = { start, stop, getState, onStatus, stoppedState, listDevices };
