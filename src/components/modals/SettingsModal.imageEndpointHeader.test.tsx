// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { imageEndpointPresetCodec, type ImageEndpointPresetStore } from '@/lib/imageEndpointPresets';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

// The header's badge probes the image server; its answers are covered in the badge test.
vi.mock('@/lib/imageGen/probe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/imageGen/probe')>()),
  probeImageEndpoint: () => Promise.resolve('ok'),
}));

const IMAGE_KEY = 'FORMAMORPH_imageEndpointPresets';
const storedStore = () => imageEndpointPresetCodec.parse(localStorage.getItem(IMAGE_KEY)!);

function seed(names: string[]) {
  const store: ImageEndpointPresetStore = {
    activeId: 'p0',
    presets: names.map((name, i) => ({ id: `p${i}`, name, overrides: {} })),
  };
  localStorage.setItem(IMAGE_KEY, imageEndpointPresetCodec.serialize(store));
}

const openImageEndpoints = () =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="endpoints" initialEndpointTab="img-endpoint" />
      </SettingsProvider>
    </ThemeProvider>,
  );

const header = () => screen.getByTestId('image-preset-header');
const rowButton = (name: string) => within(header()).getByRole('button', { name });

/** Opens the narrow header's overflow menu and returns its item names in order. */
async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Preset Actions' }));
  const menu = await screen.findByRole('menu');
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map((n) => n.textContent);
}

beforeEach(() => {
  localStorage.clear();
  // jsdom has no matchMedia; the theme provider reads it on mount.
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('Settings → AI Endpoints → Image: preset header', () => {
  it('offers Duplicate, Rename and Reset with one preset, and no Delete, Import or Export', async () => {
    seed(['Mine']);
    openImageEndpoints();
    for (const name of ['Duplicate', 'Rename', 'Reset']) expect(rowButton(name)).toBeTruthy();
    for (const name of ['Delete', 'Import', 'Export']) expect(within(header()).queryByRole('button', { name })).toBeNull();
    // An open menu hides the rest of the page from the accessibility tree, so it goes last.
    expect(await openMenu()).toEqual(['Duplicate', 'Rename', 'Reset']);
  });

  it('adds Delete once a second preset exists, with no Import or Export', async () => {
    seed(['Mine', 'Other']);
    openImageEndpoints();
    expect(rowButton('Delete')).toBeTruthy();
    for (const name of ['Import', 'Export']) expect(within(header()).queryByRole('button', { name })).toBeNull();
    expect(await openMenu()).toEqual(['Duplicate', 'Rename', 'Reset', 'Delete']);
  });

  it('duplicates the preset as "<name> (copy)" and selects it', async () => {
    seed(['Mine']);
    openImageEndpoints();
    fireEvent.click(rowButton('Duplicate'));
    const select = within(header()).getByRole('combobox', { name: 'Preset' });
    await waitFor(() => expect(select.textContent).toBe('Mine (copy)'));
    expect(storedStore().presets.map((p) => p.name)).toEqual(['Mine', 'Mine (copy)']);
  });

  it('confirms Delete before it deletes the preset', async () => {
    seed(['Mine', 'Other']);
    openImageEndpoints();
    fireEvent.click(rowButton('Delete'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Mine');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(storedStore().presets.map((p) => p.name)).toEqual(['Other']));
  });

  it('hides Delete once deleting leaves one preset', async () => {
    seed(['Mine', 'Other']);
    openImageEndpoints();
    fireEvent.click(rowButton('Delete'));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(within(header()).queryByRole('button', { name: 'Delete' })).toBeNull());
  });

  it('confirms Reset before it clears the preset overrides', async () => {
    const store: ImageEndpointPresetStore = {
      activeId: 'p0',
      presets: [{ id: 'p0', name: 'Mine', overrides: { model: 'custom-model' } }],
    };
    localStorage.setItem(IMAGE_KEY, imageEndpointPresetCodec.serialize(store));
    openImageEndpoints();
    fireEvent.click(rowButton('Reset'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Mine');
    expect(storedStore().presets[0].overrides).toEqual({ model: 'custom-model' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(storedStore().presets[0].overrides).toEqual({}));
  });

  it('lists the presets, then "Add New Preset…" as the last row', async () => {
    seed(['Mine', 'Other']);
    openImageEndpoints();
    // A Radix select opens on the full pointer sequence, which fireEvent does not send.
    await userEvent.click(within(header()).getByRole('combobox', { name: 'Preset' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Mine', 'Other', 'Add New Preset…']);
  });

  it('opens the rename dialog on the active preset', async () => {
    seed(['Mine']);
    openImageEndpoints();
    fireEvent.click(rowButton('Rename'));
    expect(await screen.findByRole('dialog', { name: 'Rename Preset' })).toBeTruthy();
  });
});
