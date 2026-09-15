import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { textEndpointPresetCodec, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { resetProbeMemo } from '@/lib/probeMemo';
import { resetReasoningCatalog } from '@/lib/reasoningCatalog';

// The endpoint under test advertises nothing at all, which is the case the observation exists for: every
// capability path 404s, so what the replies showed is the only thing left to answer from.
const ENDPOINT = 'http://silent.test/v1';
const MODEL = 'quiet-12b';
const SIG = `${ENDPOINT}/chat/completions|${MODEL}`;

const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';

function seedEndpoint() {
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
  localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
}

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** Answers every request with a 404, so nothing advertises and no completion is ever accepted. */
const silentFetch = vi.fn(async () => ({
  ok: false, status: 404, json: async () => ({}), text: async () => '',
} as Response));

beforeEach(() => {
  localStorage.clear();
  resetProbeMemo();
  resetReasoningCatalog();
  silentFetch.mockClear();
  vi.stubGlobal('fetch', silentFetch);
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  seedEndpoint();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** A provider with reasoning engaged, which is the state the capability record is resolved under. */
async function engagedSettings() {
  const view = renderHook(() => useSettings(), { wrapper });
  await act(async () => { view.result.current.setNativeReasoning({ enabled: true, level: 'high' }); });
  return view;
}

describe('a reply teaches the capability record', () => {
  it('marks the model as reasoning when a reply carried a reasoning field', async () => {
    const view = await engagedSettings();
    await act(async () => {
      view.result.current.noteReasoningReply(
        { url: `${ENDPOINT}/chat/completions`, model: MODEL },
        'The player wants the door opened.',
        'You open the door.',
        'high',
      );
    });
    await waitFor(() => expect(view.result.current.reasoningCapability?.reasons).toBe(true));
    expect(view.result.current.reasoningCapability?.sources.reasons).toBe('observed');
  });

  it('marks the model as reasoning when a reply carried an inline think block', async () => {
    const view = await engagedSettings();
    await act(async () => {
      view.result.current.noteReasoningReply(
        { url: `${ENDPOINT}/chat/completions`, model: MODEL },
        '',
        '<think>Open the door.</think>You open the door.',
        'high',
      );
    });
    await waitFor(() => expect(view.result.current.reasoningCapability?.reasons).toBe(true));
  });

  it('rules the model out when a reply came back bare under a positive effort', async () => {
    const view = await engagedSettings();
    await act(async () => {
      view.result.current.noteReasoningReply(
        { url: `${ENDPOINT}/chat/completions`, model: MODEL },
        '',
        'You open the door.',
        'high',
      );
    });
    await waitFor(() => expect(view.result.current.reasoningCapability?.reasons).toBe(false));
    expect(view.result.current.reasoningCapability?.sources.reasons).toBe('observed');
  });

  it('leaves the record alone when a bare reply carried no positive effort', async () => {
    const view = await engagedSettings();
    await act(async () => {
      view.result.current.noteReasoningReply(
        { url: `${ENDPOINT}/chat/completions`, model: MODEL },
        '',
        'You open the door.',
        'none',
      );
    });
    // Nothing to learn, so nothing is stored for this signature.
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.reasoningCapability?.reasons ?? null).toBeNull();
  });

  it('writes the answer under the endpoint and model that replied', async () => {
    const view = await engagedSettings();
    await act(async () => {
      view.result.current.noteReasoningReply(
        { url: `${ENDPOINT}/chat/completions`, model: MODEL },
        'Thinking.',
        'You open the door.',
        'high',
      );
    });
    await waitFor(() => expect(view.result.current.reasoningCapability?.reasons).toBe(true));
    const stored = JSON.parse(localStorage.getItem('FORMAMORPH_reasoningSupport') ?? '{}');
    expect(stored[SIG]?.reasons).toBe(true);
  });
});
