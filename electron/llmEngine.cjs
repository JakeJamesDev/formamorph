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
let state = { status: 'stopped', modelPath: null, modelId: null, port: null, error: null };

let server = null;
let llama = null;
let model = null;
let context = null;
let sequence = null;
let busy = false; // one context sequence → serialize requests; concurrent calls get a 429.

function getState() {
  return { ...state };
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
function promptOptions(body, onTextChunk) {
  const opts = { onTextChunk };
  if (typeof body.temperature === 'number') opts.temperature = body.temperature;
  if (typeof body.top_p === 'number') opts.topP = body.top_p;
  if (typeof body.max_tokens === 'number') opts.maxTokens = body.max_tokens;
  const stop = body.stop == null ? [] : Array.isArray(body.stop) ? body.stop : [body.stop];
  if (stop.length) opts.customStopTriggers = stop;
  return opts;
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

  try {
    if (streaming) {
      cors(res);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const frame = (delta, finish = null) => {
        const chunk = { id, object: 'chat.completion.chunk', created, model: state.modelId, choices: [{ index: 0, delta, finish_reason: finish }] };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };
      frame({ role: 'assistant' });
      await session.prompt(promptText, promptOptions(body, (chunk) => frame({ content: chunk })));
      frame({}, 'stop');
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const text = await session.prompt(promptText, promptOptions(body));
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

/** Load `modelPath` and start the local OpenAI server. Idempotent while loading/ready. */
async function start({ modelPath, port = DEFAULT_PORT } = {}) {
  if (state.status === 'loading' || state.status === 'ready') return getState();
  if (!modelPath) { state = { status: 'error', modelPath: null, modelId: null, port, error: 'No modelPath provided.' }; return getState(); }
  state = { status: 'loading', modelPath, modelId: path.basename(modelPath), port, error: null };
  try {
    const nlc = await import('node-llama-cpp');
    LlamaChatSession = nlc.LlamaChatSession;
    llama = await nlc.getLlama();
    model = await llama.loadModel({ modelPath });
    context = await model.createContext();
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
    state = { status: 'ready', modelPath, modelId: path.basename(modelPath), port, error: null };
  } catch (e) {
    await stop();
    state = { status: 'error', modelPath, modelId: null, port, error: String((e && e.message) || e) };
  }
  return getState();
}

/** Tear everything down and return to `stopped`. Safe to call when already stopped. */
async function stop() {
  try { if (server) await new Promise((r) => server.close(r)); } catch { /* ignore */ }
  try { if (sequence?.dispose) sequence.dispose(); } catch { /* ignore */ }
  try { if (context?.dispose) await context.dispose(); } catch { /* ignore */ }
  try { if (model?.dispose) await model.dispose(); } catch { /* ignore */ }
  server = null; sequence = null; context = null; model = null; llama = null; busy = false;
  state = { status: 'stopped', modelPath: null, modelId: null, port: null, error: null };
  return getState();
}

module.exports = { start, stop, getState };
