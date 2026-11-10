import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import llamaServer from './llamaServer.cjs';
import { loadFixture } from './fakeLlamaServer.mjs';

const { parseListDevices, backendOf, loadPercent, parseLogLine, sseReader, describeLoadError, buildId, binaryPath, spawnCommand, GPU_LAYERS_MAX, memoryTally, instancePid, parseProcessRows } = llamaServer;
const fixture = loadFixture();

/** A recorded scenario's instance log texts, fed through a fresh tally, as status fields over `devices`. */
const fieldsOf = (texts, devices = parseListDevices(fixture.listDevices)) => {
  const t = memoryTally();
  for (const text of texts) t.feed(text);
  return t.fields(devices);
};
const instanceTexts = (scenario) => fixture.scenarios[scenario].load.map(parseLogLine).filter((e) => e.port != null).map((e) => e.text);

describe('memoryTally', () => {
  it('sums the recorded non-host buffers and reads the device’s free VRAM at load', () => {
    expect(fieldsOf(instanceTexts('loaded'))).toEqual({ engineVramMB: 3025, deviceVramFreeMB: 23365, deviceVramTotalMB: 24138 });
  });

  it('counts nothing on a CPU load, whose buffers are all host', () => {
    expect(fieldsOf(instanceTexts('cpu'))).toEqual({ engineVramMB: null, deviceVramFreeMB: null, deviceVramTotalMB: null });
  });

  it('counts a hybrid model’s recurrent state with its KV', () => {
    // Lines from a b11829 load of a Qwen3.6 35B-A3B (hybrid attention) on this PC.
    const texts = [
      'llama_prepare_model_devices: using device Vulkan0 (NVIDIA GeForce RTX 4090) (0000:01:00.0) - 23365 MiB free',
      'load_tensors:      Vulkan0 model buffer size = 20117.18 MiB',
      'llama_kv_cache:    Vulkan0 KV buffer size =    80.00 MiB',
      'llama_memory_recurrent:    Vulkan0 RS buffer size =    62.81 MiB',
      'sched_reserve:    Vulkan0 compute buffer size =    80.02 MiB',
    ];
    expect(fieldsOf(texts).engineVramMB).toBe(20340);
  });

  it('leaves out the recorded output buffers, which are host buffers', () => {
    const texts = instanceTexts('loaded');
    const outputs = texts.filter((t) => /output buffer size/.test(t));
    expect(outputs.length).toBeGreaterThan(0);
    expect(outputs.every((t) => /\b(?:CPU|\w+_Host)\b/.test(t))).toBe(true);
    expect(fieldsOf(texts).engineVramMB).toBe(fieldsOf(texts.filter((t) => !outputs.includes(t))).engineVramMB);
  });

  it('counts a non-host output buffer with the model, KV and compute buffers', () => {
    // Synthetic: no recording has an on-device output buffer. Format is llama.cpp's `%10s output buffer size = %8.2f MiB`.
    const output = `llama_context: ${'Vulkan0'.padStart(10)} output buffer size = ${(0.98).toFixed(2).padStart(8)} MiB`;
    const texts = instanceTexts('loaded');
    expect(fieldsOf(texts).engineVramMB).toBe(3025);
    expect(fieldsOf([...texts, output]).engineVramMB).toBe(3026);
  });

  it('sums across devices when the load spans two', () => {
    // The recorded single-GPU lines, each device and buffer line repeated for a second card.
    const texts = instanceTexts('max').flatMap((t) => (/Vulkan0/.test(t) ? [t, t.replace('Vulkan0', 'Vulkan1').replace(/- \d+ MiB free/, '- 1000 MiB free')] : [t]));
    const devices = parseListDevices('Available devices:\n  Vulkan0: NVIDIA GeForce RTX 4090 (24138 MiB, 23370 MiB free)\n  Vulkan1: NVIDIA GeForce RTX 3060 (12288 MiB, 1100 MiB free)\n');
    expect(fieldsOf(texts, devices)).toEqual({ engineVramMB: 6050, deviceVramFreeMB: 24370, deviceVramTotalMB: 36426 });
  });
});

