// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SURFACE_LABELS } from '@/lib/promptGroups';
import { SAMPLE_PREVIEW_VALUES } from '@/lib/previewValuePool';
import { resolveToken } from '@/lib/promptTemplate';
import { DEFAULT_TAG_PROMPT } from '@/lib/imagePrompt';

/** Settings hands Chip Options the scene the spec names (Q22): the sample world, or the live values a game gives. */

vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const LIVE = (key: string) => (key.startsWith('<ENTITIES') ? 'Only the live cast.' : undefined);

beforeEach(() => {
  localStorage.clear();
});

const openSettings = (props: Partial<React.ComponentProps<typeof SettingsModal>>) =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" {...props} />
      </SettingsProvider>
    </ThemeProvider>,
  );

/** Opens Chip Options on the first placed chip with this label and returns the What the AI Reads pane. */
async function readsOf(label: string) {
  const chip = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('[data-chip]')].find((el) => el.textContent?.startsWith(label));
    expect(found, label).toBeTruthy();
    return found!;
  });
  fireEvent.click(chip);
  return within(await screen.findByRole('dialog', { name: 'Chip Options' })).getByRole('region', { name: 'What the AI Reads' });
}

describe('Chip Options in Settings', () => {
  it('reads the sample world on a prompt field outside a game', async () => {
    openSettings({ initialTab: 'prompts' });
    fireEvent.click(await screen.findByRole('button', { name: SURFACE_LABELS.system }));
    const reads = await readsOf('Entities');
    expect(reads).toHaveTextContent('Wren');
  });

  it("reads a game's live values on a prompt field in a game", async () => {
    // A lookup, as the game gives: it answers every Entities spelling the default prompt places.
    openSettings({ initialTab: 'prompts', previewValues: LIVE });
    fireEvent.click(await screen.findByRole('button', { name: SURFACE_LABELS.system }));
    const reads = await readsOf('Entities');
    expect(reads).toHaveTextContent('Only the live cast.');
    expect(reads).not.toHaveTextContent('Wren');
  });

  it('renders the Subject chip in the Image Tag Prompt field with its sample value', async () => {
    expect(DEFAULT_TAG_PROMPT).toContain('<SUBJECT>');
    openSettings({ initialTab: 'endpoints', initialEndpointTab: 'img-tagprompt' });
    const reads = await readsOf('Subject');
    const sample = resolveToken('<SUBJECT>', SAMPLE_PREVIEW_VALUES);
    expect(sample).not.toBe('');
    expect(reads.lastElementChild?.textContent).toBe(sample);
  });
});
