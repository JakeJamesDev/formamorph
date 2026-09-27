// Storage is real (in-memory): the live settings seed the source, and the tests read what persists.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { DisplaySettingsSection } from './DisplaySettingsSection';
import { OutputSettingsSection } from './OutputSettingsSection';
import type { SettingsSource } from './settingsSource';
import type { EmbeddingDownload } from './useEmbeddingDownload';
import type { SettingsMode } from '@/lib/settingsMode';
import { loadEmbeddingModel, disposeEmbeddingModel } from '@/lib/embeddingWorkerClient';

/**
 * The seam is the source: each test builds it from the live settings, overrides the members under test
 * with spies, and checks the section reached the spy and nothing behind it.
 */

vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: vi.fn(() => Promise.resolve()),
  disposeEmbeddingModel: vi.fn(),
}));

const idleDownload = (): EmbeddingDownload => ({
  loading: false, progress: null, error: null, start: vi.fn(), dispose: vi.fn(),
});

type Overrides = Partial<SettingsSource>;

function Harness({ section, mode, overrides }: { section: 'display' | 'output'; mode: SettingsMode; overrides: Overrides }) {
  const source: SettingsSource = { ...useSettings(), ...useTheme(), embeddingModel: idleDownload(), ...overrides };
  return section === 'display'
    ? <DisplaySettingsSection source={source} mode={mode} />
    : <OutputSettingsSection source={source} mode={mode} nativeReasoningRuledOut={false} />;
}

const mount = (section: 'display' | 'output', overrides: Overrides = {}, mode: SettingsMode = 'advanced') => render(
  <ThemeProvider>
    <SettingsProvider>
      <Harness section={section} mode={mode} overrides={overrides} />
    </SettingsProvider>
  </ThemeProvider>,
);

beforeEach(() => {
  localStorage.clear();
  vi.mocked(loadEmbeddingModel).mockClear();
  vi.mocked(disposeEmbeddingModel).mockClear();
});
afterEach(() => document.documentElement.classList.remove('light', 'dark'));

describe('Display section', () => {
  it('sets the theme through the source and stores nothing', async () => {
    const user = userEvent.setup();
    const setTheme = vi.fn();
    mount('display', { setTheme });
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
    expect(localStorage.getItem('vite-ui-theme')).toBeNull();
  });

  it('saves a font tuning through the source', async () => {
    const user = userEvent.setup();
    const setFontTuning = vi.fn();
    mount('display', { setFontTuning });
    await user.click(screen.getAllByRole('button', { name: /customize/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(setFontTuning).toHaveBeenCalledTimes(1);
  });

  it('edits the reveal animation through the source', async () => {
    const user = userEvent.setup();
    const setRevealFade = vi.fn();
    mount('display', { setRevealFade, revealFade: true });
    await user.click(screen.getByRole('button', { name: /choose reveal animation/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(dialog.querySelector('label button[role="checkbox"]') as HTMLElement);
    expect(setRevealFade).toHaveBeenCalledWith(false);
  });

  it('seeds the theme preview from the source theme', async () => {
    const user = userEvent.setup();
    mount('display', { resolvedTheme: 'dark' });
    await user.click(screen.getByRole('button', { name: /preview theme/i }));
    expect(await screen.findByText(/Seeded from your current theme \(dark\)/)).toBeTruthy();
  });

  it('labels the quote color for the source mode', () => {
    mount('display', { quoteColor: true, quoteColorMode: 'dark' });
    expect(screen.getByRole('button', { name: /Dark Mode Color/ })).toBeTruthy();
  });

  it('shows the Advanced rows only in Advanced', () => {
    const { unmount } = mount('display', {}, 'simple');
    expect(screen.queryByRole('checkbox', { name: 'Markdown Formatting' })).toBeNull();
    unmount();
    mount('display', {}, 'advanced');
    expect(screen.getByRole('checkbox', { name: 'Markdown Formatting' })).toBeTruthy();
  });
});

describe('Output section', () => {
  it('loads and disposes the embedding model through the source only', async () => {
    const user = userEvent.setup();
    const embeddingModel = idleDownload();
    mount('output', { embeddingModel, memoryDigests: true, semanticMemory: false, semanticLore: false });
    await user.click(screen.getByRole('checkbox', { name: 'Semantic Lore' }));
    expect(embeddingModel.start).toHaveBeenCalledTimes(1);
    expect(loadEmbeddingModel).not.toHaveBeenCalled();
  });

  it('disposes through the source when the last semantic feature turns off', async () => {
    const user = userEvent.setup();
    const embeddingModel = idleDownload();
    mount('output', { embeddingModel, memoryDigests: true, semanticMemory: false, semanticLore: true });
    await user.click(screen.getByRole('checkbox', { name: 'Semantic Lore' }));
    expect(embeddingModel.dispose).toHaveBeenCalledTimes(1);
    expect(disposeEmbeddingModel).not.toHaveBeenCalled();
  });

  it('shows the download state the source reports and retries through it', async () => {
    const user = userEvent.setup();
    const embeddingModel = { ...idleDownload(), error: 'offline' };
    mount('output', { embeddingModel, semanticLore: true });
    expect(screen.getByText('Model download failed: offline')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(embeddingModel.start).toHaveBeenCalledTimes(1));
  });

  it('shows the Advanced sections only in Advanced', () => {
    const { unmount } = mount('output', {}, 'simple');
    expect(screen.queryByText('Memory')).toBeNull();
    unmount();
    mount('output', {}, 'advanced');
    expect(screen.getByText('Memory')).toBeTruthy();
  });
});
