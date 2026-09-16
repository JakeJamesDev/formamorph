// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { PROMPT_LABELS, SURFACE_LABELS } from '@/lib/promptGroups';
import { normalizeEndpointUrl } from '@/lib/endpointUrl';
import { DEFAULT_ENDPOINT, DEFAULT_MODEL_NAME } from '@/contexts/settingsDefaults';
import type { ReasoningCapability } from '@/lib/reasoningEffort';
import { SETTINGS_COPY } from './settingsCopy';

/**
 * A prompt's Options panel tunes that prompt and no other. These cases open the Scene Tags tab, whose
 * shipped tuning differs from Narration's on every row, and read which prompt's values the rows show.
 */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

/** A reasoning model on LM Studio, so the switch and the budget slider both render. */
const takesBudget: ReasoningCapability = {
  reasons: true, levels: ['none', 'low', 'medium', 'high'], budget: true, dialect: 'lmstudio', offAllowed: null,
  sources: { reasons: 'native', levels: 'probe', budget: 'native' },
};

const seedTakesBudget = () =>
  localStorage.setItem(
    'FORMAMORPH_reasoningSupport',
    JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: takesBudget }),
  );

const openOptions = (initialPromptTab: string) => {
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab={initialPromptTab} />
      </SettingsProvider>
    </ThemeProvider>,
  );
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
};

/** Moves to another prompt's Options through the rail, keeping the same provider and its stored tuning. */
const switchTo = (tab: keyof typeof PROMPT_LABELS) => {
  fireEvent.click(screen.getAllByRole('button', { name: PROMPT_LABELS[tab] }).at(-1)!);
  fireEvent.click(screen.getAllByRole('button', { name: SURFACE_LABELS.options }).at(-1)!);
};

const makeEditable = () => fireEvent.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));

/** The Custom Temperature row: its checkbox, and the readout beside its slider. */
const temperatureRow = () => {
  const box = screen.getByRole('checkbox', { name: SETTINGS_COPY.customTemperature.label });
  const row = box.closest('.space-y-2') as HTMLElement;
  return { box, row, slider: within(row).getByRole('slider') };
};

const reasoningSwitch = () => screen.getAllByRole('checkbox', { name: 'Native Reasoning' })[0];
const budgetValue = () => screen.getByRole('slider', { name: 'Reasoning Budget' }).getAttribute('aria-valuenow');

describe('the Scene Tags Options panel tunes Scene Tags', () => {
  beforeEach(() => localStorage.clear());

  it('shows the Scene Tags temperature pin while no custom value is set', () => {
    openOptions('scenetags');
    const { box, row } = temperatureRow();
    expect(box.getAttribute('data-state')).toBe('unchecked');
    expect(within(row).getByText('0.30')).toBeTruthy();
  });

  it('keeps a custom temperature set on Scene Tags off the Narration tab', () => {
    openOptions('scenetags');
    makeEditable();
    fireEvent.click(temperatureRow().box);
    fireEvent.keyDown(temperatureRow().slider, { key: 'ArrowRight' });
    expect(within(temperatureRow().row).getByText('0.35')).toBeTruthy();

    switchTo('narration');
    const narration = temperatureRow();
    expect(narration.box.getAttribute('data-state')).toBe('unchecked');
    expect(within(narration.row).queryByText('0.35')).toBeNull();
  });

  it('reads the Scene Tags reasoning switch and budget, not Narration’s', () => {
    seedTakesBudget();
    openOptions('scenetags');
    // Scene Tags ships switched off at a 25% budget; Narration ships on at 40%.
    expect(reasoningSwitch().getAttribute('data-state')).toBe('unchecked');
    expect(budgetValue()).toBe('25');
  });

  it('writes the Scene Tags reasoning switch and budget without moving Narration’s', () => {
    seedTakesBudget();
    openOptions('scenetags');
    makeEditable();
    fireEvent.click(reasoningSwitch());
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Reasoning Budget' }), { key: 'ArrowRight' });
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    const sceneBudget = budgetValue();
    expect(sceneBudget).not.toBe('25');

    switchTo('narration');
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    expect(budgetValue()).toBe('40');

    switchTo('scenetags');
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    expect(budgetValue()).toBe(sceneBudget);
  });
});
