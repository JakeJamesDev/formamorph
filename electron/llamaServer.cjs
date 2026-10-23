// What the engine knows about llama.cpp's `llama-server`: where the bundled build lives, the arguments each
// setting becomes, and how to read what the server prints and streams. Pure functions, so the settings
// mapping and the parsers are tested against recorded output without a process.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

// Mirror of GPU_LAYERS_AUTO/MAX in the renderer's settingsDefaults.
const GPU_LAYERS_AUTO = -1;
const GPU_LAYERS_MAX = -2;

/** A localhost port free right now, for llama-server to bind. */
const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

/** An error's message, or the thrown value as text. */
const errorText = (e) => String((e && e.message) || e);

// POSIX has no kill-on-close job, so a shell holds the server: it ends it on TERM, or when the engine's end of
// its stdin closes, which happens however the engine dies. Exits with the server's code.
const POSIX_SUPERVISOR = [
  'exec 3<&0 0</dev/null',
  '"$0" "$@" & p=$!',
  "trap 'kill $p 2>/dev/null' TERM",
  '(read _ <&3; kill $p 2>/dev/null) & w=$!',
  'wait $p; s=$?',
  'kill $w 2>/dev/null',
  'exit $s',
].join('; ');

/** How to spawn the server so it dies with the engine. Windows needs nothing: libuv's job object does it. */
function spawnCommand(bin, args, platform = process.platform) {
  if (platform === 'win32') return { command: bin, args, stdin: 'ignore' };
  return { command: '/bin/sh', args: ['-c', POSIX_SUPERVISOR, bin, ...args], stdin: 'pipe' };
}

/** The bundled build folder for this platform; `cpu` picks the CPU-only build where one ships apart. */
function buildId({ platform = process.platform, arch = process.arch, cpu = false } = {}) {
  if (platform === 'win32') return 'win-x64-vulkan';
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  return cpu ? 'linux-x64-cpu' : 'linux-x64-vulkan';
}

/** Windows and macOS builds carry their CPU backend; Linux ships the CPU build as its own folder. */
const cpuNeedsOwnBuild = (platform = process.platform) => platform === 'linux';

/**
 * Absolute path to the bundled `llama-server`. Packaged builds ship it in resources/llama-server (outside the
 * asar); a dev run reads the fetch script's build-assets/llama-server.
 */
function binaryPath({ platform = process.platform, arch = process.arch, cpu = false, roots } = {}) {
  const exe = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const id = buildId({ platform, arch, cpu });
  const candidates = roots ?? [
    path.join(__dirname, '..', '..', 'llama-server'),
    path.join(__dirname, '..', 'build-assets', 'llama-server'),
  ];
  for (const root of candidates) {
    const file = path.join(root, id, exe);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** The one-section models preset that names the model to serve, and its vision projector when it has one. */
function presetIni({ modelId, modelPath, projectorPath = null }) {
  // INI values are read to end of line, so a path needs no quoting; forward slashes avoid escape handling.
  const slashes = (p) => p.replace(/\\/g, '/');
  const mmproj = projectorPath ? `mmproj = ${slashes(projectorPath)}\n` : '';
  return `version = 1\n\n[${modelId}]\nmodel = ${slashes(modelPath)}\n${mmproj}`;
}

const { cacheType, effectiveVCacheType } = require('./cacheTypes.cjs');

/**
 * Router-mode arguments for one start. `device` is a `--list-devices` id (`Vulkan1`) or null for every
 * device; `cpu` is the fallback after a failed GPU load.
 */
function serverArgs({ presetPath, port, contextSize, gpuLayers, flashAttention, parallelRequests, unifiedKvCache = true, kCacheType, vCacheType, kvCacheInRam = false, device = null, cpu = false }) {
  const slots = Math.max(1, typeof parallelRequests === 'number' ? parallelRequests : 1);
  const args = [
    '--models-preset', presetPath,
    '--offline',
    '--no-models-autoload',
    '--models-max', '1',
    '--host', '127.0.0.1',
    '--port', String(port),
    '--log-jsonl',
    // Each template's thoughts go to `reasoning_content`, never into `content`.
    '--reasoning-format', 'deepseek',
    // Verbosity 4 is the lowest that prints the device and buffer-size lines the VRAM viewer reads.
    '-lv', '4',
  ];
  // -c is the whole KV pool, split across slots. Unified: one pool the slots share. Not unified: a pool of
  // Context Size × slots, so each slot holds a full Context Size.
  const unified = unifiedKvCache !== false;
  if (typeof contextSize === 'number' && contextSize > 0) args.push('-c', String(unified ? contextSize : contextSize * slots));
  if (cpu) args.push('--device', 'none', '-ngl', '0', '--fit', 'off');
  else {
    // Auto lets llama.cpp fit layers around the context; Max and Custom are the user's split, so fit stays out.
    if (gpuLayers === GPU_LAYERS_MAX) args.push('-ngl', 'all', '--fit', 'off');
    else if (typeof gpuLayers === 'number' && gpuLayers >= 0) args.push('-ngl', String(gpuLayers), '--fit', 'off');
    else args.push('-ngl', 'auto', '--fit', 'on');
    if (device) args.push('--device', device);
  }
  args.push('-fa', flashAttention === false ? 'off' : 'on');
  // Always passed: the server's auto default is four slots.
  args.push('-np', String(slots));
  if (unified) args.push('--kv-unified');
  args.push('-ctk', cacheType(kCacheType), '-ctv', effectiveVCacheType(vCacheType, flashAttention));
  if (kvCacheInRam === true) args.push('-nkvo');
  return args;
}

/** `--list-devices` output → [{ id, name, totalMB, freeMB }] in the server's own order. */
function parseListDevices(text) {
  const devices = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s+([A-Za-z]+\d+):\s+(.+?)\s+\((\d+) MiB, (\d+) MiB free\)\s*$/.exec(line);
    if (m) devices.push({ id: m[1], name: m[2], totalMB: Number(m[3]), freeMB: Number(m[4]) });
  }
  return devices;
}

/** Runs `<bin> --list-devices` and parses it. Answers [] when the binary is missing, fails or hangs. */
function listServerDevices({ bin, spawn = require('node:child_process').spawn, timeoutMs = 20000 } = {}) {
  if (!bin) return Promise.resolve([]);
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn(bin, ['--list-devices'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch { return resolve([]); }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } }, timeoutMs);
    child.stdout?.on('data', (c) => { out += c; });
    child.stderr?.on('data', (c) => { out += c; });
    child.once('error', () => { clearTimeout(timer); resolve([]); });
    child.once('close', () => { clearTimeout(timer); resolve(parseListDevices(out)); });
  });
}

