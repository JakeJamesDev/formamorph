// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { SURFACE_LABELS } from '@/lib/promptGroups';
import { normalizeEndpointUrl } from '@/lib/endpointUrl';
import { DEFAULT_ENDPOINT, DEFAULT_MODEL_NAME } from '@/contexts/settingsDefaults';
import type { ReasoningCapability } from '@/lib/reasoningEffort';

/**
 * Which strength a prompt's Options tab offers. The record on the routed target decides it: a target that
 * caps thinking by tokens gets the Reasoning Budget slider, and every other target gets the Native Reasoning
 * strength dropdown. What a player sees is the field's own label, so that is what these read.
 */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** The cache the context reads its record from, keyed exactly as it keys the active endpoint and model. */
const seedCapability = (record: ReasoningCapability) =>
  localStorage.setItem(
    'FORMAMORPH_reasoningSupport',
    JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: record }),
  );

const levels = ['none', 'low', 'medium', 'high'] as const;
/** A reasoning model on LM Studio: its native list answered the reasons and budget questions. */
const takesBudget: ReasoningCapability = {
  reasons: true, levels: [...levels], budget: true,
  sources: { reasons: 'native', levels: 'probe', budget: 'native' },
};
/** A plain OpenAI-compatible endpoint: the probe narrowed the levels and nothing answered the budget. */
const effortOnly: ReasoningCapability = {
  reasons: null, levels: [...levels], budget: null, sources: { levels: 'probe' },
};

/** Settings → Prompts → Narration → Options, which is where a prompt's own strength lives. */
const openNarrationOptions = () => {
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab="narration" />
      </SettingsProvider>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
};

describe('the prompt Options strength follows the capability record', () => {
  beforeEach(() => localStorage.clear());

  it('offers the budget slider on a target that caps thinking by tokens', () => {
    seedCapability(takesBudget);
    openNarrationOptions();
    expect(screen.getByText('Reasoning Budget')).toBeTruthy();
    expect(screen.queryByText('Native Reasoning')).toBeNull();
  });

  it('offers the strength dropdown on a target whose budget question is unanswered', () => {
    seedCapability(effortOnly);
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });
});
