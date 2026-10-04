// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const probeImageEndpoint = vi.hoisted(() => vi.fn<(provider: string, url: string, token: string, model: string) => Promise<EndpointProbe>>());
vi.mock('@/lib/imageGen/probe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageGen/probe')>()),
  probeImageEndpoint,
}));

const IMAGE_KEY = 'FORMAMORPH_imageEndpointPresets';
const OFF_KEY = 'FORMAMORPH_imageGenDisabled';
const OFF_LINE = 'Image generation is off. Turn it on to edit these settings.';

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

const slot = () => screen.getByTestId('image-reachability-slot');
const toggle = () => screen.getByRole('checkbox', { name: 'Enable Image Generation' });
const byId = (id: string) => document.getElementById(id)!;

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

describe('Settings → AI Endpoints → Image: off state', () => {
  it('keeps the connection rows mounted and disabled under the line, and the switch still toggles', async () => {
    seed({ provider: 'comfyui', endpoint: 'http://comfy.test', model: '' });
    localStorage.setItem(OFF_KEY, 'true');
    probeImageEndpoint.mockResolvedValue('ok');
    openImageEndpoints();

    expect(await screen.findByText(OFF_LINE)).toBeTruthy();
    for (const id of ['imageProvider', 'imageEndpoint', 'imageApiToken']) {
      expect(byId(id), id).toBeDisabled();
    }
    for (const name of ['Steps', 'CFG Scale']) {
      expect(screen.getByRole('spinbutton', { name }), name).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'How to Set Up' })).toBeDisabled();
    expect(toggle()).toBeEnabled();
    // Tag fields are contenteditable and ignore `disabled`, so the group is inert as well.
    expect(byId('imageEndpoint').closest('fieldset')).toHaveAttribute('inert');
    expect(toggle().closest('fieldset')).toBeNull();

    fireEvent.click(toggle());
    await waitFor(() => expect(screen.queryByText(OFF_LINE)).toBeNull());
    for (const id of ['imageProvider', 'imageEndpoint', 'imageApiToken']) {
      expect(byId(id), id).toBeEnabled();
    }
    expect(byId('imageEndpoint').closest('fieldset')).not.toHaveAttribute('inert');

    fireEvent.click(toggle());
    expect(await screen.findByText(OFF_LINE)).toBeTruthy();
    expect(byId('imageEndpoint')).toBeDisabled();
  });

  it('shows no line and enabled rows while image generation is on', () => {
    seed({ provider: 'comfyui', endpoint: 'http://comfy.test', model: '' });
    probeImageEndpoint.mockResolvedValue('ok');
    openImageEndpoints();
    expect(screen.queryByText(OFF_LINE)).toBeNull();
    expect(byId('imageEndpoint')).toBeEnabled();
  });

  it('draws no reachability badge and sends no probe while it is off', async () => {
    seed({ provider: 'comfyui', endpoint: 'http://comfy.test', model: '' });
    localStorage.setItem(OFF_KEY, 'true');
    openImageEndpoints();
    await screen.findByText(OFF_LINE);
    expect(screen.queryByRole('button', { name: 'Recheck' })).toBeNull();
    expect(probeImageEndpoint).not.toHaveBeenCalled();
  });
});

describe('Settings → AI Endpoints → Image: badge slot', () => {
  /** The class list is what fixes the slot's size, so one list across states is one box. */
  it('keeps one slot, with the same size classes, from probing to answered to no badge', async () => {
    seed({ provider: 'a1111', endpoint: 'http://a1111.test', model: '' });
    let answer!: (v: EndpointProbe) => void;
    probeImageEndpoint.mockReturnValue(new Promise<EndpointProbe>((resolve) => { answer = resolve; }));
    const view = openImageEndpoints();

    await waitFor(() => expect(slot().textContent).toContain('Checking'));
    const probingNode = slot();
    const sizeClasses = probingNode.className;

    answer('unreachable');
    await waitFor(() => expect(slot().textContent).toContain("Didn't answer"));
    expect(slot()).toBe(probingNode);
    expect(slot().className).toBe(sizeClasses);
    view.unmount();

    // A provider with no probe draws no badge, and the slot still holds its place.
    localStorage.clear();
    seed({ provider: 'novelai', endpoint: 'https://cloud.test', model: 'm' });
    openImageEndpoints();
    await screen.findByTestId('image-preset-header');
    expect(slot().textContent).toBe('');
    expect(slot().className).toBe(sizeClasses);
  });

  it('sits directly under the preset header, above the switch', async () => {
    seed({ provider: 'a1111', endpoint: 'http://a1111.test', model: '' });
    probeImageEndpoint.mockResolvedValue('ok');
    openImageEndpoints();
    const header = await screen.findByTestId('image-preset-header');
    expect(header.nextElementSibling).toBe(slot());
  });
});