describe('instancePid', () => {
  // Windows rows from the CIM query: the router under the engine host, the instance under the router.
  const win = parseProcessRows('4 0 System\r\n900 1 Formamorph Engine\r\n53724 900 llama-server.exe\r\n8852 53724 llama-server.exe\r\n7777 1 llama-server.exe\r\n7778 7777 llama-server.exe\r\n');

  it('picks the router’s child, not the router or another app’s server', () => {
    expect(instancePid(win, 53724)).toBe(8852);
  });

  it('walks through the POSIX supervising shell', () => {
    const posix = parseProcessRows('  900     1 node\n  901   900 sh\n  902   901 /opt/app/llama-server\n  903   902 /opt/app/llama-server\n  904   901 sh\n');
    expect(instancePid(posix, 901)).toBe(903);
  });

  it('answers null before the instance exists', () => {
    expect(instancePid(win.filter((r) => r.pid !== 8852), 53724)).toBeNull();
  });

  it('lists this OS’s real process table, this process under its parent', async () => {
    const rows = await llamaServer.listProcesses();
    expect(rows.find((r) => r.pid === process.pid)?.ppid).toBe(process.ppid);
  });

  it('keeps a name with spaces whole', () => {
    expect(parseProcessRows('12 3 Formamorph Engine Helper.exe')).toEqual([{ pid: 12, ppid: 3, name: 'Formamorph Engine Helper.exe' }]);
  });
});

describe('listProcesses failure causes', () => {
  /** A spawn double: `script(child)` drives the child the listing sees. */
  const spawning = (script) => () => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(() => child.emit('close', null)) });
    queueMicrotask(() => script(child));
    return child;
  };

  it('answers the rows of a clean exit', async () => {
    const spawn = spawning((c) => { c.stdout.emit('data', '5 1 node\n'); c.emit('close', 0); });
    await expect(llamaServer.listProcesses({ spawn })).resolves.toEqual([{ pid: 5, ppid: 1, name: 'node' }]);
  });

  it('rejects when the listing command cannot start', async () => {
    const spawn = () => { throw new Error('EAGAIN'); };
    await expect(llamaServer.listProcesses({ spawn, platform: 'linux' })).rejects.toThrow('Could not start ps: EAGAIN');
  });

  it('rejects on a spawn error event', async () => {
    const spawn = spawning((c) => c.emit('error', new Error('ENOENT')));
    await expect(llamaServer.listProcesses({ spawn, platform: 'linux' })).rejects.toThrow('Could not run ps: ENOENT');
  });

  it('rejects with the timeout, not the partial rows, when the listing hangs', async () => {
    const spawn = spawning((c) => c.stdout.emit('data', '5 1 node\n'));
    await expect(llamaServer.listProcesses({ spawn, platform: 'win32', timeoutMs: 20 })).rejects.toThrow('powershell.exe did not answer within 20 ms');
  });

  it('rejects on a non-zero exit with the stderr tail', async () => {
    const spawn = spawning((c) => { c.stdout.emit('data', '5 1 node\n'); c.stderr.emit('data', 'Get-CimInstance : Access denied\n'); c.emit('close', 1); });
    await expect(llamaServer.listProcesses({ spawn, platform: 'win32' })).rejects.toThrow('powershell.exe exited with code 1: Get-CimInstance : Access denied');
  });

  it('names the exit code alone when stderr is empty', async () => {
    const spawn = spawning((c) => c.emit('close', 2));
    await expect(llamaServer.listProcesses({ spawn, platform: 'linux' })).rejects.toThrow(/^ps exited with code 2$/);
  });
});

describe('parseListDevices', () => {
  it('reads the recorded --list-devices output', () => {
    expect(parseListDevices(fixture.listDevices)).toEqual([{ id: 'Vulkan0', name: 'NVIDIA GeForce RTX 4090', totalMB: 24138, freeMB: 23370 }]);
  });

  it('keeps several devices in the server’s order and names the backend', () => {
    const devices = parseListDevices('Available devices:\n  Vulkan0: Intel(R) UHD Graphics 770 (16252 MiB, 15000 MiB free)\n  Vulkan1: NVIDIA GeForce RTX 4080 (16376 MiB, 15500 MiB free)\n');
    expect(devices.map((d) => d.id)).toEqual(['Vulkan0', 'Vulkan1']);
    expect(backendOf(devices)).toBe('vulkan');
    expect(backendOf([])).toBe('cpu');
  });
});

