// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { PROMPT_LABELS, SURFACE_LABELS } from '@/lib/promptGroups';
import { SETTINGS_COPY } from './settingsCopy';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const Ui = ({ promptTab }: { promptTab: string }) => (
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab={promptTab} />
    </SettingsProvider>
  </ThemeProvider>
);

const openOptions = (promptTab: string) => {
  const view = render(<Ui promptTab={promptTab} />);
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
  return view;
};

const switchTo = (tab: keyof typeof PROMPT_LABELS) => {
  fireEvent.click(screen.getAllByRole('button', { name: PROMPT_LABELS[tab] }).at(-1)!);
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
};

const makeEditable = () => fireEvent.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));
const toggle = () => screen.queryByRole('checkbox', { name: SETTINGS_COPY.promptAttachments.label });
const state = () => toggle()!.getAttribute('data-state');

describe('the Include Attachments toggle on a prompt’s Options', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
  });

  it('is hidden while Image Attachments is off', () => {
    openOptions('narration');
    expect(toggle()).toBeNull();
  });

  describe('with Image Attachments on', () => {
    beforeEach(() => localStorage.setItem('FORMAMORPH_imageAttachments', 'true'));

    it('reads on for Narration and off for every other prompt', () => {
      openOptions('narration');
      expect(state()).toBe('checked');
      switchTo('director');
      expect(state()).toBe('unchecked');
      switchTo('statupdates');
      expect(state()).toBe('unchecked');
    });

    it('is read-only under a built-in preset', () => {
      openOptions('narration');
      expect(toggle()!.hasAttribute('disabled')).toBe(true);
    });

    it('sets one prompt without moving another', () => {
      openOptions('director');
      makeEditable();
      fireEvent.click(toggle()!);
      expect(state()).toBe('checked');
      switchTo('narration');
      expect(state()).toBe('checked');
      fireEvent.click(toggle()!);
      expect(state()).toBe('unchecked');
      switchTo('director');
      expect(state()).toBe('checked');
    });

    it('keeps its stored flags when the setting goes off and on again', () => {
      const view = openOptions('director');
      makeEditable();
      fireEvent.click(toggle()!);
      view.unmount();

      localStorage.setItem('FORMAMORPH_imageAttachments', 'false');
      const off = openOptions('director');
      expect(toggle()).toBeNull();
      off.unmount();

      localStorage.setItem('FORMAMORPH_imageAttachments', 'true');
      openOptions('director');
      expect(state()).toBe('checked');
    });
  });
});
