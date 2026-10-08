// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import type { SettingsMode } from '@/lib/settingsMode';

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** Reads the preference the World Editor reads, so a change made in the modal shows where the editor sees it. */
const EditorPreference = () => {
  const { editorAutoSave, editorAutoSaveIdleSeconds } = useSettings();
  return <output aria-label="Editor preference">{`${editorAutoSave} ${editorAutoSaveIdleSeconds}`}</output>;
};

const openData = (mode: SettingsMode = 'simple', onStartAuthoringTour?: () => void) => render(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal
        isOpen
        onOpenChange={() => {}}
        forcedMode={mode}
        initialTab="data"
        onStartAuthoringTour={onStartAuthoringTour}
      />
      <EditorPreference />
    </SettingsProvider>
  </ThemeProvider>,
);

const toggle = () => screen.getByRole('checkbox', { name: 'Auto Save' });
const slider = () => screen.queryByRole('slider');
const preference = () => screen.getByLabelText('Editor preference').textContent;

beforeEach(() => localStorage.clear());

describe('Auto Save in Settings', () => {
  it.each<SettingsMode>(['simple', 'advanced'])('shows the toggle and the pause beside Authoring Tour in %s mode', (mode) => {
    openData(mode, () => {});
    expect(toggle()).toBeChecked();
    expect(slider()).toHaveAttribute('aria-valuemin', '10');
    expect(slider()).toHaveAttribute('aria-valuemax', '300');
    expect(slider()).toHaveAttribute('aria-valuenow', '30');
    expect(screen.getByText('30 s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Authoring Tour' })).toBeInTheDocument();
  });

  it('shows the rows during a game, where no tour starts', () => {
    openData();
    expect(toggle()).toBeInTheDocument();
    expect(slider()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Authoring Tour' })).not.toBeInTheDocument();
  });

  it('hides the pause while Auto Save is off and brings it back on', () => {
    openData();
    fireEvent.click(toggle());
    expect(toggle()).not.toBeChecked();
    expect(slider()).not.toBeInTheDocument();
    fireEvent.click(toggle());
    expect(slider()).toBeInTheDocument();
  });

  it('is one preference with what the editor reads', () => {
    openData();
    expect(preference()).toBe('true 30');
    fireEvent.click(toggle());
    expect(preference()).toBe('false 30');
  });

  it('keeps the chosen pause through an off and on', () => {
    localStorage.setItem('FORMAMORPH_editorAutoSaveIdleSeconds', '120');
    openData();
    expect(screen.getByText('2 min')).toBeInTheDocument();
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(preference()).toBe('true 120');
  });

  it('sets the pause from the slider and stores it', () => {
    openData();
    fireEvent.keyDown(slider()!, { key: 'End' });
    expect(preference()).toBe('true 300');
    expect(localStorage.getItem('FORMAMORPH_editorAutoSaveIdleSeconds')).toBe('300');
    fireEvent.keyDown(slider()!, { key: 'Home' });
    expect(preference()).toBe('true 10');
  });

  it.each([['5', '10'], ['9999', '300'], ['junk', '30']])('reads a stored %s s as %s', (stored, shown) => {
    localStorage.setItem('FORMAMORPH_editorAutoSaveIdleSeconds', stored);
    openData();
    expect(preference()).toBe(`true ${shown}`);
  });
});
