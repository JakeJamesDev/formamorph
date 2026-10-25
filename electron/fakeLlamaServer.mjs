// A fake `llama-server` for engine tests: an injected spawn that replays a real run recorded at the pinned tag
// (fixtures/llama-server/<tag>.json, from scripts/recordLlamaServerFixtures.mjs) and answers the router's HTTP
// routes on the port the engine gave it. Add a scenario by recording it, not by writing router output.
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIN = JSON.parse(readFileSync(path.join(HERE, '..', 'scripts', 'llamaServerPin.json'), 'utf8')).tag;

const readFixture = (name) => JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'llama-server', `${name}.json`), 'utf8'));

/** The recorded run for `tag` (default: the pinned one). */
export const loadFixture = (tag = PIN) => readFixture(tag);

/** One turn of a Qwen-style thinking model at `tag`, recorded with `--thinking`. */
export const loadThinkingFixture = (tag = PIN) => readFixture(`${tag}-thinking`);

/** One turn of a Gemma 4 model with thinking on at `tag`, recorded with `--gemma`. */
export const loadGemmaFixture = (tag = PIN) => readFixture(`${tag}-gemma`);

const argValue = (args, flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

/** The fake template's rendering: the recorded Qwen ChatML shape, so turn markers cost tokens as they do live. */
export const renderChatMl = (messages) => messages.map((m) => `<|im_start|>${m.role}\n${typeof m.content === 'string' ? m.content : ''}<|im_end|>\n`).join('') + '<|im_start|>assistant\n';

/** The fake tokenizer: one token per special marker or whitespace-separated word. */
export const countFakeTokens = (text) => (text.match(/<\|[a-z_]+\|>|[^\s<]+|</g) ?? []).length;

/** True for the CPU fallback's router start. */
export const isCpuStart = (args) => argValue(args, '--device') === 'none';

/**
 * `scenarioFor(args)` names the recorded scenario a router start replays: `loaded`, `kvFail` or `cpu`.
 * `listDevices` overrides the recorded `--list-devices` text. `stepMs` paces the replayed events.
 * `holdReply` keeps each chat reply open (a stream after its first frame); `chatHangups` gets each one the
 * caller ends. `holdTokenize` keeps every `/tokenize` answer back, listed in `heldTokenize`, until
 * `releaseTokenize()`. `chatExtraTokens` adds to a chat prompt's count.
 */
export function createFakeLlamaServer({ fixture = loadFixture(), scenarioFor = (args) => (isCpuStart(args) ? 'cpu' : 'loaded'), listDevices = fixture.listDevices, stepMs = 2, holdReply = false, holdTokenize = false, chatExtraTokens = 0 } = {}) {
  const calls = [];
  const chatRequests = [];
  const chatHangups = [];
  const heldTokenize = [];
  let releaseTokenize = () => {};
  const tokenizeGate = holdTokenize ? new Promise((r) => { releaseTokenize = r; }) : null;
  const templateRequests = [];
  const routers = [];
  let nextPid = 40000;

  function spawn(command, commandArgs, opts = {}) {
    // A POSIX start wraps the server in its supervising shell: `sh -c <script> <bin> <args…>`.
    const wrapped = command === '/bin/sh' && commandArgs[0] === '-c';
    const bin = wrapped ? commandArgs[2] : command;
    const args = wrapped ? commandArgs.slice(3) : commandArgs;
    calls.push({ bin, args: [...args], env: opts.env ?? null, wrapped });
    const child = new EventEmitter();
    child.pid = nextPid++;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.alive = true;
    const exit = (code, signal = null) => {
      if (!child.alive) return;
      child.alive = false;
      child.stdout.end();
      child.stderr.end();
      child.emit('exit', code, signal);
      child.emit('close', code, signal);
    };

    if (args.includes('--list-devices')) {
      child.kill = () => exit(null, 'SIGTERM');
      setImmediate(() => { child.stdout.write(listDevices); exit(0); });
      return child;
    }

    const scenario = fixture.scenarios[scenarioFor(args)];
    const port = Number(argValue(args, '--port'));
    const ini = readFileSync(argValue(args, '--models-preset'), 'utf8');
    const modelId = /^\[(.+)\]$/m.exec(ini)[1];
    const fill = (v) => JSON.parse(JSON.stringify(v).split('<modelId>').join(modelId));
    const line = (l) => { if (child.alive) child.stdout.write(`${l.split('<modelId>').join(modelId)}\n`); };
    const sseClients = new Set();
    const send = (event) => { for (const res of sseClients) res.write(`data: ${JSON.stringify(fill(event))}\n\n`); };
    const timers = new Set();
    const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
    // Under its POSIX shell the router is a pid of its own; the instance gets one per load.
    const router = { child, args, modelId, loaded: false, wrapped, pid: wrapped ? nextPid++ : child.pid, instancePid: null };
    // One slot's context as the server sizes it from -c, --kv-unified and -np; null without -c.
    const c = Number(argValue(args, '-c'));
    const slotContext = c > 0 ? (args.includes('--kv-unified') ? c : c / (Number(argValue(args, '-np')) || 1)) : null;
    routers.push(router);

    const replay = (events, lines) => {
      // The instance's log lines land before its last event, as in the recording.
      events.forEach((e, i) => later(stepMs * (i + 1), () => {
        if (i === events.length - 1) lines.forEach(line);
        if (e.data?.status === 'loaded') router.loaded = true;
        send(e);
      }));
    };

    const body = (req) => new Promise((resolve) => { let t = ''; req.on('data', (c) => { t += c; }); req.on('end', () => resolve(t ? JSON.parse(t) : {})); });
    const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/models') return json(res, 200, fill(scenario.models));
      if (req.method === 'GET' && url.pathname === '/models/sse') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.flushHeaders();
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/models/load') {
        await body(req);
        json(res, 200, fill(scenario.loadReply));
        router.instancePid = nextPid++;
        return replay(scenario.loadEvents, scenario.load);
      }
      if (req.method === 'POST' && url.pathname === '/models/unload') {
        await body(req);
        json(res, 200, { success: true });
        router.loaded = false;
        const unloaded = fixture.scenarios.loaded.afterEvents.find((e) => e.data?.status === 'unloaded');
        return later(stepMs, () => send(unloaded));
      }
      // The token routes the proxy's Context Overflow reads, in the shapes the pinned build answers with.
      if (req.method === 'GET' && url.pathname === '/props' && url.searchParams.get('model') === modelId) {
        return json(res, 200, { default_generation_settings: { n_ctx: slotContext } });
      }
      if (req.method === 'POST' && url.pathname === '/apply-template') {
        const payload = await body(req);
        templateRequests.push(payload);
        return json(res, 200, { prompt: renderChatMl(payload.messages) });
      }
      if (req.method === 'POST' && url.pathname === '/tokenize') {
        const payload = await body(req);
        if (tokenizeGate) { heldTokenize.push(payload); await tokenizeGate; }
        return json(res, 200, { tokens: Array.from({ length: countFakeTokens(payload.content) }, (_, i) => i) });
      }
      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        const payload = await body(req);
        chatRequests.push(payload);
        // The server's own count, plus what the template text leaves out (image embeddings), in its recorded error.
        const tokens = countFakeTokens(renderChatMl(payload.messages ?? [])) + chatExtraTokens;
        if (slotContext && tokens > slotContext) {
          return json(res, 400, { error: { code: 400, message: `request (${tokens} tokens) exceeds the available context size (${slotContext} tokens), try increasing it`, type: 'exceed_context_size_error', n_prompt_tokens: tokens, n_ctx: slotContext } });
        }
        // A reply still decoding: a stream's first frame, or nothing yet, until the caller hangs up.
        if (holdReply) req.socket.once('close', () => chatHangups.push(payload));
        if (payload.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          const frames = fill(scenario.chatStream ?? fixture.scenarios.loaded.chatStream);
          return holdReply ? res.write(`${frames.split('\n\n')[0]}\n\n`) : res.end(frames);
        }
        if (holdReply) return;
        return json(res, 200, fill(scenario.chat ?? fixture.scenarios.loaded.chat));
      }
      return json(res, 404, { error: { message: 'not found' } });
    });

    const shutdown = () => {
      for (const t of timers) clearTimeout(t);
      for (const res of sseClients) res.destroy();
      server.closeAllConnections?.();
      server.close();
      // The router's end ends its instance too, which a loaded router counts as gone.
      router.loaded = false;
    };
    child.kill = () => { shutdown(); exit(null, 'SIGTERM'); return true; };
    /** Exit unasked, as a crash would. */
    child.crash = (code = 3) => { shutdown(); exit(code); };
    /** The model instance dies while the router stays up: the router reports it as the recorded failed exit. */
    router.crashInstance = () => {
      router.loaded = false;
      send(fixture.scenarios.kvFail.loadEvents.at(-1));
    };
    server.listen(port, '127.0.0.1', () => scenario.boot.forEach(line));
    return child;
  }

  return {
    spawn,
    calls,
    chatRequests,
    chatHangups,
    heldTokenize,
    /** Answers every held `/tokenize`, and every later one at once. */
    releaseTokenize: () => releaseTokenize(),
    templateRequests,
    routers,
    /** Router starts so far, newest last (list-devices runs excluded). */
    routerCalls: () => calls.filter((c) => !c.args.includes('--list-devices')),
    /** Processes still running: routers plus a loaded model instance each. */
    liveProcesses: () => routers.reduce((n, r) => n + (r.child.alive ? 1 : 0) + (r.loaded ? 1 : 0), 0),
    /** The OS process table as the engine's listProcesses answers it: each live router's tree, among others. */
    listProcesses: async () => {
      const exe = (posix) => (posix ? '/opt/formamorph/llama-server' : 'llama-server.exe');
      const rows = [{ pid: 4, ppid: 0, name: 'System' }, { pid: process.pid, ppid: 1, name: 'Formamorph Engine' }];
      for (const r of routers.filter((x) => x.child.alive)) {
        if (r.wrapped) rows.push({ pid: r.child.pid, ppid: process.pid, name: 'sh' });
        rows.push({ pid: r.pid, ppid: r.wrapped ? r.child.pid : process.pid, name: exe(r.wrapped) });
        if (r.loaded) rows.push({ pid: r.instancePid, ppid: r.pid, name: exe(r.wrapped) });
      }
      return rows;
    },
  };
}
