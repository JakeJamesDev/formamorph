// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { surfaceRegistry } from '@/lib/surface/surfaceRegistry';
import { renderReporting } from '@/test/surfaceReporter';
import { SettingsModal } from './SettingsModal';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

afterEach(cleanup);

const open = (props: Partial<Parameters<typeof SettingsModal>[0]>) => renderReporting(
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" {...props} />
    </SettingsProvider>
  </ThemeProvider>,
);

// These levels have no shared strip that reports them, so the dialog names each by hand.
describe('what Settings reports as open', () => {
  it('names the Endpoints tab by its surface id, not by its own tab value', async () => {
    open({ initialTab: 'endpoints' });
    expect(surfaceRegistry.get()).toEqual({
      screen: null,
      dialog: 'settings',
      tabs: ['settings.endpoints', 'settingsEndpoints.text'],
    });
    await userEvent.click(screen.getByRole('tab', { name: 'Image' }));
    expect(surfaceRegistry.get().tabs).toEqual(['settings.endpoints', 'settingsEndpoints.image']);
  });

  it('names the open prompt and its surface, with the hub as Anatomy', () => {
    open({ initialTab: 'prompts', initialPromptTab: 'choices' });
    expect(surfaceRegistry.get().tabs).toEqual([
      'settings.prompts', 'settingsPrompts.choices', 'settingsPromptSurfaces.anatomy',
    ]);
  });

  it('names an open prompt surface', () => {
    open({ initialTab: 'prompts', initialPromptTab: 'narration', initialPromptSurface: 'options' });
    expect(surfaceRegistry.get().tabs).toEqual([
      'settings.prompts', 'settingsPrompts.narration', 'settingsPromptSurfaces.options',
    ]);
  });
});
