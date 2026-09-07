import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { DEFAULT_TEXT_PRESET_ID, textEndpointPresetCodec, type TextEndpointPresetStore, valuesForId } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { buildAiRequestSpec, type AiCall, type AiEndpointTarget, type AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { streamAiRequest, type AiStreamEvent } from '@/lib/aiRequest/aiStream';
import { rejectedEndpointOverride } from '@/lib/aiRequest/rejectedOverride';
import { lengthGuidance, outputReserve } from '@/lib/outputLength';

vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  detectSupportedReasoningEfforts: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/contextLength', async () => ({
  ...await vi.importActual<typeof import('@/lib/contextLength')>('@/lib/contextLength'),
  fetchContextLength: vi.fn().mockResolvedValue(null),
}));

const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';
const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

function values(topP: number) {
  const samplerOverrides = defaultEndpointSamplerOverrides();
  samplerOverrides.topP = { enabled: true, value: topP };
  return {
    endpoint: 'https://example.test/v1', apiToken: '', model: 'test-model', contextWindowOverride: null,
    maxOutputOverride: { enabled: true, value: 512 }, samplerOverrides,
  };
}

function stored(): TextEndpointPresetStore {
  return textEndpointPresetCodec.parse(localStorage.getItem(ENDPOINTS_KEY)!);
}

const narrationCall: AiCall = {
  systemPrompt: 'Narrate.', messages: [{ role: 'user', content: 'Continue.' }], requestType: 'narration',
};

function specFromPersisted(id: string): ReturnType<typeof buildAiRequestSpec> {
  const endpoint = valuesForId(stored(), id);
  const target: AiEndpointTarget = {
    endpointId: id, url: `${endpoint.endpoint}/chat/completions`, apiToken: endpoint.apiToken, model: endpoint.model,
    maxTokens: endpoint.maxOutputOverride.enabled ? endpoint.maxOutputOverride.value : undefined,
    localEngine: false, samplerOverrides: endpoint.samplerOverrides, supportedReasoningEfforts: null,
  };
  const snapshot: AiSettingsSnapshot = {
    resolveTarget: () => target, thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: false,
    promptReasoning: {}, promptReasoningBudget: {}, promptSamplers: {}, genTemperature: 0.7,
    genRepetitionPenalty: 1.1, genTopP: 0.9, genTopK: 40, genMinP: 0.05,
    paragraphLimit: 'auto', disableThinking: false,
  };
  return buildAiRequestSpec(snapshot, narrationCall);
}

async function rejectionFor(spec: ReturnType<typeof buildAiRequestSpec>, parameter: string): Promise<unknown> {
  const response = new Response(JSON.stringify({
    error: { message: `${parameter} is not supported`, type: 'invalid_request_error', param: parameter },
  }), { status: 400 });
  try {
    for await (const _event of streamAiRequest(spec, { fetchImpl: (() => Promise.resolve(response)) as typeof fetch })) {
      // A rejected request never yields an event.
    }
  } catch (error) {
    return error;
  }
  throw new Error('Expected the controlled endpoint rejection to throw');
}

async function collect(events: AsyncIterable<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const collected: AiStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('SettingsContext rejected endpoint overrides', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => localStorage.clear());

  it('persists a disabled captured target while retaining its value and isolating the active endpoint', () => {
    const store: TextEndpointPresetStore = {
      activeId: 'other',
      presets: [
        { id: 'rejected', name: 'Rejected', values: values(0.83) },
        { id: 'other', name: 'Other', values: values(0.21) },
      ],
    };
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.disableEndpointOverride('rejected', 'topP'));
    unmount();

    expect(valuesForId(stored(), 'rejected').samplerOverrides.topP).toEqual({ enabled: false, value: 0.83 });
    expect(valuesForId(stored(), 'other').samplerOverrides.topP).toEqual({ enabled: true, value: 0.21 });
  });

  it('persists the hosted Default target separately from a selected custom endpoint', () => {
    const defaults = defaultEndpointSamplerOverrides();
    defaults.topK = { enabled: true, value: 64 };
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize({
      activeId: 'other',
      presets: [{ id: 'other', name: 'Other', values: values(0.21) }],
      defaultSamplerOverrides: defaults,
    }));
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });

    act(() => result.current.disableEndpointOverride(DEFAULT_TEXT_PRESET_ID, 'topK'));
    unmount();

    expect(valuesForId(stored(), DEFAULT_TEXT_PRESET_ID).samplerOverrides.topK).toEqual({ enabled: false, value: 64 });
  });

  it('lets the player retry after a rejected Top-p override without sending it again', async () => {
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize({
      activeId: 'rejected', presets: [{ id: 'rejected', name: 'Rejected', values: values(0.83) }],
    }));
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    const rejected = specFromPersisted('rejected');

    expect(rejected.body.top_p).toBe(0.83);
    expect(rejectedEndpointOverride(await rejectionFor(rejected, 'top_p'), rejected)).toBe('topP');
    act(() => result.current.disableEndpointOverride('rejected', 'topP'));
    const retry = specFromPersisted('rejected');
    expect(retry.body).not.toHaveProperty('top_p');

    const sent: { body?: string } = {};
    const events = await collect(streamAiRequest(retry, {
      fetchImpl: ((_url: string, init: RequestInit) => {
        sent.body = init.body as string;
        return Promise.resolve(new Response('data: {"choices":[{"delta":{"content":"Retry works"}}]}\n\ndata: [DONE]\n\n'));
      }) as typeof fetch,
    }));

    expect(JSON.parse(sent.body!)).not.toHaveProperty('top_p');
    expect(events.some((event) => event.type === 'done' && event.result.content === 'Retry works')).toBe(true);
    unmount();
  });

  it('removes a rejected Max Output cap from the explicit retry and its derived guidance', async () => {
    localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize({
      activeId: 'rejected', presets: [{ id: 'rejected', name: 'Rejected', values: values(0.83) }],
    }));
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });
    const rejected = specFromPersisted('rejected');

    expect(rejected.body.max_tokens).toBe(512);
    expect(rejectedEndpointOverride(await rejectionFor(rejected, 'max_tokens'), rejected)).toBe('maxOutput');
    act(() => result.current.disableEndpointOverride('rejected', 'maxOutput'));
    const retry = specFromPersisted('rejected');

    expect(retry.body).not.toHaveProperty('max_tokens');
    expect(retry.target.maxTokens).toBeUndefined();
    expect(outputReserve(retry.target.maxTokens)).toBe(0);
    expect(lengthGuidance('auto', retry.target.maxTokens)).toBe('');
    unmount();
  });
});
