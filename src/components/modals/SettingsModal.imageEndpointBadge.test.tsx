// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { imageEndpointPresetCodec, type ImageEndpointValues } from '@/lib/imageEndpointPresets';
import { resetEndpointReachableCache } from '@/lib/useEndpointReachable';
import type { EndpointProbe } from '@/lib/useAiReachable';

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

// Each provider's protocol is covered in imageGen/probe.test.ts; here only the answer matters.
const probeImageEndpoint = vi.hoisted(() => vi.fn<(provider: string, url: string, token: string, model: string) => Promise<EndpointProbe>>());
vi.mock('@/lib/imageGen/probe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageGen/probe')>()),
  probeImageEndpoint,
}));

const IMAGE_KEY = 'FORMAMORPH_imageEndpointPresets';

function seed(overrides: Partial<ImageEndpointValues>) {
  localStorage.setItem(IMAGE_KEY, imageEndpointPresetCodec.serialize({
    activeId: 'p0',
    presets: [{ id: 'p0', name: 'Mine', overrides }],
  }));
}

const openImageEndpoints = () =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="endpoints" initialEndpointTab="img-endpoint" />
      </SettingsProvider>
    </ThemeProvider>,
  );

/** The row directly under the preset header, where the badge sits. */
const underHeader = () => screen.getByTestId('image-preset-header').nextElementSibling;

beforeEach(() => {
  localStorage.clear();
  resetEndpointReachableCache();
  probeImageEndpoint.mockReset();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('Settings → AI Endpoints → Image: reachability badge', () => {
  it('says Reachable under the select when the server answers', async () => {
    seed({ provider: 'comfyui', endpoint: 'http://comfy.test', model: 'any.safetensors' });
    probeImageEndpoint.mockResolvedValue('ok');
    openImageEndpoints();
    await waitFor(() => expect(underHeader()?.textContent).toContain('Reachable'));
    expect(probeImageEndpoint).toHaveBeenCalledWith('comfyui', 'http://comfy.test', '', 'any.safetensors');
  });

  it('names the missing model when the server answers without it', async () => {
    seed({ provider: 'invokeai', endpoint: 'http://invoke.test', model: 'Pony V6' });
    probeImageEndpoint.mockResolvedValue('unknownModel');
    openImageEndpoints();
    await waitFor(() => expect(underHeader()?.textContent).toContain('Reachable, but no "Pony V6"'));
  });

  it("says Didn't answer when the server is down", async () => {
    seed({ provider: 'a1111', endpoint: 'http://a1111.test', model: '' });
    probeImageEndpoint.mockResolvedValue('unreachable');
    openImageEndpoints();
    await waitFor(() => expect(underHeader()?.textContent).toContain("Didn't answer"));
  });

  it('shows no badge and sends no probe for NovelAI or for OpenAI on web', async () => {
    for (const provider of ['novelai', 'openai'] as const) {
      seed({ provider, endpoint: 'https://cloud.test', model: 'm' });
      const view = openImageEndpoints();
      await screen.findByTestId('image-preset-header');
      expect(screen.queryByRole('button', { name: 'Recheck' })).toBeNull();
      view.unmount();
    }
    expect(probeImageEndpoint).not.toHaveBeenCalled();
  });
});
