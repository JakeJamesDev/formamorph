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
import { REASONING_NOTES } from './settingsCopy';

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
  reasons: true, levels: [...levels], budget: true, dialect: 'lmstudio',
  sources: { reasons: 'native', levels: 'probe', budget: 'native' },
};
/** A plain OpenAI-compatible endpoint: the probe narrowed the levels and nothing answered the budget. */
const effortOnly: ReasoningCapability = {
  reasons: null, levels: [...levels], budget: null, dialect: 'unknown', sources: { levels: 'probe' },
};
/** A model whose endpoint refuses to switch reasoning off, such as Kimi k3. */
const alwaysReasons: ReasoningCapability = {
  reasons: true, levels: ['low', 'high', 'max'], budget: null, dialect: 'moonshot-k3',
  sources: { reasons: 'native', levels: 'native', dialect: 'native' },
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

/** Every control is read-only under a built-in prompt preset, so a test about one clicks the copy out first. */
const makeEditable = () => fireEvent.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));

describe('the prompt Options strength follows the capability record', () => {
  beforeEach(() => localStorage.clear());

  it('offers the level dropdown and the budget slider together on a target that caps thinking by tokens', () => {
    seedCapability(takesBudget);
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.getByText('Reasoning Budget')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Reasoning Budget' })).toBeTruthy();
    // One switch governs both: there is a single checkbox in the field.
    expect(screen.getAllByRole('checkbox', { name: 'Native Reasoning' })).toHaveLength(1);
  });

  it('offers the strength dropdown on a target whose budget question is unanswered', () => {
    seedCapability(effortOnly);
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });

  // The record says the endpoint takes a budget, but OpenAI's dialect names no field to put one in, so
  // there is nothing for the slider to send.
  it('hides the slider on a dialect with no budget field, whatever the record answered', () => {
    seedCapability({ ...takesBudget, dialect: 'openai' });
    openNarrationOptions();
    expect(screen.getByText('Native Reasoning')).toBeTruthy();
    expect(screen.queryByText('Reasoning Budget')).toBeNull();
  });
});

describe('a model that always reasons', () => {
  beforeEach(() => localStorage.clear());

  // Statistics prompts ship switched off. On an endpoint that refuses off, the switch still reads checked:
  // the model reasons whatever the setting says, and the request carries no field at all.
  it('shows the prompt switch checked and locked, with the note saying why', () => {
    seedCapability(alwaysReasons);
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.getAttribute('data-state')).toBe('checked');
    expect(box.disabled).toBe(true);
    expect(screen.getByText(REASONING_NOTES.always)).toBeTruthy();
  });

  it('leaves the strength dropdown live, so how hard the model thinks is still a choice', () => {
    seedCapability(alwaysReasons);
    openNarrationOptions();
    makeEditable();
    const strength = screen.getAllByRole('combobox').find((c) => c.textContent?.includes('Global'));
    expect(strength).toBeTruthy();
    expect((strength as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps the switch clickable on an ordinary record', () => {
    seedCapability(effortOnly);
    openNarrationOptions();
    makeEditable();
    const box = screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0] as HTMLButtonElement;
    expect(box.disabled).toBe(false);
    expect(screen.queryByText(REASONING_NOTES.always)).toBeNull();
  });
});