/** The backend name a device id carries (`Vulkan0` → `vulkan`), or `cpu` with no device. */
function backendOf(devices) {
  const id = devices?.[0]?.id;
  return id ? id.replace(/\d+$/, '').toLowerCase() : 'cpu';
}

/** The device picker's view of a device list. */
const deviceListing = (devices) => ({ gpuBackend: backendOf(devices), gpuDeviceNames: devices.map((d) => d.name) });

// The router's load-progress event. Its README calls it `model_status`; the pinned build emits this.
const STATUS_EVENT = 'status_change';

/** Splits an SSE byte stream into the JSON payloads of its `data:` lines. Returns { feed(chunk) → events[] }. */
function sseReader() {
  let buffer = '';
  return {
    feed(chunk) {
      buffer += chunk;
      const events = [];
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data) continue;
        try { events.push(JSON.parse(data)); } catch { /* a malformed frame carries nothing to act on */ }
      }
      return events;
    },
  };
}

/** Whole-percent load progress across every stage the event lists, or null when it carries none. */
function loadPercent(progress) {
  if (!progress || !Array.isArray(progress.stages) || !progress.stages.length) return null;
  const at = Math.max(0, progress.stages.indexOf(progress.current));
  const value = Math.max(0, Math.min(1, Number(progress.value) || 0));
  return Math.round(((at + value) / progress.stages.length) * 100);
}

/**
 * One router stdout line → { port, text, level, data } where `port` is the instance that printed it (null for
 * the router itself), `text` its log message and `data` a structured record such as fit_memory_breakdown.
 */
function parseLogLine(line) {
  let outer;
  try { outer = JSON.parse(line); } catch { return { port: null, text: String(line), level: null, data: null }; }
  const msg = typeof outer?.msg === 'string' ? outer.msg : '';
  const child = /^\[(\d+)\] (.*?)\s*$/s.exec(msg);
  if (!child) return { port: null, text: msg.trim(), level: outer?.level ?? null, data: outer?.data ?? null };
  let inner;
  try { inner = JSON.parse(child[2]); } catch { return { port: Number(child[1]), text: child[2], level: null, data: null }; }
  return {
    port: Number(child[1]),
    text: typeof inner?.msg === 'string' ? inner.msg.trim() : '',
    level: inner?.level ?? null,
    data: inner?.type && inner.type !== 'log' ? { type: inner.type, ...inner.data } : null,
  };
}

// `llama_prepare_model_devices: using device Vulkan0 (NVIDIA GeForce RTX 4090) (0000:01:00.0) - 21970 MiB free`
const USING_DEVICE = /\busing device (\S+) .* - (\d+) MiB free\s*$/;
// `load_tensors:      Vulkan0 model buffer size =  2430.74 MiB`; RS is a hybrid model's recurrent state, its KV.
const BUFFER_SIZE = /:\s+(\S+)\s+(?:model|KV|RS|compute|output) buffer size =\s*([\d.]+) MiB/;
// CPU, CPU_Mapped, CPU_REPACK and Vulkan_Host buffers live in system RAM.
const isHostBuffer = (name) => /^CPU|_Host$/.test(name);