describe('readServerDevices', () => {
  /** A spawn whose child prints `out`, then exits with `code`; `hang` never exits until killed. */
  const fakeSpawn = ({ out = '', code = 0, hang = false, error = null } = {}) => () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { setImmediate(() => child.emit('close', null)); };
    setImmediate(() => {
      if (error) { child.emit('error', error); return; }
      child.stdout.emit('data', out);
      if (!hang) child.emit('close', code);
    });
    return child;
  };
  const read = (spawnOptions, extra = {}) =>
    llamaServer.readServerDevices({ bin: 'llama-server', spawn: fakeSpawn(spawnOptions), ...extra });

  it('answers a clean listing with no device as listed and empty', async () => {
    expect(await read({ out: 'Available devices:\n' })).toEqual({ ok: true, devices: [] });
  });

  it('answers a clean listing with its devices', async () => {
    const answer = await read({ out: fixture.listDevices });
    expect(answer.ok).toBe(true);
    expect(answer.devices.map((d) => d.name)).toEqual(['NVIDIA GeForce RTX 4090']);
  });

  it.each([
    ['a non-zero exit', { code: 1 }, {}],
    ['a spawn error', { error: new Error('ENOENT') }, {}],
    ['a hang past the timeout', { hang: true }, { timeoutMs: 5 }],
  ])('answers %s as a failed listing', async (_, spawnOptions, extra) => {
    expect(await read(spawnOptions, extra)).toEqual({ ok: false, devices: [] });
  });

  it('answers a missing binary as a failed listing', async () => {
    expect(await llamaServer.readServerDevices({ bin: null })).toEqual({ ok: false, devices: [] });
  });

  it('keeps listServerDevices a plain device list', async () => {
    expect(await llamaServer.listServerDevices({ bin: 'llama-server', spawn: fakeSpawn({ code: 1 }) })).toEqual([]);
  });
});

describe('loadPercent', () => {
  it('spreads progress across every listed stage', () => {
    const stages = ['text_model', 'mmproj_model'];
    expect(loadPercent({ stages, current: 'text_model', value: 0.5 })).toBe(25);
    expect(loadPercent({ stages, current: 'mmproj_model', value: 0.5 })).toBe(75);
    expect(loadPercent({ stages, current: 'mmproj_model', value: 1 })).toBe(100);
  });

  it('reads the recorded events as whole percents ending at 100', () => {
    const pcts = fixture.scenarios.loaded.loadEvents.filter((e) => e.data?.progress).map((e) => loadPercent(e.data.progress));
    expect(pcts.at(-1)).toBe(100);
    expect(pcts.every(Number.isInteger)).toBe(true);
  });

  it('answers null for an event without progress', () => {
    expect(loadPercent(undefined)).toBeNull();
  });
});

describe('parseLogLine', () => {
  it('tells the router’s lines from its instance’s, and unwraps the instance’s JSON', () => {
    const lines = fixture.scenarios.loaded.load.map(parseLogLine);
    expect(lines.some((l) => l.port == null && l.text.startsWith('srv          load: spawning server instance'))).toBe(true);
    const instance = lines.filter((l) => l.port != null);
    expect(instance.length).toBeGreaterThan(0);
    expect(instance.some((l) => l.text === 'srv  server_run_i: model loaded')).toBe(true);
    expect(instance.some((l) => l.data?.type === 'fit_memory_breakdown')).toBe(true);
  });
});

