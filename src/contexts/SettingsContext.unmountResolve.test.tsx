import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { resolveReasoningCapability, type ReasoningCapability } from '@/lib/reasoningEffort';

// The resolver is the network seam: each case holds its answer back and releases it by hand.
vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  resolveReasoningCapability: vi.fn(),
}));

// React drops a state write on an unmounted provider without a sign, so the capability cache's setter is
// counted here. Every other key gets the real hook untouched.
const cacheWrites = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/lib/usePersistentState', async () => {
  const actual = await vi.importActual<typeof import('@/lib/usePersistentState')>('@/lib/usePersistentState');
  const usePersistentState: typeof actual.usePersistentState = (key, defaultValue, codec) => {
    const [value, setValue] = actual.usePersistentState(key, defaultValue, codec);
    if (!key.endsWith('_reasoningSupport')) return [value, setValue] as const;
    const counted: typeof setValue = (next) => { cacheWrites.count += 1; setValue(next); };
    return [value, counted] as const;
  };
  return { ...actual, usePersistentState };
});

const ENDPOINT = 'http://slow.test/v1';
const MODEL = 'late-12b';
const RECORD: ReasoningCapability = {
  reasons: true, levels: [], budget: null, dialect: 'unknown', offAllowed: null,
  sources: { reasons: 'native', levels: 'native' },
};

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

let release: (record: ReasoningCapability | null) => void;

beforeEach(() => {
  localStorage.clear();
  const store: TextEndpointPresetStore = {
    activeId: 'only',
    presets: [{
      id: 'only',
      name: 'Only',
      values: {
        endpoint: ENDPOINT, apiToken: '', model: MODEL, contextWindowOverride: 8192,
        maxOutputOverride: { enabled: true, value: 400 }, samplerOverrides: defaultEndpointSamplerOverrides(),
      },
    }],
  };
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize(store));
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  cacheWrites.count = 0;
  vi.mocked(resolveReasoningCapability).mockReset().mockImplementation(
    () => new Promise((resolve) => { release = resolve; }),
  );
});

afterEach(() => { localStorage.clear(); });

/** A provider with reasoning engaged, held at the point where its debounced resolve is in flight. */
async function resolveInFlight() {
  const view = renderHook(() => useSettings(), { wrapper });
  await act(async () => { view.result.current.setNativeReasoning({ enabled: true, level: 'high' }); });
  // The unprompted resolve is debounced by 1200 ms.
  await waitFor(() => expect(resolveReasoningCapability).toHaveBeenCalledTimes(1), { timeout: 3000 });
  return view;
}

describe('a capability resolve that outlives its provider', () => {
  // The control for the case below: the same late answer reaches the cache while the provider is mounted.
  it('stores the answer while the provider is mounted', async () => {
    const view = await resolveInFlight();
    await act(async () => { release(RECORD); });
    expect(cacheWrites.count).toBe(1);
    expect(view.result.current.reasoningCapability?.reasons).toBe(true);
  });

  it('writes no state when the answer lands after unmount', async () => {
    const view = await resolveInFlight();
    view.unmount();
    release(RECORD);
    await vi.mocked(resolveReasoningCapability).mock.results[0].value;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cacheWrites.count).toBe(0);
  });

  it('aborts the resolve on unmount', async () => {
    const view = await resolveInFlight();
    const signal = vi.mocked(resolveReasoningCapability).mock.calls[0][2]?.signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
