// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { presetStoreCodec, type PromptPresetStore, type PromptValues } from '@/lib/promptPresets';

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

describe('Settings → Prompts: preset header overflow menu', () => {
  it('lists Rename, Export, then Reset and Delete for a user preset', async () => {
    seed('mine');
    openPrompts();
    expect(await openMenu()).toEqual(['Rename', 'Export', '---', 'Reset', 'Delete']);
  });

  it('lists Export only for a built-in preset', async () => {
    seed('default');
    openPrompts();
    expect(await openMenu()).toEqual(['Export']);
  });

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
    ['Export', 'Export “Mine”'],
  ])('opens the %s dialog from the menu', async (item, title) => {
    seed('mine');
    openPrompts();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
    expect(await screen.findByRole('dialog', { name: title })).toBeTruthy();
  });

  const cancelConfirm = async () => {
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  };

  it('returns focus to the desktop Reset button when its confirm is canceled', async () => {
    seed('mine');
    openPrompts();
    const reset = within(screen.getByTestId('preset-header-row')).getByRole('button', { name: 'Reset' });
    // A browser focuses a clicked button; jsdom does not.
    reset.focus();
    fireEvent.click(reset);
    await cancelConfirm();
    await waitFor(() => expect(document.activeElement).toBe(reset));
  });

  it('returns focus to the ⋯ button when a confirm opened from the menu is canceled', async () => {
    seed('mine');
    openPrompts();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset' }));
    await cancelConfirm();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Preset Actions' })));
  });

  it('keeps the desktop row: Delete, Reset, the selector, Rename, Export', () => {
    seed('mine');
    openPrompts();
    const row = screen.getByTestId('preset-header-row');
    // Both widths render in jsdom; CSS hides the ⋯ button at md and the row buttons below it.
    const names = Array.from(row.querySelectorAll('button'))
      .filter((n) => n.getAttribute('aria-label') !== 'Preset Actions')
      .map((n) => (n.getAttribute('role') === 'combobox' ? 'selector' : n.textContent));
    expect(names).toEqual(['Delete', 'Reset', 'selector', 'Rename', 'Export']);
  });
});
