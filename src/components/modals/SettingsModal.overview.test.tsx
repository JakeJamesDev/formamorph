// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { OVERVIEW_LABEL } from '@/lib/promptGroups';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const PROMPTS_KEY = 'FORMAMORPH_promptPresets';
const stored = () => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!).presets.find((p) => p.id === 'mine');

function seed(activeId: string) {
  const store: PromptPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown' }],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

const openPrompts = (initialPromptTab?: string) =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab={initialPromptTab} />
      </SettingsProvider>
    </ThemeProvider>,
  );

/** The rail's row buttons, in order. */
const railButtons = () => within(screen.getByRole('navigation', { name: 'Prompts' })).getAllByRole('button');

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('Settings → Prompts: preset Overview', () => {
  it('a built-in preset has no Overview entry', () => {
    seed('default');
    openPrompts();
    expect(screen.queryByRole('button', { name: OVERVIEW_LABEL })).toBeNull();
  });

  it('a built-in preset routed to the Overview lands on a prompt instead', () => {
    seed('default');
    openPrompts('overview');
    expect(screen.queryByLabelText('Author')).toBeNull();
    expect(screen.getByText(/Writes the story itself/)).toBeTruthy();
  });

  it('a user preset lists the Overview first in the rail', () => {
    seed('mine');
    openPrompts();
    expect(railButtons()[0].textContent).toBe(OVERVIEW_LABEL);
  });

  it('opens the fields in order and writes each through to the stored preset', () => {
    seed('mine');
    openPrompts();
    fireEvent.click(screen.getByRole('button', { name: OVERVIEW_LABEL }));

    const labels = screen.getAllByText(/^(Author|Description|Tags|Models)$/).map((n) => n.textContent);
    expect(labels).toEqual(['Author', 'Description', 'Tags', 'Models']);

    fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'Ann' } });
    expect(stored()?.overview?.author).toBe('Ann');

    const tags = screen.getByLabelText('Tags');
    fireEvent.change(tags, { target: { value: 'Slow Burn' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    expect(stored()?.overview?.tags).toEqual(['slow burn']);

    const models = screen.getByLabelText('Models');
    fireEvent.change(models, { target: { value: 'Cydonia-24B' } });
    fireEvent.keyDown(models, { key: 'Enter' });
    expect(stored()?.overview?.models).toEqual(['Cydonia-24B']);
  });

  // Below md the rail becomes one dropdown. Radix opens a Select from the keyboard; jsdom has no pointer capture.
  const openPromptDropdown = () => {
    const trigger = screen.getAllByRole('combobox').find((c) => /Anatomy|Overview/.test(c.textContent ?? ''))!;
    fireEvent.keyDown(trigger, { key: 'Enter' });
  };

  it('the mobile prompt dropdown lists the Overview first for a user preset', () => {
    seed('mine');
    openPrompts();
    openPromptDropdown();
    expect(screen.getAllByRole('option')[0].textContent).toBe(OVERVIEW_LABEL);
  });

  it('the mobile prompt dropdown has no Overview for a built-in preset', () => {
    seed('default');
    openPrompts();
    openPromptDropdown();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    expect(screen.queryByRole('option', { name: OVERVIEW_LABEL })).toBeNull();
  });

  it('picking a prompt leaves the Overview', () => {
    seed('mine');
    openPrompts('overview');
    expect(screen.getByLabelText('Author')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Narration' }).at(-1)!);
    expect(screen.queryByLabelText('Author')).toBeNull();
  });
});
