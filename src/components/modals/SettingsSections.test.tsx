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

function Harness({ section, mode, overrides, ruledOut = false }: {
  section: 'display' | 'output'; mode: SettingsMode; overrides: Overrides; ruledOut?: boolean;
}) {
  const source: SettingsSource = { ...useSettings(), ...useTheme(), embeddingModel: idleDownload(), ...overrides };
  return section === 'display'
    ? <DisplaySettingsSection source={source} mode={mode} />
    : <OutputSettingsSection source={source} mode={mode} nativeReasoningRuledOut={ruledOut} />;
}

const mount = (section: 'display' | 'output', overrides: Overrides = {}, mode: SettingsMode = 'advanced', ruledOut = false) => render(
  <ThemeProvider>
    <SettingsProvider>
      <Harness section={section} mode={mode} overrides={overrides} ruledOut={ruledOut} />
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

describe('Recheck on the capability rows', () => {
  /** A record that rules out reasoning and Tools, so both rows are muted. */
  const MUTED = {
    reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, tools: false, structuredOutput: null,
    sources: { reasons: 'probe', levels: 'probe', tools: 'probe' },
  } as const;

  it('puts Recheck on both muted rows, rechecking through the source', async () => {
    const user = userEvent.setup();
    const recheckCapability = vi.fn(() => Promise.resolve());
    mount('output', { reasoningCapability: MUTED, recheckCapability, capabilityModelName: null }, 'advanced', true);
    const buttons = screen.getAllByRole('button', { name: 'Recheck' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(recheckCapability).toHaveBeenCalledTimes(1);
  });

  it('puts Recheck and the model line on both rows where they hold a control', async () => {
    const user = userEvent.setup();
    const recheckCapability = vi.fn(() => Promise.resolve());
    const supported = { ...MUTED, reasons: true, levels: null, tools: true };
    mount('output', { reasoningCapability: supported, recheckCapability, capabilityModelName: 'g4-26b' });
    expect(screen.getByRole('checkbox', { name: 'Tools' })).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Recheck' });
    expect(buttons).toHaveLength(2);
    expect(screen.getAllByText('Checked for g4-26b')).toHaveLength(2);
    await user.click(buttons[1]);
    expect(recheckCapability).toHaveBeenCalledTimes(1);
  });

  it('puts Recheck on a row locked on because the model always reasons', () => {
    const alwaysOn = { ...MUTED, reasons: true, levels: null, offAllowed: false, tools: false };
    mount('output', { reasoningCapability: alwaysOn, recheckCapability: vi.fn(), capabilityModelName: null });
    expect(screen.getByText(/always reasons/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Recheck' })).toHaveLength(2);
  });

  it('shows the busy state while a recheck runs, and returns when it ends', async () => {
    const user = userEvent.setup();
    let finish = () => {};
    const recheckCapability = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    mount('output', { reasoningCapability: MUTED, recheckCapability, capabilityModelName: null }, 'advanced', true);
    await user.click(screen.getAllByRole('button', { name: 'Recheck' })[1]);
    const busy = screen.getByRole('button', { name: 'Checking…' });
    expect(busy.hasAttribute('disabled')).toBe(true);
    finish();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Recheck' })).toHaveLength(2));
  });

  it('names the model the answer is for, only where the server named one', () => {
    const named = mount('output', { reasoningCapability: MUTED, recheckCapability: vi.fn(), capabilityModelName: 'g4-meromero-26b-a4b' }, 'advanced', true);
    expect(screen.getAllByText('Checked for g4-meromero-26b-a4b')).toHaveLength(2);
    named.unmount();
    mount('output', { reasoningCapability: MUTED, recheckCapability: vi.fn(), capabilityModelName: null }, 'advanced', true);
    expect(screen.queryByText(/Checked for/)).toBeNull();
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

  it('sets Time Per Turn in hours, and holds a blank amount back', async () => {
    const user = userEvent.setup();
    const setFixedTurnHours = vi.fn();
    mount('output', { aiClock: false, fixedTurnHours: 1, setFixedTurnHours });
    const amount = screen.getByRole('spinbutton', { name: 'Time Per Turn' });
    await user.clear(amount);
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(setFixedTurnHours).not.toHaveBeenCalled();
    await user.type(amount, '3');
    expect(setFixedTurnHours).toHaveBeenLastCalledWith(3);
  });

  it('shows a Time Per Turn that changes elsewhere', () => {
    const tree = (fixedTurnHours: number) => (
      <ThemeProvider>
        <SettingsProvider>
          <Harness section="output" mode="advanced" overrides={{ aiClock: false, fixedTurnHours }} />
        </SettingsProvider>
      </ThemeProvider>
    );
    const { rerender } = render(tree(1));
    rerender(tree(48));
    expect((screen.getByRole('spinbutton', { name: 'Time Per Turn' }) as HTMLInputElement).value).toBe('2');
    expect(screen.getByRole('combobox', { name: 'Time Unit' }).textContent).toBe('Days');
  });

  it('shows the Advanced sections only in Advanced', () => {
    const { unmount } = mount('output', {}, 'simple');
    expect(screen.queryByText('Memory')).toBeNull();
    unmount();
    mount('output', {}, 'advanced');
    expect(screen.getByText('Memory')).toBeTruthy();
  });
});
