// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { presetStoreCodec, type PromptPresetStore, type PromptValues } from '@/lib/promptPresets';
import AuthService from '@/services/AuthService';
import WorldStorageService from '@/services/WorldStorageService';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const PROMPTS_KEY = 'FORMAMORPH_promptPresets';
const storedStore = () => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!);

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    // One prompt value is enough to tell a reset from a no-op.
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as unknown as PromptValues, style: 'markdown' }],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

const openPrompts = () =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" />
      </SettingsProvider>
    </ThemeProvider>,
  );

/** Opens the narrow header's overflow menu and returns its items, separators included, in order. */
async function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Preset Actions' }));
  const menu = await screen.findByRole('menu');
  return Array.from(menu.querySelectorAll('[role="menuitem"], [role="separator"]'))
    .map((n) => (n.getAttribute('role') === 'separator' ? '---' : n.textContent));
}

/** A desktop header icon, named by its tooltip. */
const rowButton = (name: string) => within(screen.getByTestId('preset-header-row')).getByRole('button', { name });

const confirmIn = async (title: string) => {
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain(title);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
};

beforeEach(() => {
  localStorage.clear();
  // jsdom has no matchMedia; the theme provider reads it on mount.
  window.matchMedia =((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

// Order, menu contents, the built-in subset and focus return live in PresetHeader.test.tsx.
describe('Settings → Prompts: preset header', () => {
  it('closes the menu, then confirms Delete before it deletes', async () => {
    seed('mine');
    openPrompts();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('menu')).toBeNull();
    await confirmIn('Delete Preset');
    expect(storedStore().presets.some((p) => p.id === 'mine')).toBe(false);
  });

  it('confirms Reset before it resets the prompts', async () => {
    seed('mine');
    openPrompts();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset' }));
    await confirmIn('Reset Preset');
    expect(storedStore().presets.find((p) => p.id === 'mine')?.values.systemPrompt).not.toBe('A');
  });

  it.each([
    ['Rename', 'Rename Preset'],
    ['Import', 'Import Preset'],
    ['Export', 'Export “Mine”'],
  ])('opens the %s dialog from the menu', async (item, title) => {
    seed('mine');
    openPrompts();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
    expect(await screen.findByRole('dialog', { name: title })).toBeTruthy();
  });

  it('duplicates a built-in preset as an editable copy and selects it', async () => {
    seed('default');
    openPrompts();
    fireEvent.click(rowButton('Duplicate'));
    const select = within(screen.getByTestId('preset-header-row')).getByRole('combobox', { name: 'Preset' });
    await waitFor(() => expect(select.textContent).toBe('Default (copy)'));
    // An editable copy offers the actions a built-in lacks.
    expect(rowButton('Rename')).toBeTruthy();
  });

  it('lists presets and "Add New Preset…" in the select, with no import row', async () => {
    seed('mine');
    openPrompts();
    // A Radix select opens on the full pointer sequence, which fireEvent does not send.
    await userEvent.click(within(screen.getByTestId('preset-header-row')).getByRole('combobox', { name: 'Preset' }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toContain('Mine');
    expect(options.at(-1)).toBe('Add New Preset…');
    expect(options).not.toContain('Import Preset…');
  });
});

describe('Settings → Prompts: Publish', () => {
  const signIn = () => vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(WorldStorageService, 'getUserWorlds').mockResolvedValue([]);
  });

  it('offers Publish on a user preset once signed in', async () => {
    signIn();
    seed('mine');
    openPrompts();
    expect(rowButton('Publish')).toBeTruthy();
    expect(await openMenu()).toContain('Publish');
  });

  it('blocks publish while Models is empty and leads to the Overview', async () => {
    signIn();
    seed('mine');
    openPrompts();
    fireEvent.click(rowButton('Publish'));

    const block = await screen.findByRole('alertdialog');
    expect(block.textContent).toContain('Models');
    expect(screen.queryByRole('dialog', { name: 'Publish Prompt' })).toBeNull();
    fireEvent.click(within(block).getByRole('button', { name: 'Open Overview' }));

    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Models'));
  });

  it('opens the publish dialog once Models names a model', async () => {
    signIn();
    const store: PromptPresetStore = {
      activeId: 'mine',
      presets: [{
        id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as unknown as PromptValues, style: 'markdown',
        overview: { author: '', description: '', tags: [], models: ['Cydonia-24B'] },
      }],
    };
    localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
    openPrompts();
    fireEvent.click(rowButton('Publish'));

    expect(await screen.findByRole('dialog', { name: 'Publish Prompt' })).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
