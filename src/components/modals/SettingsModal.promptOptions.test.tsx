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
import { DEFAULT_TEXT_ENDPOINT_VALUES, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { presetStoreCodec } from '@/lib/promptPresets';
import { SETTINGS_COPY, REASONING_NOTES } from './settingsCopy';

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
  reasons: true, levels: ['none', 'low', 'medium', 'high'], budget: true, dialect: 'lmstudio', offAllowed: null, tools: null,
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
    // Scene Tags ships switched off at a 75% budget; Narration ships on at 150%.
    expect(reasoningSwitch().getAttribute('data-state')).toBe('unchecked');
    expect(budgetValue()).toBe('75');
  });

  it('writes the Scene Tags reasoning switch and budget without moving Narration’s', () => {
    seedTakesBudget();
    openOptions('scenetags');
    makeEditable();
    fireEvent.click(reasoningSwitch());
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Reasoning Budget' }), { key: 'ArrowRight' });
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    const sceneBudget = budgetValue();
    expect(sceneBudget).not.toBe('75');

    switchTo('narration');
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    expect(budgetValue()).toBe('150');

    switchTo('scenetags');
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    expect(budgetValue()).toBe(sceneBudget);
  });
});

/** The Max Output row: its checkbox, slider, and the readout beside the slider. */
const maxOutputRow = () => {
  const box = screen.getByRole('checkbox', { name: SETTINGS_COPY.promptMaxOutput.label });
  const row = box.closest('.space-y-2') as HTMLElement;
  return { box, row, slider: within(row).getByRole('slider', { name: SETTINGS_COPY.promptMaxOutput.label }) };
};
const hasMaxOutputRow = () => screen.queryByRole('checkbox', { name: SETTINGS_COPY.promptMaxOutput.label }) !== null;

describe('the Max Output row', () => {
  beforeEach(() => {
    localStorage.clear();
    // Staged mode, diaries and the clock put every prompt tab on the rail except Planning.
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
    localStorage.setItem('FORMAMORPH_characterDiaries', 'true');
    localStorage.setItem('FORMAMORPH_aiClock', 'true');
  });

  it('shows on the capped prompts and on no other', () => {
    openOptions('director');
    const withRow = ['director', 'character', 'discover', 'storyboard', 'summary', 'milestone', 'diary', 'choices', 'scenetags'] as const;
    const withoutRow = ['narration', 'statupdates', 'location', 'timepassed', 'timeopening'] as const;
    for (const tab of withRow) { switchTo(tab); expect(hasMaxOutputRow(), tab).toBe(true); }
    for (const tab of withoutRow) { switchTo(tab); expect(hasMaxOutputRow(), tab).toBe(false); }
  });

  it('reads Auto with the shipped 256 on Choices', () => {
    openOptions('choices');
    expect(within(maxOutputRow().row).getByText('Auto · 256 tok')).toBeTruthy();
  });

  it('reads Auto with the shipped 300 on Milestone Select', () => {
    openOptions('milestone');
    expect(within(maxOutputRow().row).getByText('Auto · 300 tok')).toBeTruthy();
  });

  it('reads Auto with the shipped 200 on Discover Entity', () => {
    localStorage.setItem('FORMAMORPH_describeCharacters', 'true');
    openOptions('discover');
    expect(within(maxOutputRow().row).getByText('Auto · 200 tok')).toBeTruthy();
  });

  it('shows on the precall planner', () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    openOptions('thinking');
    expect(within(maxOutputRow().row).getByText('Auto · 256 tok')).toBeTruthy();
  });

  it('reads Auto with the shipped cap, pinned and dimmed, while off', () => {
    openOptions('summary');
    const { box, row, slider } = maxOutputRow();
    expect(box.getAttribute('data-state')).toBe('unchecked');
    expect(within(row).getByText('Auto · 200 tok')).toBeTruthy();
    expect(slider.getAttribute('aria-valuenow')).toBe('200');
    expect(slider.getAttribute('data-disabled')).not.toBeNull();
  });

  it('sets a custom cap when on, and keeps it across a toggle', () => {
    openOptions('summary');
    makeEditable();
    fireEvent.click(maxOutputRow().box);
    fireEvent.keyDown(maxOutputRow().slider, { key: 'ArrowRight' });
    expect(within(maxOutputRow().row).getByText('208 tok')).toBeTruthy();

    fireEvent.click(maxOutputRow().box);
    expect(within(maxOutputRow().row).getByText('Auto · 200 tok')).toBeTruthy();
    fireEvent.click(maxOutputRow().box);
    expect(within(maxOutputRow().row).getByText('208 tok')).toBeTruthy();
  });

  it('keeps one prompt’s cap off another prompt', () => {
    openOptions('summary');
    makeEditable();
    fireEvent.click(maxOutputRow().box);
    switchTo('diary');
    expect(maxOutputRow().box.getAttribute('data-state')).toBe('unchecked');
    expect(within(maxOutputRow().row).getByText('Auto · 80 tok')).toBeTruthy();
  });

  it('locks under a built-in preset and shows the read-only notice', () => {
    openOptions('summary');
    expect(maxOutputRow().box.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/is read-only/)).toBeTruthy();
  });

});

