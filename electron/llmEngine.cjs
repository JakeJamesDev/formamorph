// Desktop-only local LLM engine. Runs the bundled llama.cpp `llama-server` in router mode and serves an
// OpenAI-compatible endpoint on 127.0.0.1, so the renderer points its normal OpenAI endpoint at
// http://localhost:<port>/v1 with no other changes.
//
// Hosted in a child process (llmEngineHost.cjs), not the Electron main process. The main process reaches it
// through llmEngineProxy.cjs, which keeps this module's exact API.
//
// One model per start, loaded and unloaded through the router's API; its status stream carries the progress.
// The router dies with this process (llamaServer.spawnCommand); its model instance exits on stdin EOF.
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const llamaServer = require('./llamaServer.cjs');
const { selectEngineDevice } = require('./engineDevice.cjs');
const { shapeChatBody } = require('./chatShape.cjs');
const { findProjector } = require('./modelScan.cjs');
const contextOverflow = require('./contextOverflow.cjs');

const { errorText } = llamaServer;

const DEFAULT_PORT = 8977;

// How long a stop waits on the router to unload the model and exit before it stops asking.
const STOP_TIMEOUT_MS = 5000;
// How long the router has to start listening.
const BOOT_TIMEOUT_MS = 30000;
// Instance log lines kept for a load error.
const LOG_LINES_KEPT = 200;

// The load-dependent half of the status: the options the current model was loaded with, and the device it
// runs on. All null when nothing is loaded.
const NO_ENGINE = {
  contextSize: null,
  gpuLayers: null,
  flashAttention: null,
  parallelRequests: null,
  unifiedKvCache: null,
  kCacheType: null,
  vCacheType: null,
  kvCacheInRam: null,
  maxContextSize: null,
  engineVramMB: null,
  gpuBackend: null,
  gpuDeviceNames: null,
  deviceVramTotalMB: null,
  deviceVramFreeMB: null,
  gpuDeviceIndex: null,
  gpuDeviceRawIndex: null,
  gpuDeviceOrigin: null,
  gpuDeviceOptions: null,
  serverPid: null,
};

// Serializable status shared with the renderer (no live handles). status: stopped|loading|ready|error.
// contextSize/gpuLayers/flashAttention are the options the current model was loaded with, so the renderer
// can tell whether pending settings differ from what's actually applied.
/** The idle status, every field the renderer expects declared. Also the proxy's starting mirror. */
function stoppedState() {
  return { status: 'stopped', modelPath: null, modelId: null, port: null, error: null, loadProgress: null, ...NO_ENGINE };
}

/** Response header carrying the count of image parts the engine dropped. */
const IMAGES_DROPPED_HEADER = 'X-Formamorph-Images-Dropped';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', IMAGES_DROPPED_HEADER);
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

/** A JSON request to the router. Resolves { status, body }; rejects when the router can't be reached. */
function routerRequest(port, method, urlPath, payload) {
  return new Promise((resolve, reject) => {
    const data = payload == null ? null : JSON.stringify(payload);
    // A connection of its own: the router closes a proxied route's socket, so a pooled one fails on reuse.
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, agent: false, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(text); } catch { body = text; }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.end(data ?? undefined);
  });
}

const withTimeout = (promise, ms) => {
  let timer;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(resolve, ms); })]).finally(() => clearTimeout(timer));
};

/**
 * One engine over its own `llama-server`. `spawn` starts processes (the fake server's seam), `binaryPath`
 * finds the bundled build, `workRoot` holds each start's preset and empty model cache. `onChatEvent(name)` hears a
 * proxied chat's `hangup` and its end: `dropped`, `stopped` or `forwarded`.
 */
