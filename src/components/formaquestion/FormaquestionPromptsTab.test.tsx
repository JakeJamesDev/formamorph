import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { GENERAL_KNOWLEDGE_MARKER } from '@/lib/formaquestion/generalKnowledge';
import { frameVoice, HELP_CHIP } from '@/lib/formaquestion/helpChips';
import { HELP_PICK_LIMIT } from '@/lib/formaquestion/helpPicks';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { activeHelpPreset, DEFAULT_HELP_OPTIONS, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { DEFAULT_HELP_PROMPTS } from '@/lib/formaquestion/helpPrompt';
import { helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { sentenceShapeViolation } from '@/test/copyShape';
import { PromptsTab } from './FormaquestionPromptsTab';
import { PROMPTS_COPY } from './formaquestionSettingsTabs';

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
const resetButton = (prompt = 'Answer') => screen.getByRole('button', { name: `Reset ${prompt} Prompt` });
const compareButton = (prompt = 'Answer') => screen.getByRole('button', { name: `Compare ${prompt} Prompt` });
const queryPair = () => screen.queryAllByRole('button', { name: /^(Reset|Compare) \w+ Prompt$/ });
const compareTitle = (prompt: string) => `${prompt} Prompt vs. Default`;
/** Whether `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
const headerRow = () => screen.getByTestId('help-preset-header-row');
const headerButton = (name: string) => within(headerRow()).getByRole('button', { name });
const queryHeaderButton = (name: string) => within(headerRow()).queryByRole('button', { name });
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
    for (const name of ['Duplicate', 'Import', 'Export']) expect(headerButton(name), name).toBeInTheDocument();
    for (const name of ['Rename', 'Reset', 'Delete']) expect(queryHeaderButton(name), name).toBeNull();
    expect(queryPair()).toHaveLength(0);
  });

  it('draws the chips of each prompt, and the rail opens each prompt', async () => {
    renderTab();
    const user = userEvent.setup();
    const rail = screen.getByRole('navigation', { name: 'Prompts' });
    expect(editor('Answer Prompt')).toHaveTextContent('Not in Guide Marker');
    await user.click(within(rail).getByRole('button', { name: 'Search' }));
    const picks = editor('Search Prompt');
    expect(picks).toHaveTextContent('Search Limit');
    expect(picks).toHaveTextContent('Reply Format');
    await user.click(within(rail).getByRole('button', { name: 'Lookup' }));
    expect(editor('Lookup Prompt')).toHaveTextContent('Lookup Function');
  });

  it.each([
    ['Answer', [GENERAL_KNOWLEDGE_MARKER, frameVoice(DEFAULT_MASCOT_RIG.voice)]],
    ['Search', [`Pick ${HELP_PICK_LIMIT} sections at most.`, '- Reply with the lines of your picks alone']],
    ['Lookup', [GENERAL_KNOWLEDGE_MARKER, `with ${DOCS_LOOKUP.name}.`, frameVoice(DEFAULT_MASCOT_RIG.voice)]],
  ])('gives the %s prompt Edit and Preview, no Values, and previews its chips as sent', async (label, sent) => {
    renderTab();
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: label }));
    expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Values' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    const preview = screen.getByTestId('prompt-preview');
    for (const text of sent) expect(preview.textContent).toContain(text);
    expect(preview.textContent).not.toMatch(/<[A-Z_]+>/);
  });

  it('previews no Voice in the Search prompt, as its request sends none', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'pick', `Pick well.\n${HELP_CHIP.voice}`) });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Search' }));
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    const preview = screen.getByTestId('prompt-preview');
    expect(preview.textContent).toContain('Pick well.');
    expect(preview.textContent).not.toContain('Speak in this voice');
  });

  it('previews no Voice while the Mascot is off', async () => {
    renderTab({ mascot: false });
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    const preview = screen.getByTestId('prompt-preview');
    expect(preview.textContent).toContain(GENERAL_KNOWLEDGE_MARKER);
    expect(preview.textContent).not.toContain('Speak in this voice');
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
    for (const name of ['Rename', 'Reset', 'Delete']) expect(headerButton(name), name).toBeInTheDocument();
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

describe('the Code rider in the Prompts tab', () => {
  const rail = () => screen.getByRole('navigation', { name: 'Prompts' });

  it('sits in the rail after Lookup with no Options row, and shows the Default rider read-only', async () => {
    renderTab();
    const rows = within(rail()).getAllByRole('button').map((row) => row.getAttribute('aria-label') ?? row.textContent);
    expect(rows).toEqual(['Answer', 'Answer Options', 'Search', 'Search Options', 'Lookup', 'Lookup Options', 'Code']);
    await userEvent.setup().click(within(rail()).getByRole('button', { name: 'Code' }));
    expect(editor('Code Prompt')).toHaveAttribute('contenteditable', 'false');
    expect(editor('Code Prompt')).toHaveTextContent('Before the AI');
    expect(screen.getByText(PROMPTS_COPY.prompts.code.hint)).toBeInTheDocument();
  });

  it('stores a typed edit on a custom preset, and its own Reset returns the default rider', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', 'Be brief.') });
    const user = userEvent.setup();
    await user.click(within(rail()).getByRole('button', { name: 'Code' }));
    expect(resetButton('Code')).toBeDisabled();
    await user.click(editor('Code Prompt'));
    await user.keyboard('Use one block. ');
    await waitFor(() => expect(texts().code).toBe(`Use one block. ${DEFAULT_HELP_PROMPTS.code}`));
    await user.click(resetButton('Code'));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(texts().code).toBe(DEFAULT_HELP_PROMPTS.code));
    expect(texts().answer).toBe('Be brief.');
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

  it('disables Compare for a prompt equal to the default, and opens the diff over the tab for an edited one', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', `Be brief. ${DEFAULT_HELP_PROMPTS.answer}`) });
    const user = userEvent.setup();
    expect(compareButton()).toBeEnabled();
    await user.click(compareButton());
    const dialog = await screen.findByRole('dialog', { name: compareTitle('Answer') });
    expect([...dialog.querySelectorAll('ins')].map((el) => el.textContent).join('')).toContain('brief');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: compareTitle('Answer') })).toBeNull());

    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Search' }));
    expect(compareButton('Search')).toBeDisabled();
  });

  it('puts Reset then Compare in the footer, right-aligned, outside the field and its label row', () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', 'Be brief.') });
    const reset = resetButton();
    const compare = compareButton();
    expect(reset).toHaveTextContent('Reset');
    expect(compare).toHaveTextContent('Compare');
    expect(precedes(reset, compare)).toBe(true);
    const footer = reset.parentElement!;
    expect(footer).toBe(compare.parentElement);
    expect(footer).toHaveClass('justify-end');
    // The block before the footer holds the field and its label; the pair is a sibling of it, not inside.
    const field = footer.previousElementSibling!;
    expect(field.contains(editor('Answer Prompt'))).toBe(true);
    expect(field.contains(screen.getByText('Answer', { selector: 'label' }))).toBe(true);
    expect(field.contains(footer)).toBe(false);
    expect(queryPair()).toHaveLength(2);
  });

  it('names the prompt it resets in the confirm and returns focus to Reset on cancel', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'pick', 'Pick well.') });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Search' }));
    await user.click(resetButton('Search'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Search Prompt');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(texts().pick).toBe('Pick well.');
    expect(resetButton('Search')).toHaveFocus();
  });

  it('shows the pair on no Options view', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'answer', 'Be brief.') });
    await userEvent.setup().click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Answer Options' }));
    expect(queryPair()).toHaveLength(0);
  });

  it('resets all three prompts and their options from the header after a confirm that names the preset', async () => {
    let presets = editHelpPrompt(withMine(), 'mine', 'answer', 'Be brief.');
    presets = editHelpPrompt(presets, 'mine', 'pick', 'Pick well.');
    presets = editHelpPrompt(presets, 'mine', 'lookup', 'Look it up.');
    presets = editHelpOptions(presets, 'mine', 'pick', { temperature: 1.2, maxTokens: 300 });
    renderTab({ presets });
    const user = userEvent.setup();

    await user.click(headerButton('Reset'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('"Mine"');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(texts().answer).toBe('Be brief.');
    expect(headerButton('Reset')).toHaveFocus();

    await user.click(headerButton('Reset'));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(texts()).toEqual(DEFAULT_HELP_PROMPTS));
    expect(activeHelpPreset(help.presets).options).toEqual(DEFAULT_HELP_OPTIONS);
    expect(presetSelect()).toHaveTextContent('Mine');
  });

  it('holds every action in the Preset Actions menu for a narrow screen', async () => {
    renderTab({ presets: withMine() });
    await userEvent.setup().click(within(headerRow()).getByRole('button', { name: 'Preset Actions' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Duplicate', 'Rename', 'Import', 'Export', 'Reset', 'Delete']);
  });

  it('keeps an edited text when the active prompt changes in the rail', async () => {
    renderTab({ presets: editHelpPrompt(withMine(), 'mine', 'pick', 'Pick well.') });
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('navigation', { name: 'Prompts' })).getByRole('button', { name: 'Search' }));
    expect(editor('Search Prompt')).toHaveTextContent('Pick well.');
    expect(resetButton('Search')).toBeEnabled();
  });

  it('renames through the dialog', async () => {
    renderTab({ presets: withMine() });
    const user = userEvent.setup();
    await user.click(headerButton('Rename'));
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
    await user.click(headerButton('Delete'));
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
    const hints = [PROMPTS_COPY.preset.hint, ...Object.values(PROMPTS_COPY.prompts).map((prompt) => prompt.hint)];
    for (const hint of hints) {
      expect(sentenceShapeViolation(hint), hint).toBeNull();
      expect(hint.split(/\s+/).length, hint).toBeLessThanOrEqual(12);
    }
  });
});