/**
 * Folds an instance's load log into running sums. `fields(devices)` gives the status's VRAM fields, summed over
 * the devices the instance logged, with totals from `devices` (the start's `--list-devices`).
 */
function memoryTally() {
  const freeMB = new Map();
  let vramMB = 0;
  let buffers = 0;
  return {
    feed(text) {
      const device = USING_DEVICE.exec(text);
      if (device) { freeMB.set(device[1], Number(device[2])); return; }
      const buffer = BUFFER_SIZE.exec(text);
      if (buffer && !isHostBuffer(buffer[1])) { vramMB += Number(buffer[2]); buffers++; }
    },
    fields(devices) {
      const used = devices.filter((d) => freeMB.has(d.id));
      const sum = (values) => (values.length ? values.reduce((a, b) => a + b, 0) : null);
      return {
        engineVramMB: buffers ? Math.round(vramMB) : null,
        deviceVramFreeMB: sum([...freeMB.values()]),
        deviceVramTotalMB: sum(used.map((d) => d.totalMB)),
      };
    },
  };
}

/** `name` without its folder and `.exe`, so Windows' `llama-server.exe` and macOS' full path both read `llama-server`. */
const programOf = (name) => path.basename(String(name)).replace(/\.exe$/i, '');

/**
 * The model instance's pid among `rows` ({ pid, ppid, name }): the llama-server under `rootPid` whose parent is
 * a llama-server too, since the router spawns it. `rootPid` is the router, or on POSIX its supervising shell.
 */
function instancePid(rows, rootPid) {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  // The instance sits two levels under the root at most; the hop cap only stops a pid cycle in a stale table.
  const under = (r) => {
    for (let p = r, hops = 0; p && hops < 8; p = byPid.get(p.ppid), hops++) if (p.ppid === rootPid) return true;
    return false;
  };
  const found = rows.find((r) => programOf(r.name) === 'llama-server' && programOf(byPid.get(r.ppid)?.name ?? '') === 'llama-server' && under(r));
  return found?.pid ?? null;
}

/** `<pid> <ppid> <name>` lines → rows; a name may hold spaces. */
function parseProcessRows(text) {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]), name: m[3] });
  }
  return rows;
}

/** Every process as { pid, ppid, name }. Answers [] when the listing fails or hangs. */
function listProcesses({ platform = process.platform, spawn = require('node:child_process').spawn, timeoutMs = 15000 } = {}) {
  const [command, args] = platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.Name }"]]
    : ['ps', ['-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'comm=']];
  return new Promise((resolve) => {
    let out = '';
    let child;
    try { child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch { return resolve([]); }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* already gone */ } }, timeoutMs);
    child.stdout?.on('data', (c) => { out += c; });
    child.stderr?.on('data', () => { /* drained, never read */ });
    child.once('error', () => { clearTimeout(timer); resolve([]); });
    child.once('close', () => { clearTimeout(timer); resolve(parseProcessRows(out)); });
  });
}

/**
 * Restates a failed load in the Local Model settings' names, from the instance's log lines. Null when the
 * log names no cause this knows, so the caller can fall back to the exit code.
 */
function describeLoadError(lines, { contextSize, parallelRequests, unifiedKvCache = true, gpuLayers, cpu = false } = {}) {
  const text = lines.join('\n');
  const memory = cpu ? "this computer's RAM" : "this GPU's VRAM";
  if (/failed to allocate buffer for kv cache|failed to initialize the context|failed to create context/i.test(text)) {
    // A shared pool costs the same at any slot count, so Parallel Requests only matters when it is off.
    const n = unifiedKvCache === false ? Math.max(1, parallelRequests ?? 1) : 1;
    const size = typeof contextSize === 'number' && contextSize > 0 ? `Context Size ${contextSize}` : 'The context';
    const parallel = n > 1 ? ` with ${n} Parallel Requests` : '';
    return `${size}${parallel} doesn't fit in ${memory}. Lower Context Size${n > 1 ? ' or Parallel Requests' : ''}.`;
  }
  if (/failed to load model|unable to allocate .* buffer|failed to allocate .* buffer/i.test(text)) {
    const lower = gpuLayers === GPU_LAYERS_AUTO || gpuLayers == null || cpu ? 'Lower Context Size' : 'Lower GPU Layers or set it to Auto';
    return `The model doesn't fit in ${memory}. ${lower}.`;
  }
  const last = lines.filter((l) => /error|failed/i.test(l)).pop();
  return last ?? null;
}

module.exports = {
  GPU_LAYERS_AUTO, GPU_LAYERS_MAX, STATUS_EVENT,
  freePort, errorText, spawnCommand,
  buildId, cpuNeedsOwnBuild, binaryPath, presetIni, serverArgs, cacheType, effectiveVCacheType,
  parseListDevices, listServerDevices, backendOf, deviceListing, sseReader, loadPercent, parseLogLine, describeLoadError,
  memoryTally, instancePid, parseProcessRows, listProcesses,
};
