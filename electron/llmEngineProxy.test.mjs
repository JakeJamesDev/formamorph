import { describe, it, expect, afterEach, vi } from 'vitest';
import proxyModule from './llmEngineProxy.cjs';

const { createEngineProxy, nodeChannel } = proxyModule;

// Real forked children running the real host, driven by the real proxy — the protocol between them is the
// only new seam, and a stubbed channel would prove nothing about it. Plain Node rather than Electron, which
// is the point of the host's transport shim.
const makeProxy = () => createEngineProxy({ spawn: nodeChannel });

// The renderer's LocalLlmState promises every one of these on every status, and the proxy is now what the
// renderer reads. A reply or push that drops one hands the UI `undefined` where the type says `number | null`.
const STATE_KEYS = [
  'status', 'modelPath', 'modelId', 'port', 'error',
  'contextSize', 'gpuLayers', 'flashAttention', 'parallelRequests', 'maxContextSize', 'engineVramMB',
  'gpuBackend', 'gpuDeviceNames', 'deviceVramTotalMB', 'deviceVramFreeMB',
];
const keysOf = (s) => Object.keys(s).sort();
const expectedKeys = [...STATE_KEYS].sort();

/** Is a pid still a live process? `signal 0` checks for existence without delivering anything. */
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

let proxy = null;
afterEach(() => { proxy?.dispose(); proxy = null; });

describe('engine proxy over a real child process', () => {
  it('reports the full stopped shape before any child exists', () => {
    proxy = makeProxy();
    const s = proxy.getState();
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(s.status).toBe('stopped');
    for (const k of STATE_KEYS.filter((k) => k !== 'status')) expect(s[k]).toBeNull();
    expect(proxy.enginePid()).toBeNull();
  });

  it('replies with the full state and mirrors it for synchronous readers', async () => {
    proxy = makeProxy();
    const s = await proxy.start({ port: 1234 }); // no modelPath: the engine's error branch, no model needed
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/no modelpath/i);
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(proxy.getState()).toEqual(s);
  });

  it('hands out copies of the mirror, so a caller cannot corrupt it', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    proxy.getState().error = 'tampered';
    expect(proxy.getState().error).toMatch(/no modelpath/i);
  });

  it('delivers the child’s status pushes to subscribers, full shape and in order', async () => {
    proxy = makeProxy();
    const seen = [];
    const off = proxy.onStatus((s) => seen.push(s));
    await proxy.start({ port: 1234 });
    await proxy.stop();
    off();
    for (const s of seen) expect(keysOf(s)).toEqual(expectedKeys);
    expect(seen.map((s) => s.status)).toEqual(['error', 'stopped']);
  });

  it('stops listeners on unsubscribe', async () => {
    proxy = makeProxy();
    const seen = [];
    proxy.onStatus((s) => seen.push(s))();
    await proxy.start({ port: 1234 });
    expect(seen).toEqual([]);
  });

  it('ends the child on stop, so its VRAM and native memory are actually released', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    const pid = proxy.enginePid();
    expect(pid).toBeGreaterThan(0);
    expect(alive(pid)).toBe(true);

    const s = await proxy.stop();
    expect(s.status).toBe('stopped');
    expect(proxy.enginePid()).toBeNull();
    await vi.waitFor(() => expect(alive(pid)).toBe(false));
  });

  it('reports a stop with no child running rather than spawning one to say so', async () => {
    proxy = makeProxy();
    const seen = [];
    proxy.onStatus((s) => seen.push(s));
    const s = await proxy.stop();
    expect(s.status).toBe('stopped');
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(seen.map((x) => x.status)).toEqual(['stopped']);
    expect(proxy.enginePid()).toBeNull();
  });

  it('pushes an error naming the exit when the child dies unasked', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    const seen = [];
    proxy.onStatus((s) => seen.push(s));

    process.kill(proxy.enginePid(), 'SIGKILL');

    await vi.waitFor(() => expect(seen.length).toBe(1));
    const crash = seen[0];
    expect(crash.status).toBe('error');
    expect(keysOf(crash)).toEqual(expectedKeys);
    expect(crash.error).toMatch(/stopped unexpectedly/i);
    expect(crash.error).toMatch(/exit code \d+|signal \w+/);
    expect(proxy.getState()).toEqual(crash);
    expect(proxy.enginePid()).toBeNull();
  });

  it('answers a call the child died under, instead of leaving it hanging', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    const pid = proxy.enginePid();

    process.kill(pid, 'SIGKILL');
    const s = await proxy.stop(); // already on its way to a process that is no longer there

    expect(s.status).toBe('error');
    expect(s.error).toMatch(/stopped unexpectedly/i);
    expect(keysOf(s)).toEqual(expectedKeys);
  });

  it('spawns a fresh child on the next start after a crash', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    const dead = proxy.enginePid();
    process.kill(dead, 'SIGKILL');
    // The no-model start already left status 'error', so wait on the crash itself, not on the status.
    await vi.waitFor(() => expect(proxy.getState().error).toMatch(/stopped unexpectedly/i));
    expect(proxy.enginePid()).toBeNull();

    const s = await proxy.start({ port: 1234 });
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/no modelpath/i);
    expect(proxy.enginePid()).toBeGreaterThan(0);
    expect(proxy.enginePid()).not.toBe(dead);
  });

  it('reports a stop that overlaps another stop as stopped, not as a crash', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    // The renderer's Stop while a delete or a folder move is stopping the engine of its own accord.
    const [a, b] = await Promise.all([proxy.stop(), proxy.stop()]);
    expect([a.status, b.status]).toEqual(['stopped', 'stopped']);
    expect([a.error, b.error]).toEqual([null, null]);
    expect(proxy.getState().status).toBe('stopped');
  });

  it('answers a call to a child that dies before it ever spawns', async () => {
    // Electron's utility process exits without emitting `spawn` when it cannot launch its module, so its
    // `ready` is a promise nothing resolves. Only a stub can hold a channel in that state.
    let exited = null;
    proxy = createEngineProxy({
      spawn: () => ({
        ready: new Promise(() => {}),
        pid: () => null,
        send: () => {},
        onMessage: () => {},
        onExit: (cb) => { exited = cb; },
        kill: () => {},
      }),
    });

    const started = proxy.start({ port: 1234 });
    exited({ code: 1, signal: null });

    const s = await started;
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/stopped unexpectedly \(exit code 1\)/i);
    expect(keysOf(s)).toEqual(expectedKeys);
  });

  it('leaves no child behind on dispose', async () => {
    proxy = makeProxy();
    await proxy.start({ port: 1234 });
    const pid = proxy.enginePid();
    proxy.dispose();
    proxy = null;
    await vi.waitFor(() => expect(alive(pid)).toBe(false));
  });
});
