// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { normalizeEndpointUrl } from '@/lib/endpointUrl';
import { textEndpointPresetCodec, DEFAULT_TEXT_ENDPOINT_VALUES } from '@/lib/textEndpointPresets';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import type { ReasoningCapability } from '@/lib/reasoningEffort';
import { REASONING_NOTES } from './settingsCopy';

/**
 * The Output tab's Native Reasoning row is the active endpoint's control: the endpoint-wide strength every
 * Global prompt follows. A prompt pinned to another endpoint has its own row on the Prompts tab. These cases
 * set the two targets to disagree about reasoning and read which record the Output row follows.
 */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));
// Both targets get a seeded record, so nothing needs the network; the probes are stubbed so nothing tries it.
vi.mock('@/lib/reasoningEffort', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort');
  return { ...actual, resolveReasoningCapability: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/lib/contextLength', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/contextLength');
  return { ...actual, fetchContextLength: vi.fn().mockResolvedValue(32768) };
});

const ACTIVE = { id: 'active', url: 'http://active.test/v1', model: 'active-24b' };
const ROUTED = { id: 'routed', url: 'http://routed.test/v1', model: 'routed-7b' };

/** A plain endpoint whose probe narrowed the levels: reasoning is not ruled out, so the row shows. */
const reasons: ReasoningCapability = {
  reasons: null, levels: ['none', 'low', 'medium', 'high'], budget: null, dialect: 'unknown', offAllowed: null, tools: null,
  sources: { levels: 'probe' },
};
/** A model its list says does not reason at all. */
const ruledOut: ReasoningCapability = {
  reasons: false, levels: [], budget: false, dialect: 'lmstudio', offAllowed: null, tools: null,
  sources: { reasons: 'native', levels: 'native', budget: 'native' },
};

const sig = (t: { url: string; model: string }) => `${normalizeEndpointUrl(t.url)}|${t.model}`;

/** Two endpoint presets with the first active, and the narration prompt pinned to the second. */
function seedRoutedNarration(activeRecord: ReasoningCapability, routedRecord: ReasoningCapability) {
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({
    activeId: ACTIVE.id,
    presets: [ACTIVE, ROUTED].map((t) => ({
      id: t.id, name: t.id, values: { ...DEFAULT_TEXT_ENDPOINT_VALUES, endpoint: t.url, model: t.model },
    })),
  }));
  // Routing is preset-scoped, so a user prompt preset has to be the active one.
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: 'A' } as never, style: 'markdown', promptEndpoints: { narration: ROUTED.id } }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({ [sig(ACTIVE)]: activeRecord, [sig(ROUTED)]: routedRecord }));
}

/** Settings → Output, with the narration prompt selected on the Prompts tab. */
const openOutput = () =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="output" initialPromptTab="narration" />
      </SettingsProvider>
    </ThemeProvider>,
  );

describe('the Output tab Native Reasoning row follows the active endpoint', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the row while the selected prompt is pinned to a model that cannot reason', () => {
    seedRoutedNarration(reasons, ruledOut);
    openOutput();
    expect(screen.getByRole('checkbox', { name: 'Native Reasoning' })).toBeTruthy();
    expect(screen.queryByText(REASONING_NOTES.never)).toBeNull();
  });

  it('gives way to the note when the active model cannot reason, whatever the selected prompt is pinned to', () => {
    seedRoutedNarration(ruledOut, reasons);
    openOutput();
    expect(screen.getByText(REASONING_NOTES.never)).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Native Reasoning' })).toBeNull();
  });
});