describe('sseReader', () => {
  it('joins an event split across chunks and skips comments', () => {
    const r = sseReader();
    expect(r.feed('data: {"a":')).toEqual([]);
    expect(r.feed('1}\n\n: ping\n\ndata: {"b":2}\n\n')).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('describeLoadError', () => {
  const kvLines = fixture.scenarios.kvFail.load.map(parseLogLine).filter((l) => l.port != null).map((l) => l.text);

  it('restates the recorded KV cache failure in setting names', () => {
    expect(describeLoadError(kvLines, { contextSize: 8192, parallelRequests: 2, unifiedKvCache: false }))
      .toBe("Context Size 8192 with 2 Parallel Requests doesn't fit in this GPU's VRAM. Lower Context Size or Parallel Requests.");
  });

  it('leaves Parallel Requests out while the slots share one cache', () => {
    expect(describeLoadError(kvLines, { contextSize: 8192, parallelRequests: 2, unifiedKvCache: true }))
      .toBe("Context Size 8192 doesn't fit in this GPU's VRAM. Lower Context Size.");
  });

  it('leaves Parallel Requests out with one slot', () => {
    expect(describeLoadError(kvLines, { contextSize: 4096, parallelRequests: 1 }))
      .toBe("Context Size 4096 doesn't fit in this GPU's VRAM. Lower Context Size.");
  });

  it('names RAM for a CPU load', () => {
    expect(describeLoadError(kvLines, { contextSize: 4096, parallelRequests: 1, cpu: true }))
      .toBe("Context Size 4096 doesn't fit in this computer's RAM. Lower Context Size.");
  });

  it('points a model that does not fit at GPU Layers when the user set them', () => {
    expect(describeLoadError(['llama_model_load: error loading model: unable to allocate Vulkan0 buffer', 'failed to load model'], { gpuLayers: GPU_LAYERS_MAX }))
      .toBe("The model doesn't fit in this GPU's VRAM. Lower GPU Layers or set it to Auto.");
  });

  it('passes an unknown error line through, and answers null with none', () => {
    expect(describeLoadError(['srv  load_model: error: unknown model architecture'], {})).toBe('srv  load_model: error: unknown model architecture');
    expect(describeLoadError(['all good'], {})).toBeNull();
  });
});

describe('spawnCommand', () => {
  it('spawns the server directly on Windows', () => {
    expect(spawnCommand('llama-server.exe', ['-np', '1'], 'win32')).toEqual({ command: 'llama-server.exe', args: ['-np', '1'], stdin: 'ignore' });
  });

  // The supervising shell is POSIX-only; CI's Linux run proves it.
  describe.skipIf(process.platform === 'win32')('the POSIX supervisor', () => {
    /** Starts a stand-in server under the supervisor and resolves with the shell and the server's pid. */
    const supervised = () => new Promise((resolve) => {
      const cmd = spawnCommand(process.execPath, ['-e', 'console.log(process.pid); setInterval(() => {}, 1000)'], 'linux');
      const shell = spawn(cmd.command, cmd.args, { stdio: [cmd.stdin, 'pipe', 'ignore'] });
      shell.stdout.once('data', (d) => resolve({ shell, pid: Number(String(d).trim()) }));
    });
    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

    it('ends the server when the engine’s end of its stdin closes, as when the engine dies', async () => {
      const { shell, pid } = await supervised();
      expect(alive(pid)).toBe(true);
      shell.stdin.end();
      await expect.poll(() => alive(pid)).toBe(false);
    });

    it('ends the server when the engine stops it', async () => {
      const { shell, pid } = await supervised();
      shell.kill();
      await expect.poll(() => alive(pid)).toBe(false);
    });
  });
});

describe('bundled build', () => {
  it('maps each platform to its build folder', () => {
    expect(buildId({ platform: 'win32' })).toBe('win-x64-vulkan');
    expect(buildId({ platform: 'darwin', arch: 'arm64' })).toBe('mac-arm64');
    expect(buildId({ platform: 'darwin', arch: 'x64' })).toBe('mac-x64');
    expect(buildId({ platform: 'linux' })).toBe('linux-x64-vulkan');
    expect(buildId({ platform: 'linux', cpu: true })).toBe('linux-x64-cpu');
  });

  it('finds the binary under the first root that has it, else null', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'llama-bin-'));
    try {
      const dir = path.join(root, 'b', 'linux-x64-cpu');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'llama-server'), '');
      const roots = [path.join(root, 'a'), path.join(root, 'b')];
      expect(binaryPath({ platform: 'linux', cpu: true, roots })).toBe(path.join(dir, 'llama-server'));
      expect(binaryPath({ platform: 'linux', roots })).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