/** A user endpoint preset on the default URL and model, so the seeded reasoning record still applies. */
const seedEndpointMaxOutput = (maxOutputOverride: { enabled: boolean; value: number }) =>
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: { ...DEFAULT_TEXT_ENDPOINT_VALUES, maxOutputOverride } }],
  }));

const budgetSlider = () => screen.getByRole('slider', { name: SETTINGS_COPY.reasoningBudget.label });

describe('the Reasoning Budget readout', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
    localStorage.setItem('FORMAMORPH_characterDiaries', 'true');
    seedTakesBudget();
  });

  it('reads its tokens from the endpoint’s Max Output, not the prompt’s row', () => {
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    openOptions('summary');
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();

    makeEditable();
    fireEvent.click(maxOutputRow().box);
    fireEvent.keyDown(maxOutputRow().slider, { key: 'ArrowRight' });
    expect(within(maxOutputRow().row).getByText('208 tok')).toBeTruthy();
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();
  });

  it('reads the passes without a row from the same endpoint base, whatever their own cap', () => {
    localStorage.setItem('FORMAMORPH_aiClock', 'true');
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    openOptions('statupdates');
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();
    switchTo('location');
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();
    // Time Passed sends a 12-token answer; the budget still comes from the endpoint.
    switchTo('timepassed');
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();
  });

  it('shows the token result where the budget is the only strength', () => {
    // No effort levels, so the budget slider stands in the switch's row with no dropdown.
    localStorage.setItem(
      'FORMAMORPH_reasoningSupport',
      JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: { ...takesBudget, levels: [] } }),
    );
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    openOptions('diary');
    expect(screen.queryByRole('combobox', { name: /Native Reasoning/ })).toBeNull();
    expect(screen.getByText('75% · 600 tok')).toBeTruthy();
  });

  it('shows a fresh narration prompt at 150% with its tokens', () => {
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    openOptions('narration');
    expect(screen.getByText('150% · 1200 tok')).toBeTruthy();
  });

  it('reads a stored 25% as 50%', () => {
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize({
      activeId: 'old',
      presets: [{ id: 'old', name: 'Old', values: { systemPrompt: 'A' } as never, style: 'markdown', reasoningBudget: { narration: 25 } }],
    }));
    openOptions('narration');
    expect(screen.getByText('50% · 400 tok')).toBeTruthy();
    expect(budgetValue()).toBe('50');
  });

  it('runs from 50% to 200% in steps of 5', () => {
    seedEndpointMaxOutput({ enabled: true, value: 800 });
    openOptions('narration');
    makeEditable();
    const slider = budgetSlider();
    expect(slider.getAttribute('aria-valuemin')).toBe('50');
    expect(slider.getAttribute('aria-valuemax')).toBe('200');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(screen.getByText('200% · 1600 tok')).toBeTruthy();
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(screen.getByText('195% · 1560 tok')).toBeTruthy();
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(screen.getByText('50% · 400 tok')).toBeTruthy();
  });

  it('disables the slider, keeps the percent, and names the fix while the endpoint override is off', () => {
    seedEndpointMaxOutput({ enabled: false, value: 800 });
    openOptions('narration');
    makeEditable();
    // Narration ships switched on, so only the missing base can disable the slider.
    expect(reasoningSwitch().getAttribute('data-state')).toBe('checked');
    expect(reasoningSwitch().hasAttribute('disabled')).toBe(false);
    expect(budgetSlider().getAttribute('data-disabled')).not.toBeNull();
    expect(screen.getByText('150%')).toBeTruthy();
    expect(screen.getByText(REASONING_NOTES.noBudgetBase)).toBeTruthy();
  });

  it('disables the budget-only slider and names the fix while the endpoint override is off', () => {
    localStorage.setItem(
      'FORMAMORPH_reasoningSupport',
      JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: { ...takesBudget, levels: [] } }),
    );
    seedEndpointMaxOutput({ enabled: false, value: 800 });
    openOptions('narration');
    makeEditable();
    expect(reasoningSwitch().hasAttribute('disabled')).toBe(false);
    expect(budgetSlider().getAttribute('data-disabled')).not.toBeNull();
    expect(screen.getByText('150%')).toBeTruthy();
    expect(screen.getByText(REASONING_NOTES.noBudgetBase)).toBeTruthy();
  });

  it('shows the floor a floor dialect still sends while the endpoint override is off', () => {
    localStorage.setItem(
      'FORMAMORPH_reasoningSupport',
      JSON.stringify({ [`${normalizeEndpointUrl(DEFAULT_ENDPOINT)}|${DEFAULT_MODEL_NAME}`]: { ...takesBudget, levels: [], dialect: 'anthropic-budget' } }),
    );
    seedEndpointMaxOutput({ enabled: false, value: 800 });
    openOptions('narration');
    expect(screen.getByText('150% · 1024 tok')).toBeTruthy();
    expect(budgetSlider().getAttribute('data-disabled')).not.toBeNull();
  });
});

