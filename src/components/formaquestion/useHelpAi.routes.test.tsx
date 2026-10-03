import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { helpSettingsOf, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { BUILTIN_ENGINE_PRESET_ID, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { useHelpAi } from './useHelpAi';

// The provider resolves each endpoint's capabilities; keep those probes off the network spy.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, detectReasoningCapability: vi.fn().mockResolvedValue(null), resolveReasoningCapability: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: vi.fn().mockResolvedValue(null) };
});

const preset = (id: string) => ({
  id, name: id,
  values: { endpoint: `http://${id}.test/v1`, apiToken: '', model: `${id}-model`, contextWindowOverride: null, maxOutputOverride: { enabled: false, value: 1000 }, samplerOverrides: defaultEndpointSamplerOverrides() },
});

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;
const render = (change: HelpSettingsChange, open = true) => renderHook(
  ({ help }) => ({ ai: useHelpAi(open, help), settings: useSettings() }),
  { wrapper, initialProps: { help: helpSettingsOf(change) } },
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_engineIsPresetMigrated', '1');
  // The game plays on "game", which answers; "dead" does not.
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({ activeId: 'game', presets: [preset('game'), preset('dead')] }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('dead.test')) throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify({ data: [] }), { status: url.includes('/api/v0/') ? 404 : 200 });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('the help AI on its own routes', () => {
  it('finds no AI when the answer endpoint does not answer, while the game endpoint does', async () => {
    const { result } = render({ answerEndpoint: 'dead' });
    await waitFor(() => expect(result.current.ai.reachable).toBe(false));
  });

  it('finds the AI on the game endpoint with Follow Active, whatever the pick route', async () => {
    const { result } = render({ answerEndpoint: null, pickEndpoint: 'dead' });
    await waitFor(() => expect(result.current.ai.reachable).toBe(true));
  });

  it('wants the engine while a help route resolves to it, with the window closed, and stops with the route', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    const { result, rerender } = render({}, false);
    expect(result.current.settings.engineWanted).toBe(false);

    rerender({ help: helpSettingsOf({ pickEndpoint: BUILTIN_ENGINE_PRESET_ID }) });
    expect(result.current.settings.engineWanted).toBe(true);
    rerender({ help: helpSettingsOf({ answerEndpoint: BUILTIN_ENGINE_PRESET_ID }) });
    expect(result.current.settings.engineWanted).toBe(true);
    expect(result.current.settings.resolveEndpointForKind('help', [BUILTIN_ENGINE_PRESET_ID]).localEngine).toBe(true);

    rerender({ help: helpSettingsOf({}) });
    expect(result.current.settings.engineWanted).toBe(false);
  });
});
