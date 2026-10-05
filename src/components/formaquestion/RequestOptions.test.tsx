import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeHelpOptions, DEFAULT_HELP_OPTIONS, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, EMPTY_HELP_PRESET_STORE, type HelpRequestOptions,
} from '@/lib/formaquestion/helpPresets';
import type { HelpRequestKey } from '@/lib/formaquestion/helpPrompt';
import { helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { PromptsTab } from './FormaquestionPromptsTab';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  help = settings;
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

/** A store with one custom preset, "Mine", active, with `options` in the block of `key`. */
const mine = (key: HelpRequestKey = 'answer', options: Partial<HelpRequestOptions> = {}) =>
  helpSettingsOf({ presets: editHelpOptions(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine'), 'mine', key, options) });

const KEYS: HelpRequestKey[] = ['answer', 'pick', 'lookup'];
const labelOf = (key: HelpRequestKey) => PROMPTS_COPY.prompts[key].label;
const optionsName = (key: HelpRequestKey) => `${labelOf(key)} ${PROMPTS_COPY.options.title}`;

const rail = () => within(screen.getByRole('navigation', { name: 'Prompts' }));
const panel = (key: HelpRequestKey) => screen.getByRole('region', { name: optionsName(key) });
const box = (key: HelpRequestKey, name: string) => within(panel(key)).getByRole('checkbox', { name });
const slider = (key: HelpRequestKey, name: string) => within(panel(key)).getByRole('slider', { name });

/** Renders the tab and opens the Options row under the prompt `key`. */
async function renderOptions(initial: HelpSettings, key: HelpRequestKey) {
  render(<Harness initial={initial} />);
  const user = userEvent.setup();
  await user.click(rail().getByRole('button', { name: optionsName(key) }));
  return user;
}

beforeEach(() => { localStorage.clear(); });

describe('the Options panel of each prompt', () => {
  it.each(KEYS)('opens from a row under %s and replaces the editor', async (key) => {
    render(<Harness initial={mine()} />);
    const user = userEvent.setup();
    expect(screen.queryByRole('region', { name: optionsName(key) })).toBeNull();
    await user.click(rail().getByRole('button', { name: optionsName(key) }));
    expect(screen.queryByRole('textbox', { name: `${labelOf(key)} Prompt` })).toBeNull();
    expect(box(key, 'Custom Temperature')).toBeEnabled();
    expect(screen.getAllByRole('region').filter((region) => region.getAttribute('aria-label')?.endsWith(PROMPTS_COPY.options.title))).toHaveLength(1);
    await user.click(rail().getByRole('button', { name: labelOf(key) }));
    expect(screen.queryByRole('region', { name: optionsName(key) })).toBeNull();
    expect(screen.getByRole('textbox', { name: `${labelOf(key)} Prompt` })).toBeInTheDocument();
  });

  it.each(KEYS)('shows the Default values of %s read-only on the Default preset, and changes nothing there', async (key) => {
    const user = await renderOptions(helpSettingsOf(), key);
    expect(screen.getByText(PROMPTS_COPY.readOnly('Default'))).toBeInTheDocument();
    for (const name of ['Custom Temperature', 'Custom Repetition Penalty', 'Max Output']) expect(box(key, name)).toBeDisabled();
    expect(slider(key, 'Custom Temperature')).toHaveAttribute('aria-valuenow', String(DEFAULT_HELP_OPTIONS[key].temperature));
    expect(slider(key, 'Max Output')).toHaveAttribute('aria-valuenow', String(DEFAULT_HELP_OPTIONS[key].maxTokens));
    await user.click(box(key, 'Custom Temperature'));
    expect(help.presets).toEqual(EMPTY_HELP_PRESET_STORE);
  });

  it('duplicates the Default preset from the notice, and the copy takes edits', async () => {
    const user = await renderOptions(helpSettingsOf(), 'pick');
    await user.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));
    expect(help.presets.activeId).not.toBe(DEFAULT_HELP_PRESET_ID);
    expect(box('pick', 'Custom Temperature')).toBeEnabled();
  });

  it.each(KEYS)('reads Custom in %s for a stored value off its default, and shows the stored value', async (key) => {
    await renderOptions(mine(key, { temperature: 0.7, repetitionPenalty: 1.1, maxTokens: 400 }), key);
    expect(box(key, 'Custom Temperature')).toBeChecked();
    expect(box(key, 'Custom Repetition Penalty')).toBeChecked();
    expect(box(key, 'Max Output')).toBeChecked();
    expect(slider(key, 'Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
    expect(slider(key, 'Max Output')).toHaveAttribute('aria-valuenow', '400');
  });

  it('reads the Pick cap of the Default preset as no Custom value', async () => {
    await renderOptions(mine('pick', { maxTokens: DEFAULT_HELP_OPTIONS.pick.maxTokens }), 'pick');
    expect(box('pick', 'Max Output')).not.toBeChecked();
  });

  it.each(KEYS)("writes a slider move to the %s block alone, and returns that block's default when the box clears", async (key) => {
    const user = await renderOptions(mine(), key);
    await user.click(box(key, 'Max Output'));
    slider(key, 'Max Output').focus();
    await user.keyboard('{ArrowRight}');
    const moved = activeHelpOptions(help.presets);
    expect(moved[key].maxTokens).toBeGreaterThan(DEFAULT_HELP_OPTIONS[key].maxTokens);
    for (const other of KEYS.filter((k) => k !== key)) expect(moved[other]).toEqual(DEFAULT_HELP_OPTIONS[other]);
    await user.click(box(key, 'Max Output'));
    expect(activeHelpOptions(help.presets)[key].maxTokens).toBe(DEFAULT_HELP_OPTIONS[key].maxTokens);
  });

  it('keeps each preset its own values when the player changes preset', async () => {
    const user = await renderOptions(mine('lookup', { temperature: 0.7 }), 'lookup');
    await user.click(within(screen.getByTestId('help-preset-header-row')).getByRole('button', { name: 'Duplicate' }));
    expect(slider('lookup', 'Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
    await user.click(box('lookup', 'Custom Temperature'));
    const copyId = help.presets.activeId;
    expect(help.presets.presets.find((preset) => preset.id === 'mine')?.options.lookup.temperature).toBe(0.7);
    expect(help.presets.presets.find((preset) => preset.id === copyId)?.options.lookup.temperature).toBe(DEFAULT_HELP_OPTIONS.lookup.temperature);
  });
});
