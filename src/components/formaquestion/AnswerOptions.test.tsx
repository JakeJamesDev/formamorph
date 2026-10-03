import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { PromptsTab } from './FormaquestionPromptsTab';

let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettingsChange }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

const rail = () => within(screen.getByRole('navigation', { name: 'Prompts' }));

/** Renders the tab and opens the Options row under Answer. */
async function renderOptions(initial: HelpSettingsChange = {}) {
  render(<Harness initial={initial} />);
  const user = userEvent.setup();
  await user.click(rail().getByRole('button', { name: 'Options' }));
  return user;
}

const panel = () => screen.getByRole('region', { name: 'Options' });
const box = (name: string) => within(panel()).getByRole('checkbox', { name });
const slider = (name: string) => within(panel()).getByRole('slider', { name });

beforeEach(() => { localStorage.clear(); });

describe('the answer Options panel', () => {
  it('opens from a row under Answer, replaces the editor, and leaves the Default preset unlocked', async () => {
    render(<Harness initial={{}} />);
    const user = userEvent.setup();
    expect(screen.queryByRole('region', { name: 'Options' })).toBeNull();
    await user.click(rail().getByRole('button', { name: 'Options' }));
    expect(screen.queryByRole('textbox', { name: 'Answer Prompt' })).toBeNull();
    expect(box('Custom Temperature')).toBeEnabled();
    await user.click(box('Custom Temperature'));
    expect(slider('Custom Temperature')).toBeEnabled();
    await user.click(rail().getByRole('button', { name: 'Picks' }));
    expect(screen.queryByRole('region', { name: 'Options' })).toBeNull();
    await user.click(rail().getByRole('button', { name: 'Answer' }));
    expect(screen.getByRole('textbox', { name: 'Answer Prompt' })).toBeInTheDocument();
  });

  it('reads Custom for a stored value off the default, and shows the stored value', async () => {
    await renderOptions({ answerTemperature: 0.7, answerRepetitionPenalty: 1.1, answerMaxTokens: 400 });
    expect(box('Custom Temperature')).toBeChecked();
    expect(box('Custom Repetition Penalty')).toBeChecked();
    expect(box('Max Output')).toBeChecked();
    expect(slider('Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
    expect(slider('Max Output')).toHaveAttribute('aria-valuenow', '400');
  });

  it('writes a slider move to the setting, and returns the default when the box clears', async () => {
    const user = await renderOptions();
    await user.click(box('Custom Temperature'));
    slider('Custom Temperature').focus();
    await user.keyboard('{ArrowRight}');
    expect(help.answerTemperature).toBeCloseTo(0.25);
    await user.click(box('Custom Temperature'));
    expect(help.answerTemperature).toBe(DEFAULT_HELP_SETTINGS.answerTemperature);
  });

  it('keeps the values when the player changes the help preset', async () => {
    const user = await renderOptions({ answerTemperature: 0.7 });
    await user.click(screen.getByRole('button', { name: 'Duplicate Preset' }));
    expect(help.presets.activeId).not.toBe(DEFAULT_HELP_SETTINGS.presets.activeId);
    expect(help.answerTemperature).toBe(0.7);
    expect(slider('Custom Temperature')).toHaveAttribute('aria-valuenow', '0.7');
  });
});
