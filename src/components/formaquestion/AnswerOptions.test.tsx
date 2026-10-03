import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { activeHelpOptions, DEFAULT_HELP_ANSWER_OPTIONS, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { helpSettingsOf, type HelpSettings } from '@/lib/formaquestion/helpSettings';
import { PromptsTab } from './FormaquestionPromptsTab';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettings }) {
  const [settings, setSettings] = useState(initial);
  help = settings;
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

/** A store with one custom preset, "Mine", active, holding `options`. */
const mine = (options: Partial<typeof DEFAULT_HELP_ANSWER_OPTIONS> = {}) =>
  helpSettingsOf({ presets: editHelpOptions(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine'), 'mine', options) });

const rail = () => within(screen.getByRole('navigation', { name: 'Prompts' }));
const panel = () => screen.getByRole('region', { name: 'Options' });
const box = (name: string) => within(panel()).getByRole('checkbox', { name });
const slider = (name: string) => within(panel()).getByRole('slider', { name });

/** Renders the tab and opens the Options row under Answer. */
async function renderOptions(initial: HelpSettings) {
  render(<Harness initial={initial} />);
  const user = userEvent.setup();
  await user.click(rail().getByRole('button', { name: 'Options' }));
  return user;
}

beforeEach(() => { localStorage.clear(); });

describe('the answer Options panel', () => {
  it('opens from a row under Answer and replaces the editor', async () => {
    render(<Harness initial={mine()} />);
    const user = userEvent.setup();
    expect(screen.queryByRole('region', { name: 'Options' })).toBeNull();
    await user.click(rail().getByRole('button', { name: 'Options' }));
    expect(screen.queryByRole('textbox', { name: 'Answer Prompt' })).toBeNull();
    expect(box('Custom Temperature')).toBeEnabled();
    await user.click(rail().getByRole('button', { name: 'Picks' }));
    expect(screen.queryByRole('region', { name: 'Options' })).toBeNull();
    await user.click(rail().getByRole('button', { name: 'Answer' }));
    expect(screen.getByRole('textbox', { name: 'Answer Prompt' })).toBeInTheDocument();
  });

  it('is read-only on the Default preset, says why, and changes nothing there', async () => {
    const user = await renderOptions(helpSettingsOf());
    expect(screen.getByText(PROMPTS_COPY.readOnly('Default'))).toBeInTheDocument();
    for (const name of ['Custom Temperature', 'Custom Repetition Penalty', 'Max Output']) expect(box(name)).toBeDisabled();
    expect(slider('Custom Temperature')).toHaveAttribute('aria-valuenow', String(DEFAULT_HELP_ANSWER_OPTIONS.temperature));
    await user.click(box('Custom Temperature'));
    expect(help.presets).toEqual(EMPTY_HELP_PRESET_STORE);
  });

  it('duplicates the Default preset from the notice, and the copy takes edits', async () => {
    const user = await renderOptions(helpSettingsOf());
    await user.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));
    expect(help.presets.activeId).not.toBe(DEFAULT_HELP_PRESET_ID);
    expect(box('Custom Temperature')).toBeEnabled();
  });

  it('reads Custom for a stored value off the default, and shows the stored value', async () => {
    await renderOptions(mine({ temperature: 0.7, repetitionPenalty: 1.1, maxTokens: 400 }));
    expect(box('Custom Temperature')).toBeChecked();
    expect(box('Custom Repetition Penalty')).toBeChecked();
    expect(box('Max Output')).toBeChecked();
    expect(slider('Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
    expect(slider('Max Output')).toHaveAttribute('aria-valuenow', '400');
  });

  it("writes a slider move to the preset's options, and returns the default when the box clears", async () => {
    const user = await renderOptions(mine());
    await user.click(box('Custom Temperature'));
    slider('Custom Temperature').focus();
    await user.keyboard('{ArrowRight}');
    expect(activeHelpOptions(help.presets).temperature).toBeCloseTo(0.25);
    await user.click(box('Custom Temperature'));
    expect(activeHelpOptions(help.presets).temperature).toBe(DEFAULT_HELP_ANSWER_OPTIONS.temperature);
  });

  it('keeps each preset its own values when the player changes preset', async () => {
    const user = await renderOptions(mine({ temperature: 0.7 }));
    await user.click(screen.getByRole('button', { name: 'Duplicate Preset' }));
    expect(slider('Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
    await user.click(box('Custom Temperature'));
    const copyId = help.presets.activeId;
    expect(help.presets.presets.find((preset) => preset.id === 'mine')?.options.temperature).toBe(0.7);
    expect(help.presets.presets.find((preset) => preset.id === copyId)?.options.temperature).toBe(DEFAULT_HELP_ANSWER_OPTIONS.temperature);
  });
});
