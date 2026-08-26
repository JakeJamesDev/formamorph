import { describe, it, expect, beforeEach } from 'vitest';
import llmEngine from './llmEngine.cjs';

const { start, stop, getState, onStatus } = llmEngine;

// The renderer's LocalLlmState (src/lib/imageGen/desktop.ts) promises every one of these on every status.
// A branch that forgets one hands the UI `undefined` where the type says `number | null`.
const STATE_KEYS = [
  'status', 'modelPath', 'modelId', 'port', 'error', 'loadProgress',
  'contextSize', 'gpuLayers', 'flashAttention', 'parallelRequests', 'maxContextSize', 'engineVramMB',
  'gpuBackend', 'gpuDeviceNames', 'deviceVramTotalMB', 'deviceVramFreeMB',
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
  beforeEach(async () => { await stop(); });

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

  it('hands out copies, so a caller cannot mutate the live state', () => {
    const s = getState();
    s.gpuBackend = 'cuda';
    expect(getState().gpuBackend).toBeNull();
  });
});
