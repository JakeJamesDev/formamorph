import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { AgeGateProvider } from './AgeGateContext';
import { HostedAiStateSync } from '@/components/HostedAiStateSync';
import AuthService from '@/services/AuthService';
import { textEndpointPresetCodec, FORMAMORPH_AI_PRESET_ID } from '@/lib/textEndpointPresets';
import { hostedSession } from '@/lib/hostedAi/hostedSession';
import { HOSTED_STATE_URL } from '@/lib/hostedAi/hostedUrls';

// The flag hoists per file, so the build with the community features off has its own file.
vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: false }));

const STATE = {
  tier: 'supporter', state: 'ready', window: 24000, maxTokens: 200, tokenMargin: 800,
  model: { id: 'entry-7', capabilities: {} },
  percentUsed: 5, turnsLeft: 200, resetAt: '2026-11-01T00:00:00.000Z', acknowledged: [],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider><AgeGateProvider><HostedAiStateSync />{children}</AgeGateProvider></SettingsProvider>
);

const requested: string[] = [];
beforeEach(() => {
  requested.length = 0;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_hostedAiDevice', JSON.stringify({ switched: true, previousPresetId: null }));
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({ activeId: FORMAMORPH_AI_PRESET_ID, presets: [] }));
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    requested.push(String(input));
    if (input === HOSTED_STATE_URL) return new Response(JSON.stringify({ success: true, data: STATE }));
    return new Response('{}', { status: 404 });
  }));
  AuthService.token = 'token-a';
  hostedSession.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  AuthService.token = null;
  hostedSession.reset();
});

describe('SettingsContext: Formamorph AI with the community features off', () => {
  it('reads the hosted state with no gate to wait for', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current.hostedAi.presetState).toBe('ready'));
    expect(requested.filter((url) => url === HOSTED_STATE_URL)).toHaveLength(1);
    expect(requested.some((url) => url.includes('/policies/age-gate'))).toBe(false);
  });
});
