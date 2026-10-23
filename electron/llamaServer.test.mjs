import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import llamaServer from './llamaServer.cjs';
import { loadFixture } from './fakeLlamaServer.mjs';

const { parseListDevices, backendOf, loadPercent, parseLogLine, sseReader, describeLoadError, buildId, binaryPath, spawnCommand, GPU_LAYERS_MAX } = llamaServer;
const fixture = loadFixture();

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
    expect(instance.some((l) => l.text === 'srv  llama_server: model loaded')).toBe(true);
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
    expect(describeLoadError(kvLines, { contextSize: 8192, parallelRequests: 2 }))
      .toBe("Context Size 8192 with 2 Parallel Requests doesn't fit in this GPU's VRAM. Lower Context Size or Parallel Requests.");
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
