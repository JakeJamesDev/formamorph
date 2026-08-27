import { describe, it, expect, beforeEach } from 'vitest';
import llmEngine from './llmEngine.cjs';

const { start, stop, getState, onStatus } = llmEngine;

// The renderer's LocalLlmState (src/lib/imageGen/desktop.ts) promises every one of these on every status.
// A branch that forgets one hands the UI `undefined` where the type says `number | null`.
const STATE_KEYS = [
  'status', 'modelPath', 'modelId', 'port', 'error', 'loadProgress',
  'contextSize', 'gpuLayers', 'flashAttention', 'parallelRequests', 'maxContextSize', 'engineVramMB',
  'gpuBackend', 'gpuDeviceNames', 'deviceVramTotalMB', 'deviceVramFreeMB',
  'gpuDeviceIndex', 'gpuDeviceOrigin', 'gpuDeviceOptions',
];

const keysOf = (s) => Object.keys(s).sort();
const expectedKeys = [...STATE_KEYS].sort();

// Read at import, before any stop() can refill the object: the renderer polls 'llm-status' on mount, so the
// declared initial state is what it sees on a desktop launch where no model was ever loaded.
const initialState = getState();

describe('llmEngine status shape', () => {
  it('declares every field up front, all null', () => {
    expect(keysOf(initialState)).toEqual(expectedKeys);
    expect(initialState.status).toBe('stopped');
    for (const k of STATE_KEYS.filter((k) => k !== 'status')) expect(initialState[k]).toBeNull();
  });
});

describe('llmEngine status transitions', () => {
  // A pinned start sets the device filter in this process's own environment, and stop() has no reason to
  // clear it. Left behind, it would decide what a later test's engine could see.
  beforeEach(async () => {
    await stop();
    delete process.env.GGML_VK_VISIBLE_DEVICES;
  });

  it('reports every field after a stop, all null', () => {
    const s = getState();
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(s.status).toBe('stopped');
    for (const k of STATE_KEYS.filter((k) => k !== 'status')) expect(s[k]).toBeNull();
  });

  it('keeps the full shape on the no-model error branch', async () => {
    const s = await start({ port: 1234 });
    expect(s.status).toBe('error');
    expect(keysOf(s)).toEqual(expectedKeys);
    expect(s.gpuBackend).toBeNull();
    expect(s.deviceVramTotalMB).toBeNull();
  });

  it('pushes the full shape to subscribers, not just to getState', async () => {
    const seen = [];
    const off = onStatus((s) => seen.push(s));
    await start({ port: 1234 });
    await stop();
    off();
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) expect(keysOf(s)).toEqual(expectedKeys);
  });

  it('reports the device pin the start asked for, and where the pick came from', async () => {
    // The renderer's only window onto which GPU the engine was restricted to — a wrong pin has to be
    // readable off one screenshot rather than reproduced.
    const s = await start({ port: 1234, gpuDeviceIndex: 1, gpuDeviceOrigin: 'manual' });
    expect(s.gpuDeviceIndex).toBe(1);
    expect(s.gpuDeviceOrigin).toBe('manual');
  });

  it('reports the device list the pin was chosen from, which a pinned backend can no longer enumerate', async () => {
    // "Which device, out of which" is the whole answer to a wrong-device report — the pinned engine only
    // ever sees its own, so the list has to travel with the request.
    const options = ['Intel(R) UHD Graphics 770', 'NVIDIA GeForce RTX 4080'];
    const s = await start({ port: 1234, gpuDeviceIndex: 1, gpuDeviceOrigin: 'auto', gpuDeviceOptions: options });
    expect(s.gpuDeviceOptions).toEqual(options);
    // The index indexes into it, which is what lets a reader name the pinned device.
    expect(s.gpuDeviceOptions[s.gpuDeviceIndex]).toBe('NVIDIA GeForce RTX 4080');
  });

  it('keeps its own copy of that list, so the caller cannot rewrite it after the fact', async () => {
    const options = ['Intel(R) UHD Graphics 770', 'NVIDIA GeForce RTX 4080'];
    await start({ port: 1234, gpuDeviceIndex: 1, gpuDeviceOrigin: 'auto', gpuDeviceOptions: options });
    options[1] = 'tampered';
    expect(getState().gpuDeviceOptions[1]).toBe('NVIDIA GeForce RTX 4080');
  });

  it('reports no pin when the start carried none', async () => {
    const s = await start({ port: 1234 });
    expect(s.gpuDeviceIndex).toBeNull();
    expect(s.gpuDeviceOrigin).toBeNull();
  });

  it('hands out copies, so a caller cannot mutate the live state', () => {
    const s = getState();
    s.gpuBackend = 'cuda';
    expect(getState().gpuBackend).toBeNull();
  });
});
