import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { probeEndpoint } from '@/lib/useAiReachable';
import { resetEndpointReachableCache } from '@/lib/useEndpointReachable';
import { textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { EndpointTab } from './FormaquestionEndpointTab';

vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  resolveReasoningCapability: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/contextLength', async () => ({
  ...await vi.importActual<typeof import('@/lib/contextLength')>('@/lib/contextLength'),
  fetchContextLength: () => Promise.resolve(null),
}));
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/useAiReachable', async () => ({
  ...await vi.importActual<typeof import('@/lib/useAiReachable')>('@/lib/useAiReachable'),
  probeEndpoint: vi.fn(),
}));

const preset = (id: string) => ({
  id, name: id,
  values: { endpoint: `http://${id}.test/v1`, apiToken: '', model: `${id}-model`, contextWindowOverride: null, maxOutputOverride: { enabled: false, value: 1000 }, samplerOverrides: defaultEndpointSamplerOverrides() },
});

describe('the Endpoint tab probes', () => {
  beforeEach(() => {
    resetEndpointReachableCache();
    vi.mocked(probeEndpoint).mockReset().mockResolvedValue('ok');
    localStorage.clear();
    localStorage.setItem('FORMAMORPH_engineIsPresetMigrated', '1');
    localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({ activeId: 'game', presets: ['game', 'small'].map(preset) }));
  });

  it('a preset once when the Answer route and the editor both show it', async () => {
    render(<SettingsProvider><EndpointTab settings={helpSettingsOf({ answerEndpoint: 'small' })} onChange={() => {}} /></SettingsProvider>);
    await waitFor(() => expect(screen.getAllByText('Reachable')).toHaveLength(2));
    expect(probeEndpoint).toHaveBeenCalledTimes(1);
    expect(probeEndpoint).toHaveBeenCalledWith('http://small.test/v1/chat/completions', '', 'small-model');
  });
});
