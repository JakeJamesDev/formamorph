// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { settingsTabsFor } from './settingsTabs';
import { readSettingsMode } from '@/lib/settingsMode';
import type { SettingsMode } from '@/lib/settingsMode';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const openSettings = (mode: SettingsMode) => render(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode={mode} />
    </SettingsProvider>
  </ThemeProvider>,
);

/** Opens on a named tab with no mode forced, as the dev-router does. */
const openSettingsOnTab = (initialTab: string) => render(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} initialTab={initialTab} />
    </SettingsProvider>
  </ThemeProvider>,
);

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

beforeEach(() => localStorage.clear());

describe('settings mode', () => {
  it('defaults to Simple on first run and remembers Advanced', () => {
    expect(readSettingsMode()).toBe('simple');
    localStorage.setItem('formamorph.settingsMode', 'advanced');
    expect(readSettingsMode()).toBe('advanced');
  });

  it('reads anything but the literal advanced value as Simple', () => {
    localStorage.setItem('formamorph.settingsMode', 'ADVANCED');
    expect(readSettingsMode()).toBe('simple');
    localStorage.setItem('formamorph.settingsMode', '{"mode":"advanced"}');
    expect(readSettingsMode()).toBe('simple');
  });

  it('drops Prompts from the tab list in Simple only', () => {
    expect(settingsTabsFor(false).map((t) => t.value))
      .toEqual(['presentation', 'generation', 'endpoints', 'accessibility']);
    expect(settingsTabsFor(true).map((t) => t.value)).toContain('prompts');
  });

  it('hides the Prompts tab in Simple and shows it in Advanced', () => {
    const { unmount } = openSettings('simple');
    expect(tabNames()).not.toContain('Prompts');
    expect(tabNames()).toContain('Accessibility');
    unmount();
    openSettings('advanced');
    expect(tabNames()).toContain('Prompts');
  });

  // The tab strip becomes a dropdown below sm, and it is a second renderer of the same list.
  it('omits hidden tabs from the small-screen tab dropdown too', () => {
    // Radix opens a Select from the keyboard; a click needs pointer capture, which jsdom has not got.
    const openTabDropdown = () => fireEvent.keyDown(screen.getAllByRole('combobox')[0], { key: 'Enter' });
    const { unmount } = openSettings('simple');
    openTabDropdown();
    expect(screen.queryByRole('option', { name: 'Prompts' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Accessibility' })).toBeTruthy();
    unmount();

    openSettings('advanced');
    openTabDropdown();
    expect(screen.getByRole('option', { name: 'Prompts' })).toBeTruthy();
  });

  // Asking for a tab Simple hides is asking for Advanced — the dev-router must land where it said.
  it('opens in Advanced when the route names an advanced-only tab', () => {
    openSettingsOnTab('prompts');
    expect(tabNames()).toContain('Prompts');
    expect(screen.getByRole('tab', { name: 'Prompts', selected: true })).toBeTruthy();
  });

  it('hides Paragraph Limit and Markdown Formatting on Presentation in Simple only', () => {
    const { unmount } = openSettings('simple');
    expect(screen.queryByText('Paragraph Limit')).toBeNull();
    expect(screen.queryByText('Markdown Formatting')).toBeNull();
    // The everyday presentation rows stay.
    expect(screen.getByText('Theme Color')).toBeTruthy();
    expect(screen.getByText('AI Language')).toBeTruthy();
    unmount();
    openSettings('advanced');
    expect(screen.getByText('Paragraph Limit')).toBeTruthy();
    expect(screen.getByText('Markdown Formatting')).toBeTruthy();
  });

  it('hides the Memory, Performance and Inspection sections on Generation in Simple only', async () => {
    const user = userEvent.setup();
    const { unmount } = openSettings('simple');
    await user.click(screen.getByRole('tab', { name: 'Generation' }));
    expect(screen.queryByText('Memory Summaries')).toBeNull();
    expect(screen.queryByText('Concurrent Requests')).toBeNull();
    expect(screen.queryByText('Show Reasoning')).toBeNull();
    // The core shape of a turn stays reachable.
    expect(screen.getByText('Thinking')).toBeTruthy();
    expect(screen.getByText('Choices')).toBeTruthy();
    unmount();

    openSettings('advanced');
    await user.click(screen.getByRole('tab', { name: 'Generation' }));
    expect(screen.getByText('Memory Summaries')).toBeTruthy();
    expect(screen.getByText('Concurrent Requests')).toBeTruthy();
    expect(screen.getByText('Show Reasoning')).toBeTruthy();
  });

  it('hides Context Window and Max Output Tokens on the text endpoint in Simple only', async () => {
    const user = userEvent.setup();
    const { unmount } = openSettings('simple');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    expect(screen.queryByText('Context Window (tokens)')).toBeNull();
    expect(screen.queryByText('Max Output Tokens')).toBeNull();
    // Connecting a model is everyday work, so the fields that do it stay.
    expect(screen.getByText('Endpoint URL')).toBeTruthy();
    expect(screen.getByText('Model Name')).toBeTruthy();
    expect(screen.getByText('Reset AI Endpoint')).toBeTruthy();
    unmount();

    openSettings('advanced');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    expect(screen.getByText('Context Window (tokens)')).toBeTruthy();
    expect(screen.getByText('Max Output Tokens')).toBeTruthy();
  });

  it('hides the Tag Prompt sub-tab in Simple only', async () => {
    const user = userEvent.setup();
    const { unmount } = openSettings('simple');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    expect(tabNames()).not.toContain('Tag Prompt');
    expect(tabNames()).toContain('Image');
    unmount();

    openSettings('advanced');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    expect(tabNames()).toContain('Tag Prompt');
  });

  it('hides the image sizes on the image endpoint in Simple only', async () => {
    const user = userEvent.setup();
    const { unmount } = openSettings('simple');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    await user.click(screen.getByRole('tab', { name: 'Image' }));
    expect(screen.queryByText('Portrait (W × H)')).toBeNull();
    expect(screen.queryByText('Landscape (W × H)')).toBeNull();
    // Everyday image tweaking stays.
    expect(screen.getByText('Prompt Prefix')).toBeTruthy();
    expect(screen.getByText('Steps / CFG')).toBeTruthy();
    unmount();

    openSettings('advanced');
    await user.click(screen.getByRole('tab', { name: 'AI Endpoints' }));
    await user.click(screen.getByRole('tab', { name: 'Image' }));
    expect(screen.getByText('Portrait (W × H)')).toBeTruthy();
    expect(screen.getByText('Landscape (W × H)')).toBeTruthy();
  });

  it('marks the Advanced switch only while Simple is hiding a non-default value', () => {
    const { unmount } = openSettings('simple');
    expect(screen.queryByLabelText('Hidden settings are off their defaults')).toBeNull();
    unmount();

    // Markdown Formatting is a hidden row, and off is not its default.
    localStorage.setItem('FORMAMORPH_markdownOutput', 'false');
    const second = openSettings('simple');
    expect(screen.getByLabelText('Hidden settings are off their defaults')).toBeTruthy();
    second.unmount();

    // Advanced hides nothing, so it has nothing to report.
    openSettings('advanced');
    expect(screen.queryByLabelText('Hidden settings are off their defaults')).toBeNull();
  });

  it('keeps every reading option on Accessibility in Simple, and hides only its housekeeping buttons', async () => {
    const user = userEvent.setup();
    const { unmount } = openSettings('simple');
    await user.click(screen.getByRole('tab', { name: 'Accessibility' }));
    const simpleRows = screen.getAllByRole('checkbox').length + screen.getAllByRole('combobox').length;
    expect(screen.queryByRole('button', { name: 'Restore Default Worlds' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Cached Images' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset Tutorials' })).toBeNull();
    // Autosave is a setting, not a put-it-back, so it stays.
    expect(screen.getByText('Autosave')).toBeTruthy();
    unmount();

    openSettings('advanced');
    await user.click(screen.getByRole('tab', { name: 'Accessibility' }));
    // Every reading and choice option Advanced has, Simple has too.
    expect(screen.getAllByRole('checkbox').length + screen.getAllByRole('combobox').length).toBe(simpleRows);
    expect(screen.getByRole('button', { name: 'Restore Default Worlds' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear Cached Images' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Tutorials' })).toBeTruthy();
  });
});
