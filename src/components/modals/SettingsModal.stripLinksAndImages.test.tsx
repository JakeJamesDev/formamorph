// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SETTINGS_COPY } from './settingsCopy';

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const open = (mode: 'simple' | 'advanced') => render(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode={mode} initialTab="display" />
    </SettingsProvider>
  </ThemeProvider>,
);

const toggle = () => screen.queryByRole('checkbox', { name: SETTINGS_COPY.stripLinksAndImages.label });

describe('the Strip Links And Images row', () => {
  beforeEach(() => localStorage.clear());

  it('starts on, and turning it off persists', async () => {
    open('advanced');
    expect(toggle()!.getAttribute('data-state')).toBe('checked');
    fireEvent.click(toggle()!);
    await waitFor(() => expect(localStorage.getItem('FORMAMORPH_stripLinksAndImages')).toBe('false'));
    expect(toggle()!.getAttribute('data-state')).toBe('unchecked');
  });

  it('is hidden in Simple mode', () => {
    open('simple');
    expect(toggle()).toBeNull();
  });
});
