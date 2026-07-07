// Desktop-only local LLM engine. Loads a GGUF via node-llama-cpp (in the Electron main process) and
// serves a minimal OpenAI-compatible chat-completions endpoint on 127.0.0.1, so the renderer can point
// its normal OpenAI endpoint at http://localhost:<port>/v1 with no other changes.
//
// First slice: single model, single in-flight request, no downloader/model-picker (that's a later slice).
// node-llama-cpp is ESM-only, so it's pulled in via dynamic import() from this CommonJS module.
const http = require('node:http');
const path = require('node:path');

const DEFAULT_PORT = 8977;

// Serializable status shared with the renderer (no live handles). status: stopped|loading|ready|error.
// contextSize/gpuLayers/flashAttention are the options the current model was loaded with (null when none),
// so the renderer can tell whether pending settings differ from what's actually applied.
let state = { status: 'stopped', modelPath: null, modelId: null, port: null, error: null, contextSize: null, gpuLayers: null, flashAttention: null };

let server = null;
let llama = null;
let model = null;
let context = null;
let sequence = null;
let busy = false; // one context sequence → serialize requests; concurrent calls get a 429.

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
function promptOptions(body, onResponseChunk) {
  const opts = { onResponseChunk };
  if (typeof body.temperature === 'number') opts.temperature = body.temperature;
  if (typeof body.top_p === 'number') opts.topP = body.top_p;
  if (typeof body.top_k === 'number') opts.topK = body.top_k;
  if (typeof body.min_p === 'number') opts.minP = body.min_p;
  if (typeof body.max_tokens === 'number') opts.maxTokens = body.max_tokens;
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
  if (busy) return sendJson(res, 429, { error: { message: 'Model is busy with another request.' } });
  const body = JSON.parse((await readBody(req)) || '{}');
  const { chatHistory, promptText } = splitMessages(body.messages);
  const streaming = body.stream === true;
  const created = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${created}`;

  busy = true;
  const session = new LlamaChatSession({ contextSequence: sequence });
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
      }));
      const tail = raw.flush();
      if (tail) frame({ content: tail });
      frame({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      let text = '';
      await session.prompt(promptText, promptOptions(body, (chunk) => { text += raw.feed(chunk); }));
      text += raw.flush();
      sendJson(res, 200, {
        id, object: 'chat.completion', created, model: state.modelId,
        choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      });
    }
  } finally {
    busy = false;
  }
}

async function router(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    return sendJson(res, 200, { object: 'list', data: [{ id: state.modelId, object: 'model', owned_by: 'formamorph' }] });
  }
  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    return handleChatCompletion(req, res);
  }
  return sendJson(res, 404, { error: { message: `Unknown route ${req.method} ${url.pathname}` } });
}

/**
 * Load `modelPath` and start the local OpenAI server. Idempotent while loading/ready.
 * `contextSize` bounds the KV cache (VRAM); omit/0 for node-llama-cpp's auto sizing. `gpuLayers` is a
 * layer count (0 = CPU-only); omit/null to auto-offload as many layers as fit.
 */
async function start({ modelPath, port = DEFAULT_PORT, contextSize, gpuLayers, flashAttention } = {}) {
  if (state.status === 'loading' || state.status === 'ready') return getState();
  // The options this model is (being) loaded with — surfaced in state so the renderer can compare against
  // pending settings.
  const applied = {
    contextSize: typeof contextSize === 'number' ? contextSize : null,
    gpuLayers: typeof gpuLayers === 'number' ? gpuLayers : null,
    flashAttention: flashAttention === true,
  };
  if (!modelPath) { setState({ status: 'error', modelPath: null, modelId: null, port, error: 'No modelPath provided.', contextSize: null, gpuLayers: null, flashAttention: null }); return getState(); }
  setState({ status: 'loading', modelPath, modelId: path.basename(modelPath), port, error: null, ...applied });
  try {
    const nlc = await import('node-llama-cpp');
    LlamaChatSession = nlc.LlamaChatSession;
    llama = await nlc.getLlama();
    const loadOpts = { modelPath };
    if (typeof gpuLayers === 'number') loadOpts.gpuLayers = gpuLayers;
    model = await llama.loadModel(loadOpts);
    const ctxOpts = {};
    if (typeof contextSize === 'number' && contextSize > 0) ctxOpts.contextSize = contextSize;
    if (flashAttention) ctxOpts.flashAttention = true;
    context = await model.createContext(ctxOpts);
    sequence = context.getSequence();

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
    setState({ status: 'ready', modelPath, modelId: path.basename(modelPath), port, error: null, ...applied });
  } catch (e) {
    await stop();
    setState({ status: 'error', modelPath, modelId: null, port, error: String((e && e.message) || e), contextSize: null, gpuLayers: null, flashAttention: null });
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
  try { if (sequence?.dispose) sequence.dispose(); } catch { /* ignore */ }
  try { if (context?.dispose) await context.dispose(); } catch { /* ignore */ }
  try { if (model?.dispose) await model.dispose(); } catch { /* ignore */ }
  server = null; sequence = null; context = null; model = null; llama = null; busy = false;
  setState({ status: 'stopped', modelPath: null, modelId: null, port: null, error: null, contextSize: null, gpuLayers: null, flashAttention: null });
  return getState();
}

module.exports = { start, stop, getState, onStatus };
