import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { HostedAiAutoSwitch } from '@/components/HostedAiAutoSwitch';
import AuthService from '@/services/AuthService';
import { textEndpointPresetCodec, FORMAMORPH_AI_PRESET_ID, DEFAULT_TEXT_PRESET_ID, type TextEndpointPresetStore } from '@/lib/textEndpointPresets';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';
import { readHostedDevice } from '@/lib/hostedAi/hostedAllowance';

const STATE = {
  tier: 'supporter', state: 'ready', window: 24000, maxTokens: 600, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 5, turnsLeft: 200, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [],
};

const gate = vi.hoisted(() => ({ attested: true }));
vi.mock('@/contexts/AgeGateContext', () => ({ useAgeGate: () => ({ attested: gate.attested }) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider><HostedAiAutoSwitch />{children}</SettingsProvider>
);
const ENDPOINTS_KEY = 'FORMAMORPH_textEndpointPresets';

function seed(activeId: string) {
  const store: TextEndpointPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { endpoint: 'http://mine.test/v1', apiToken: 'k', model: 'mine-8b', contextWindowOverride: 8192, maxOutputOverride: { enabled: true, value: 300 }, samplerOverrides: defaultEndpointSamplerOverrides() } }],
  };
  localStorage.setItem(ENDPOINTS_KEY, textEndpointPresetCodec.serialize(store));
  const prompts: PromptPresetStore = { activeId: 'p', presets: [{ id: 'p', name: 'P', values: { systemPrompt: 'A' } as never, style: 'markdown' }] };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
}

let served: Record<string, unknown> = STATE;
let stateReads = 0;
beforeEach(() => {
  served = STATE;
  gate.attested = true;
  stateReads = 0;
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input !== HOSTED_STATE_URL) return new Response('{}', { status: 404 });
    stateReads += 1;
    return new Response(JSON.stringify({ success: true, data: served }));
  }));
  AuthService.token = 'token-a';
  hostedSession.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

const activeId = () => (JSON.parse(localStorage.getItem(ENDPOINTS_KEY) ?? '{}') as { activeId?: string }).activeId;

describe('SettingsContext: the one-time switch to Formamorph AI', () => {
  it('selects Formamorph AI the first time the device sees a tier, and records the preset it replaced', async () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.activeTextEndpointPresetId).toBe(FORMAMORPH_AI_PRESET_ID));
    expect(readHostedDevice()).toEqual({ switched: true, previousPresetId: 'mine' });
  });

  it('never switches again once the player picks another preset', async () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.activeTextEndpointPresetId).toBe(FORMAMORPH_AI_PRESET_ID));
    act(() => result.current.selectTextEndpointPreset('mine'));
    await act(async () => { await result.current.refreshHostedState(); });
    expect(result.current.activeTextEndpointPresetId).toBe('mine');
  });

  it('waits while the allowance is spent and leaves the device flag unset, then switches once it is usable', async () => {
    seed('mine');
    served = { ...STATE, state: 'exhausted', percentUsed: 100 };
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hostedAi.hosted?.state).toBe('exhausted'));
    expect(result.current.activeTextEndpointPresetId).toBe('mine');
    expect(readHostedDevice().switched).toBe(false);
    served = STATE;
    await act(async () => { await result.current.refreshHostedState(); });
    await waitFor(() => expect(result.current.activeTextEndpointPresetId).toBe(FORMAMORPH_AI_PRESET_ID));
  });

  it('asks the server for nothing while the age gate is unanswered', async () => {
    seed('mine');
    gate.attested = false;
    const { result } = renderHook(() => useSettings(), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(stateReads).toBe(0);
    expect(result.current.activeTextEndpointPresetId).toBe('mine');
  });

  it('does not switch an account without a tier', async () => {
    seed('mine');
    served = { ...STATE, tier: null, state: 'locked' };
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.hostedAi.hosted?.state).toBe('locked'));
    expect(result.current.activeTextEndpointPresetId).toBe('mine');
    expect(readHostedDevice().switched).toBe(false);
  });
});

describe('SettingsContext: switching back from Formamorph AI', () => {
  it('returns to the recorded preset in one call', async () => {
    seed('mine');
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.activeTextEndpointPresetId).toBe(FORMAMORPH_AI_PRESET_ID));
    act(() => result.current.switchBackFromHostedAi());
    expect(activeId()).toBe('mine');
  });

  it('records the preset a hand-made selection replaces', async () => {
    seed('mine');
    localStorage.setItem('FORMAMORPH_hostedAiDevice', JSON.stringify({ switched: true, previousPresetId: null }));
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.selectTextEndpointPreset(FORMAMORPH_AI_PRESET_ID));
    act(() => result.current.switchBackFromHostedAi());
    expect(activeId()).toBe('mine');
  });

  it('falls back to Demo AI when the recorded preset is gone', async () => {
    seed(FORMAMORPH_AI_PRESET_ID);
    localStorage.setItem('FORMAMORPH_hostedAiDevice', JSON.stringify({ switched: true, previousPresetId: 'deleted-preset' }));
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => result.current.switchBackFromHostedAi());
    expect(activeId()).toBe(DEFAULT_TEXT_PRESET_ID);
  });
});