describe('the Milestone Select tab', () => {
  beforeEach(() => localStorage.clear());

  const openSurface = (surface: string) =>
    fireEvent.click(screen.getAllByRole('button', { name: surface }).at(-1)!);

  it('sits in Memory between Summaries and Diary, with both editors and their chips', () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
    localStorage.setItem('FORMAMORPH_characterDiaries', 'true');
    openOptions('milestone');
    const rail = screen.getAllByRole('button').map((b) => b.textContent);
    const at = (label: string) => rail.findIndex((t) => t === label);
    expect(at(PROMPT_LABELS.summary)).toBeLessThan(at(PROMPT_LABELS.milestone));
    expect(at(PROMPT_LABELS.milestone)).toBeLessThan(at(PROMPT_LABELS.diary));

    openSurface(SURFACE_LABELS.system);
    expect(screen.getAllByText(/You are the memory keeper of an interactive story/).length).toBeGreaterThan(0);
    openSurface(SURFACE_LABELS.user);
    expect(screen.getAllByText('Remembered Moments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('New Moments').length).toBeGreaterThan(0);
  });

  it('is absent when memory digests are off', () => {
    localStorage.setItem('FORMAMORPH_memoryDigests', 'false');
    openOptions('narration');
    expect(screen.queryAllByRole('button', { name: PROMPT_LABELS.milestone })).toHaveLength(0);
  });
});

describe('the Discover Entity tab', () => {
  beforeEach(() => localStorage.clear());

  const openSurface = (surface: string) =>
    fireEvent.click(screen.getAllByRole('button', { name: surface }).at(-1)!);

  it('sits in Story right after Character, with both editors and their chips', () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
    localStorage.setItem('FORMAMORPH_describeCharacters', 'true');
    openOptions('discover');
    const rail = screen.getAllByRole('button').map((b) => b.textContent);
    const at = (label: string) => rail.findIndex((t) => t === label);
    expect(at(PROMPT_LABELS.discover)).toBe(at(PROMPT_LABELS.character) + 1);

    openSurface(SURFACE_LABELS.system);
    expect(screen.getAllByText(/lasting reference note for a character/).length).toBeGreaterThan(0);
    openSurface(SURFACE_LABELS.user);
    for (const chip of ['Character', 'First Passage', 'Later Material']) {
      expect(screen.getAllByText(chip).length, chip).toBeGreaterThan(0);
    }
  });

  it('is absent when describe-characters is off', () => {
    localStorage.setItem('FORMAMORPH_describeCharacters', 'false');
    openOptions('narration');
    expect(screen.queryAllByRole('button', { name: PROMPT_LABELS.discover })).toHaveLength(0);
  });
});