function createEngine({ spawn = childProcess.spawn, binaryPath = llamaServer.binaryPath, platform = process.platform, workRoot = os.tmpdir(), listProcesses = () => llamaServer.listProcesses({ platform }), onChatEvent = () => {} } = {}) {
  let state = stoppedState();
  const statusListeners = new Set();
  // The live start (see `start`). Null while stopped.
  let launch = null;
  let starts = 0;
  // Applies to the next chat request; changing it needs no reload.
  let overflowPolicy = contextOverflow.DEFAULT_POLICY;

  const getState = () => ({ ...state });

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

  /** Every device `llama-server --list-devices` reports, for the device picker. */
  async function listDevices() {
    return llamaServer.deviceListing(await llamaServer.listServerDevices({ bin: binaryPath({ platform }), spawn }));
  }

  /**
   * Start one router and load the model. Resolves { ok: true, info } with the router's loaded-model info, or
   * { ok: false, error } with the load error in setting names. `launch.server` holds the router meanwhile.
   */
  function attempt(l, { cpu }) {
    const bin = cpu && llamaServer.cpuNeedsOwnBuild(platform) ? binaryPath({ platform, cpu: true }) : l.bin;
    if (!bin) return Promise.resolve({ ok: false, error: 'The bundled llama-server is missing. Reinstall Formamorph.' });
    return new Promise((resolve) => {
      let settled = false;
      let bootTimer = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(bootTimer);
        resolve(result);
      };
      // One router process: its port, status stream, exit, and the instance's recent log lines.
      const server = { modelId: l.modelId, child: null, port: null, sse: null, exited: Promise.resolve(null), loaded: false, unloaded: null, onLost: null, log: [], memory: llamaServer.memoryTally() };
      l.server = server;
      const fail = (fallback) => finish({ ok: false, error: llamaServer.describeLoadError(server.log, { ...l.settings, cpu }) ?? fallback });

      llamaServer.freePort().then((port) => {
        if (l.aborted) return finish({ ok: false, error: null });
        server.port = port;
        const args = llamaServer.serverArgs({ presetPath: l.presetPath, port, ...l.settings, device: cpu ? null : l.device, cpu });
        const cmd = llamaServer.spawnCommand(bin, args, platform);
        let child;
        try {
          child = spawn(cmd.command, cmd.args, { stdio: [cmd.stdin, 'pipe', 'pipe'], env: { ...process.env, LLAMA_CACHE: l.cacheDir }, windowsHide: true });
        } catch (e) {
          return finish({ ok: false, error: errorText(e) });
        }
        server.child = child;
        // A spawn that fails emits `error` without `exit`; either one ends this process's life.
        server.exited = new Promise((done) => {
          child.once('exit', (code) => done(code));
          child.once('error', (e) => { finish({ ok: false, error: errorText(e) }); done(null); });
        });
        server.exited.then((code) => {
          const error = `llama-server stopped unexpectedly (exit code ${code}).`;
          fail(error);
          server.onLost?.(error);
        });

        bootTimer = setTimeout(() => fail('llama-server did not start.'), BOOT_TIMEOUT_MS);
        let partial = '';
        let listening = false;
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
          partial += chunk;
          const lines = partial.split('\n');
          partial = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            const entry = llamaServer.parseLogLine(line);
            if (entry.port != null) {
              if (!server.loaded) server.memory.feed(entry.text);
              server.log.push(entry.text);
              if (server.log.length > LOG_LINES_KEPT) server.log.shift();
            } else if (!listening && entry.text.includes('listening on')) {
              listening = true;
              clearTimeout(bootTimer);
              subscribeAndLoad();
            }
          }
        });
        child.stderr.on('data', () => { /* --log-jsonl sends everything to stdout */ });
      }, (e) => finish({ ok: false, error: errorText(e) }));

      // The status stream first, so no event of the load falls before the subscription.
      function subscribeAndLoad() {
        const reader = llamaServer.sseReader();
        const req = http.get({ host: '127.0.0.1', port: server.port, path: '/models/sse' }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => { for (const e of reader.feed(chunk)) onEvent(e); });
          routerRequest(server.port, 'POST', '/models/load', { model: l.modelId }).then(({ status, body }) => {
            if (status !== 200 || body?.success !== true) fail(`llama-server refused the load: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
          }, () => fail('llama-server stopped answering.'));
        });
        req.on('error', () => { /* the router went away; its exit settles the attempt */ });
        server.sse = req;
      }

      function onEvent(e) {
        if (e.event !== llamaServer.STATUS_EVENT || e.model !== l.modelId) return;
        const status = e.data?.status;
        if (status === 'loading') {
          const pct = llamaServer.loadPercent(e.data.progress);
          if (pct != null && !l.aborted && state.status === 'loading' && pct !== state.loadProgress) setState({ ...getState(), loadProgress: pct });
        } else if (status === 'loaded') {
          server.loaded = true;
          finish({ ok: true, info: e.data.info ?? null });
        } else if (status === 'unloaded') {
          server.unloaded?.();
          if (server.loaded) server.onLost?.(`The model stopped unexpectedly (exit code ${e.data.exit_code ?? 'unknown'}).`);
          else fail(`llama-server could not load the model (exit code ${e.data.exit_code ?? 'unknown'}).`);
        }
      }
    });
  }

  /** Unload, then end the router. Safe on a router that never started or already exited. */
  async function endServer(server) {
    if (!server?.child) return;
    if (server.loaded && server.port) {
      const unloaded = new Promise((resolve) => { server.unloaded = resolve; });
      try {
        await withTimeout(routerRequest(server.port, 'POST', '/models/unload', { model: server.modelId }).then(() => unloaded), STOP_TIMEOUT_MS);
      } catch { /* the router is gone; the kill below is a no-op */ }
    }
    try { server.sse?.destroy(); } catch { /* ignore */ }
    try { server.child.kill(); } catch { /* already gone */ }
    await withTimeout(server.exited, STOP_TIMEOUT_MS);
  }

  /** Ends a start's front server and router. Once per start; `l.done` settles when everything is gone. */
  function teardown(l) {
    l.aborted = true;
    l.done ??= endLaunch(l);
    return l.done;
  }

  async function endLaunch(l) {
    if (l.front) {
      const s = l.front;
      // close() alone waits for keep-alive sockets (streaming responses keep them open), so end those too.
      await new Promise((resolve) => { s.close(resolve); s.closeAllConnections?.(); });
    }
    await endServer(l.server);
    try { fs.rmSync(l.workDir, { recursive: true, force: true }); } catch { /* a temp folder left behind costs nothing */ }
  }

  /** The tokens `body` renders to, by the router's own template and tokenizer. */
  async function promptTokens(l, body) {
    const { stream, stream_options: _streamOptions, ...rest } = body;
    const rendered = await routerRequest(l.server.port, 'POST', '/apply-template', rest);
    if (rendered.status !== 200 || typeof rendered.body?.prompt !== 'string') throw new Error('apply-template failed');
    const tokens = await routerRequest(l.server.port, 'POST', '/tokenize', { model: l.modelId, content: rendered.body.prompt, add_special: true });
    if (tokens.status !== 200 || !Array.isArray(tokens.body?.tokens)) throw new Error('tokenize failed');
    return tokens.body.tokens.length;
  }

  /**
   * `body` cut to fit the slot under the Context Overflow policy, or { stop } with the context-length error.
   * The prompt leaves room for the request's max_tokens. Without a known slot size the body is unchanged.
   */
  /** The context-length stop for a prompt of `tokens` against a slot of `nCtx`, in the panel's setting names. */
  function contextStop(body, tokens, nCtx) {
    // The answer's room, capped at half the slot so a large max_tokens never leaves the prompt nothing.
    const reserve = Math.min(Math.max(0, Number(body.max_tokens ?? body.max_completion_tokens) || 0), Math.floor(nCtx / 2));
    const budget = nCtx - reserve;
    const message = contextOverflow.overflowMessage({ tokens, budget, cut: overflowPolicy !== 'stopAtLimit', reserved: reserve > 0 });
    return { budget, stop: { error: { code: 400, type: 'exceed_context_size_error', message, n_prompt_tokens: tokens, n_ctx: nCtx } } };
  }

  async function fitContext(l, body, isGone) {
    if (!l.slotContext) return { body };
    const { budget } = contextStop(body, 0, l.slotContext);
    const fit = await contextOverflow.fitMessages(body.messages, {
      policy: overflowPolicy,
      budget,
      count: (messages) => {
        if (isGone()) throw new Error('The client hung up.');
        return promptTokens(l, { ...body, messages });
      },
    });
    if (!fit.overflow) return { body: fit.messages === body.messages ? body : { ...body, messages: fit.messages } };
    return { stop: contextStop(body, fit.overflow.tokens, l.slotContext).stop };
  }

  function forwardChat(req, res) {
    const l = launch;
    if (state.status !== 'ready' || !l?.server) return sendJson(res, 503, { error: { message: 'Model is not loaded.' } });
    readBody(req).then(async (text) => {
      let body;
      try { body = JSON.parse(text || '{}'); } catch { return sendJson(res, 400, { error: { message: 'The request body is not JSON.' } }); }
      const shaped = shapeChatBody(body, { modelId: l.modelId, keepImages: Boolean(l.projector) });
      if (shaped.droppedImages > 0) res.setHeader(IMAGES_DROPPED_HEADER, String(shaped.droppedImages));
      // A client that hangs up mid-count stops the counting too. The socket ends before it is destroyed.
      let hungUp = false;
      const onHangup = () => { if (!hungUp) onChatEvent('hangup'); hungUp = true; };
      req.socket.once('end', onHangup).once('close', onHangup);
      const gone = () => hungUp || req.socket.destroyed;
      let fitted;
      try {
        fitted = await fitContext(l, shaped.body, gone);
      } catch {
        // The count failed (the router stopped answering): forward the unfitted body; the server answers it.
        fitted = { body: shaped.body };
      } finally {
        req.socket.off('end', onHangup).off('close', onHangup);
      }
      if (gone() || res.destroyed || res.writableEnded) return onChatEvent('dropped');
      if (fitted.stop) { onChatEvent('stopped'); return sendJson(res, 400, fitted.stop); }
      const data = JSON.stringify(fitted.body);
      const up = http.request({
        host: '127.0.0.1', port: l.server.port, method: 'POST', path: '/v1/chat/completions',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (upRes) => {
        // The server's own context error (a prompt it counted longer, as with images) gets the same wording.
        if (upRes.statusCode === 400) {
          readBody(upRes).then((raw) => {
            let error = null;
            try { error = JSON.parse(raw)?.error ?? null; } catch { /* not JSON: pass it on */ }
            if (error?.type === 'exceed_context_size_error' && typeof error.n_prompt_tokens === 'number' && typeof error.n_ctx === 'number') {
              return sendJson(res, 400, contextStop(fitted.body, error.n_prompt_tokens, error.n_ctx).stop);
            }
            cors(res);
            res.writeHead(400, { 'Content-Type': upRes.headers['content-type'] ?? 'application/json' });
            res.end(raw);
          }, () => sendJson(res, 502, { error: { message: 'llama-server stopped answering.' } }));
          return;
        }
        cors(res);
        const headers = { 'Content-Type': upRes.headers['content-type'] ?? 'application/json' };
        if (upRes.headers['cache-control']) headers['Cache-Control'] = upRes.headers['cache-control'];
        res.writeHead(upRes.statusCode ?? 502, headers);
        upRes.pipe(res);
      });
      up.on('error', (e) => {
        if (res.destroyed || res.writableEnded) return;
        if (!res.headersSent) sendJson(res, 502, { error: { message: errorText(e) } });
        else res.end();
      });
      // A client that hangs up cancels the upstream request rather than letting it decode to the end.
      res.on('close', () => { if (!res.writableFinished) up.destroy(); });
      up.end(data);
      onChatEvent('forwarded');
    }, () => sendJson(res, 400, { error: { message: 'The request body could not be read.' } }));
  }

  function frontRouter(req, res) {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname.endsWith('/models')) {
      // Any */models path, LM Studio's /api/v0/models included: callers probe it and read `state`.
      return sendJson(res, 200, {
        object: 'list',
        data: [{ id: state.modelId, object: 'model', owned_by: 'formamorph', state: state.status === 'ready' ? 'loaded' : 'not-loaded' }],
      });
    }
    if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) return forwardChat(req, res);
    return sendJson(res, 404, { error: { message: `Unknown route ${req.method} ${url.pathname}` } });
  }

  /**
   * Load `modelPath` and start the local OpenAI server. Idempotent while loading/ready.
   * `contextSize` is the KV cache size (`-c`). `gpuLayers` is a layer count, or the AUTO/MAX sentinel.
   * `parallelRequests` is the server's slot count; `unifiedKvCache` (default on) makes the slots share one
   * `contextSize` pool, off gives each slot a full `contextSize`. `gpuDevice` is the device setting (`auto`, `all`, or a
   * device name), resolved against `--list-devices` on every start with `nvidiaGpus` (nvidia-smi rows) for
   * Auto's pick. A failed GPU load retries once on the CPU. `contextOverflow`, when given, sets the policy
   * as `setContextOverflow` does.
   */
  async function start({ modelPath, port = DEFAULT_PORT, contextSize, gpuLayers, flashAttention, parallelRequests, unifiedKvCache, kCacheType, vCacheType, kvCacheInRam, gpuDevice, nvidiaGpus, contextOverflow: policy } = {}) {
    if (policy !== undefined) setContextOverflow(policy);
    if (state.status === 'loading' || state.status === 'ready') return getState();
    if (!modelPath) { setState({ ...stoppedState(), status: 'error', port, error: 'No modelPath provided.' }); return getState(); }
    const modelId = path.basename(modelPath);
    const settings = {
      contextSize: typeof contextSize === 'number' ? contextSize : null,
      gpuLayers: typeof gpuLayers === 'number' ? gpuLayers : null,
      flashAttention: flashAttention !== false,
      parallelRequests: Math.max(1, typeof parallelRequests === 'number' ? parallelRequests : 1),
      unifiedKvCache: unifiedKvCache !== false,
      kCacheType: llamaServer.cacheType(kCacheType),
      vCacheType: llamaServer.effectiveVCacheType(vCacheType, flashAttention),
      kvCacheInRam: kvCacheInRam === true,
    };
    // The options this model is (being) loaded with, so the renderer can compare against pending settings.
    const applied = { ...settings, maxContextSize: null, engineVramMB: null };
    // This start: its settings, work folder, device, router (`server`), front server, and teardown state.
    // `projector` is the vision projector file, or null: without one, image parts are dropped.
    // `slotContext` is one slot's context in tokens once loaded, or null when the server didn't say.
    const l = { modelId, settings, projector: findProjector(modelPath), aborted: false, server: null, front: null, lost: null, slotContext: null };
    l.workDir = path.join(workRoot, `formamorph-engine-${process.pid}-${++starts}`);
    l.presetPath = path.join(l.workDir, 'preset.ini');
    // An empty cache, so the router lists no Hugging Face downloads beside our model.
    l.cacheDir = path.join(l.workDir, 'cache');
    launch = l;
    const isCurrent = () => launch === l && !l.aborted;
    // A stop overtook this start: answer once the stop has freed everything, so the caller reads `stopped`.
    const abandoned = async () => { await l.done; return getState(); };

    setState({ status: 'loading', modelPath, modelId, port, error: null, loadProgress: 0, ...NO_ENGINE, ...applied });
    l.bin = binaryPath({ platform });
    const devices = await llamaServer.listServerDevices({ bin: l.bin, spawn });
    if (!isCurrent()) return abandoned();
    const names = devices.map((d) => d.name);
    const pick = selectEngineDevice({ deviceNames: names, nvidiaGpus, setting: gpuDevice });
    l.device = pick.index != null ? devices[pick.index].id : null;
    const device = {
      gpuBackend: llamaServer.backendOf(devices),
      gpuDeviceNames: pick.index != null ? [names[pick.index]] : names,
      deviceVramTotalMB: null,
      deviceVramFreeMB: null,
      gpuDeviceIndex: pick.index,
      gpuDeviceRawIndex: null,
      gpuDeviceOrigin: pick.origin,
      gpuDeviceOptions: names.length ? names : null,
    };
    // Publish the device now rather than at 'ready', so a slow load shows what it's loading onto.
    setState({ ...getState(), ...device });

    const errorState = (error) => ({ status: 'error', modelPath, modelId: null, port, error, loadProgress: null, ...NO_ENGINE, ...device });
    const fail = async (error) => {
      await teardown(l);
      if (launch === l) launch = null;
      setState(errorState(error));
      return getState();
    };
    try {
      fs.mkdirSync(l.cacheDir, { recursive: true });
      fs.writeFileSync(l.presetPath, llamaServer.presetIni({ modelId, modelPath, projectorPath: l.projector }));
    } catch (e) {
      return fail(`Could not prepare the engine folder: ${errorText(e)}`);
    }

    let result = await attempt(l, { cpu: !devices.length });
    if (!result.ok && devices.length && isCurrent()) {
      const gpuError = result.error;
      await endServer(l.server);
      l.server = null;
      if (!isCurrent()) return abandoned();
      device.gpuBackend = 'cpu';
      setState({ ...getState(), loadProgress: 0, gpuBackend: 'cpu' });
      result = await attempt(l, { cpu: true });
      // The GPU attempt's error names the setting to lower; the CPU one only says RAM ran out too.
      if (!result.ok) result.error = gpuError;
    }
    if (!isCurrent()) return abandoned();
    if (!result.ok) return fail(result.error);

    // From here a router or model crash is a loss to report: held until 'ready', then reported once.
    l.server.onLost = (error) => {
      if (!isCurrent()) return;
      if (state.status !== 'ready') { l.lost ??= error; return; }
      fail(error).catch(() => {});
    };
    applied.maxContextSize = typeof result.info?.meta?.n_ctx_train === 'number' ? result.info.meta.n_ctx_train : null;
    // One slot's context as the server sized it (padding and slot split included), for Context Overflow.
    try {
      const props = await routerRequest(l.server.port, 'GET', `/props?model=${encodeURIComponent(modelId)}`);
      const nCtx = props.body?.default_generation_settings?.n_ctx;
      l.slotContext = typeof nCtx === 'number' && nCtx > 0 ? nCtx : null;
    } catch {
      l.slotContext = null;
    }
    if (!isCurrent()) return abandoned();
    const front = http.createServer((req, res) => {
      try { frontRouter(req, res); } catch (e) {
        if (!res.headersSent) sendJson(res, 500, { error: { message: errorText(e) } });
        else res.end();
      }
    });
    l.front = front;
    try {
      await new Promise((resolve, reject) => {
        front.once('error', reject);
        front.listen(port, '127.0.0.1', resolve);
      });
    } catch (e) {
      return fail(`Could not serve on port ${port}: ${errorText(e)}`);
    }
    if (!isCurrent()) return abandoned();
    if (l.lost) return fail(l.lost);
    // The share is the live model's; the device's VRAM at load also explains a later error, so it stays with `device`.
    const { engineVramMB, ...deviceVram } = l.server.memory.fields(devices);
    applied.engineVramMB = engineVramMB;
    Object.assign(device, deviceVram);
    setState({ status: 'ready', modelPath, modelId, port, error: null, loadProgress: null, serverPid: null, ...applied, ...device });
    // The instance holds the VRAM, so the viewer attributes it; one lookup per load, after 'ready' so it never delays it.
    const routerPid = l.server.child.pid;
    listProcesses().then((rows) => {
      const pid = llamaServer.instancePid(rows, routerPid);
      if (pid != null && isCurrent() && state.status === 'ready') setState({ ...getState(), serverPid: pid });
    }, () => { /* no pid leaves the viewer on the engine's own figure */ });
    return getState();
  }

  /** Tear everything down and return to `stopped`. Safe to call when already stopped. */
  async function stop() {
    const l = launch;
    launch = null;
    if (l) await teardown(l);
    setState(stoppedState());
    return getState();
  }

  /** Set the Context Overflow policy for the next chat request. Unknown values read as Truncate Middle. */
  function setContextOverflow(policy) {
    overflowPolicy = contextOverflow.overflowPolicy(policy);
    return overflowPolicy;
  }

  return { start, stop, getState, onStatus, listDevices, setContextOverflow };
}

module.exports = { ...createEngine(), createEngine, stoppedState, DEFAULT_PORT, IMAGES_DROPPED_HEADER };
