import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { activeHelpPreset, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { DEFAULT_HELP_PROMPTS } from '@/lib/formaquestion/helpPrompt';
import { helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { sentenceShapeViolation } from '@/test/copyShape';
import { PromptsTab } from './FormaquestionPromptsTab';
import { COMPARE_COPY, PROMPTS_COPY } from './formaquestionSettingsTabs';

let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettingsChange }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

const renderTab = (initial: HelpSettingsChange = {}) => render(<Harness initial={initial} />);

/** A store with one custom preset, "Mine", active. */
const withMine = () => duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');

const presetSelect = () => screen.getByRole('combobox', { name: 'Preset' });
const editor = (name: string) => screen.getByRole('textbox', { name });
const resetButton = () => screen.getByRole('button', { name: /Reset to Default/ });
const texts = () => activeHelpPreset(help.presets).prompts;

async function choose(select: HTMLElement, option: string) {
  const user = userEvent.setup();
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => { localStorage.clear(); });

describe('the Prompts tab on the Default preset', () => {
  it('shows the answer prompt read-only, says why, and offers no rename, delete or reset', () => {
    renderTab();
    expect(presetSelect()).toHaveTextContent('Default');
    expect(editor('Answer Prompt')).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByText(PROMPTS_COPY.readOnly('Default'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Duplicate & Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename Preset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete Preset' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reset to Default/ })).toBeNull();
  });

  it('draws the chips of each prompt, and the rail opens each prompt', async () => {
    renderTab();
    const user = userEvent.setup();
    const rail = screen.getByRole('navigation', { name: 'Prompts' });
    expect(editor('Answer Prompt')).toHaveTextContent('Not in Guide Marker');
    await user.click(within(rail).getByRole('button', { name: 'Picks' }));
    const picks = editor('Picks Prompt');
    expect(picks).toHaveTextContent('Pick Limit');
    expect(picks).toHaveTextContent('Reply Format');
    await user.click(within(rail).getByRole('button', { name: 'Lookup' }));
    expect(editor('Lookup Prompt')).toHaveTextContent('Lookup Function');
  });

  it('duplicates into a custom copy from the notice, which then takes edits', async () => {
    renderTab();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Duplicate & Edit/ }));
    expect(presetSelect()).toHaveTextContent('Default (copy)');
    expect(texts()).toEqual(DEFAULT_HELP_PROMPTS);
    expect(editor('Answer Prompt')).toHaveAttribute('contenteditable', 'true');
    expect(screen.queryByText(PROMPTS_COPY.readOnly('Default'))).toBeNull();
    expect(resetButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rename Preset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Preset' })).toBeInTheDocument();
  });

  it('adds a preset under a typed name from the select', async () => {
    renderTab();
    const user = userEvent.setup();
    await choose(presetSelect(), 'Add New Preset…');
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByRole('textbox');
    await user.clear(name);
    await user.type(name, 'Terse{Enter}');
    await waitFor(() => expect(presetSelect()).toHaveTextContent('Terse'));
    expect(help.presets.presets.map((preset) => preset.name)).toEqual(['Terse']);
  });
});

describe('the Prompts tab on a custom preset', () => {
  it('stores a typed edit, enables Reset, and Reset returns the default text after a confirm', async () => {
    renderTab({ presets: withMine() });
    const user = userEvent.setup();
    const field = editor('Answer Prompt');
    await user.click(field);
    await user.keyboard('Be brief. ');
    await waitFor(() => expect(texts().answer).toBe(`Be brief. ${DEFAULT_HELP_PROMPTS.answer}`));
    expect(texts().pick).toBe(DEFAULT_HELP_PROMPTS.pick);
    expect(resetButton()).toBeEnabled();

    await user.click(resetButton());
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(texts().answer).toBe(DEFAULT_HELP_PROMPTS.answer));
    expect(resetButton()).toBeDisabled();
  });

  it('disables Compare to Default for a prompt equal to the default, and opens the diff over the tab for an edited one', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', `Be brief. ${DEFAULT_HELP_PROMPTS.answer}`) });
    const user = userEvent.setup();
    const compare = () => screen.getByRole('button', { name: /Compare to Default/ });
    expect(compare()).toBeEnabled();
    await user.click(compare());
    const dialog = await screen.findByRole('dialog', { name: COMPARE_COPY.title('Answer') });
    expect([...dialog.querySelectorAll('ins')].map((el) => el.textContent).join('')).toContain('brief');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: COMPARE_COPY.title('Answer') })).toBeNull());

    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Picks' }));
    expect(compare()).toBeDisabled();
  });

  it('shows no Compare to Default on the Default preset', () => {
    renderTab();
    expect(screen.queryByRole('button', { name: /Compare to Default/ })).toBeNull();
  });

  it('keeps an edited text when the active prompt changes in the rail', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'pick', 'Pick well.') });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Picks' }));
    expect(editor('Picks Prompt')).toHaveTextContent('Pick well.');
    expect(resetButton()).toBeEnabled();
  });

  it('renames through the dialog', async () => {
    renderTab({ presets: withMine() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rename Preset' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByRole('textbox');
    expect(name).toHaveValue('Mine');
    await user.clear(name);
    await user.type(name, 'Ours{Enter}');
    await waitFor(() => expect(presetSelect()).toHaveTextContent('Ours'));
    expect(help.presets.activeId).toBe('mine');
  });

  it('deletes after a confirm and selects Default', async () => {
    renderTab({ presets: withMine() });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete Preset' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(presetSelect()).toHaveTextContent('Default'));
    expect(help.presets).toEqual(EMPTY_HELP_PRESET_STORE);
    expect(editor('Answer Prompt')).toHaveAttribute('contenteditable', 'false');
  });

  it('switches between presets without losing either', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', 'Mine.') });
    await choose(presetSelect(), 'Default');
    expect(editor('Answer Prompt')).toHaveAttribute('contenteditable', 'false');
    await choose(presetSelect(), 'Mine');
    expect(editor('Answer Prompt')).toHaveTextContent('Mine.');
    expect(help.presets.presets).toHaveLength(1);
  });
});

describe('the Prompts copy', () => {
  it('writes each description as one short line', () => {
    const hints = [PROMPTS_COPY.preset.hint, PROMPTS_COPY.reset.hint, COMPARE_COPY.action.hint, COMPARE_COPY.action.same, ...Object.values(PROMPTS_COPY.prompts).map((prompt) => prompt.hint)];
    for (const hint of hints) {
      expect(sentenceShapeViolation(hint), hint).toBeNull();
      expect(hint.split(/\s+/).length, hint).toBeLessThanOrEqual(12);
    }
  });
});
