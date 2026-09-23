// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import type { SettingsMode } from '@/lib/settingsMode';

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** The main menu hands Settings a way to start the tour. A running game does not. */
const openData = (mode: SettingsMode, onStartAuthoringTour?: () => void) => render(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal
        isOpen
        onOpenChange={() => {}}
        forcedMode={mode}
        initialTab="data"
        onStartAuthoringTour={onStartAuthoringTour}
      />
    </SettingsProvider>
  </ThemeProvider>,
);

const startButton = () => screen.queryByRole('button', { name: 'Start Authoring Tour' });

beforeEach(() => localStorage.clear());

describe('Start Authoring Tour in Settings', () => {
  it.each<SettingsMode>(['simple', 'advanced'])('shows on the Data tab in %s mode and starts the tour', (mode) => {
    const start = vi.fn();
    openData(mode, start);
    fireEvent.click(startButton()!);
    expect(start).toHaveBeenCalledOnce();
  });

  it.each<SettingsMode>(['simple', 'advanced'])('is hidden during a game in %s mode', (mode) => {
    openData(mode);
    // The Data tab is on screen, so the row's absence is not a tab that failed to open.
    expect(screen.getByText('Autosave')).toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
  });
});
