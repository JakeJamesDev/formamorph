import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { HELP_CHIP } from '@/lib/formaquestion/helpChips';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { HELP_PICK_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { DEFAULT_MASCOT_RIG } from '@/lib/formaquestion/mascot';
import { helpSettingsCodec, helpSettingsOf } from '@/lib/formaquestion/helpSettings';
import { addPreset, emptyStore, presetStoreCodec, PROMPT_TEXT_KEYS, type PromptValues } from '@/lib/promptPresets';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { mascotStoreOf, openHelpSettings, VOICED_HELP_PROMPT } from '@/test/helpFixtures';
import { renderReporting } from '@/test/surfaceReporter';
import type { HelpAi } from './useHelpAi';

// The AI settings and the reachability check come from the app's providers. Each test sets them here.
const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));

type Body = { messages: { role: string; content: string }[] };
const systemOf = (spy: ReturnType<typeof vi.fn>, call: number) => (JSON.parse(spy.mock.calls[call][1].body as string) as Body).messages[0].content;

/** Every request, the pick request first, answered with one reply. */
function stubRequests() {
  const spy = vi.fn((_url: string, _init: RequestInit) => sseResponse(sseReply('Open the **Traits** tab.')));
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Waits for the answer request, the second one after the pick. The rendered reply splits its text across bold, so a text find never matches. */
const answered = (spy: ReturnType<typeof vi.fn>) => waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

async function ask(spy: ReturnType<typeof vi.fn>, question: string) {
  renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  const field = await screen.findByRole('textbox', { name: 'Ask a Question' });
  await userEvent.type(field, question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
  await answered(spy);
}

beforeEach(() => {
  localStorage.clear();
  ai.current = helpAi({ revalidate: vi.fn(async () => true) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the help preset on the device', () => {
  it('sends the Default texts when nothing is stored', async () => {
    const spy = stubRequests();
    await ask(spy, 'How do I add a trait?');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(systemOf(spy, 0)).toBe(HELP_PICK_SYSTEM_PROMPT);
    expect(systemOf(spy, 1)).toBe(VOICED_HELP_PROMPT);
  });

  const captain = { ...DEFAULT_MASCOT_RIG, voice: 'Speak like a ship captain.' };

  it("sends the stored rig's Voice with the Mascot on", async () => {
    localStorage.setItem('FORMAMORPH_helpSettings', helpSettingsCodec.serialize(helpSettingsOf({ mascotPresets: mascotStoreOf(captain) })));
    const spy = stubRequests();
    await ask(spy, 'How do I add a trait?');
    expect(systemOf(spy, 1)).toContain('\n\nSpeak in this voice: Speak like a ship captain.\n');
  });

  it('sends the Voice typed on the Mascot tab', async () => {
    const spy = stubRequests();
    renderReporting(<Formaquestion loadIndex={loadFixture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    await openHelpSettings();
    const dialog = screen.getByRole('dialog', { name: 'Formaquestion Settings' });
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Mascot' }));
    // The Default mascot is read-only; its copy takes the Voice.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Duplicate' }));
    const voice = await within(dialog).findByRole('textbox', { name: 'Voice' });
    await userEvent.clear(voice);
    // One paste, not 26 keystrokes: each keystroke re-renders the whole Mascot tab, and the field's value is what the prompt reads.
    await userEvent.paste('Speak like a ship captain.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Ask a Question' }), 'How do I add a trait?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await answered(spy);
    expect(systemOf(spy, 1)).toContain('\n\nSpeak in this voice: Speak like a ship captain.\n');
  });

  it("sends the prompt with no Voice while the Mascot is off", async () => {
    localStorage.setItem('FORMAMORPH_helpSettings', helpSettingsCodec.serialize(helpSettingsOf({ mascotPresets: mascotStoreOf(captain), mascot: false })));
    const spy = stubRequests();
    await ask(spy, 'How do I add a trait?');
    expect(systemOf(spy, 1)).toBe(HELP_SYSTEM_PROMPT);
  });

  it('sends the stored custom preset after a reload, chips rendered', async () => {
    let presets = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');
    presets = editHelpPrompt(presets, 'mine', 'answer', `Be brief. Write ${HELP_CHIP.marker} first when the guide is silent.`);
    presets = editHelpPrompt(presets, 'mine', 'pick', 'Pick well.');
    localStorage.setItem('FORMAMORPH_helpSettings', helpSettingsCodec.serialize(helpSettingsOf({ presets })));
    const spy = stubRequests();
    await ask(spy, 'How do I add a trait?');
    expect(systemOf(spy, 0)).toBe('Pick well.');
    expect(systemOf(spy, 1)).toBe('Be brief. Write [NOT IN GUIDE] first when the guide is silent.');
  });

  it('is its own list: a custom gameplay prompt preset in use changes no help text', async () => {
    const values = Object.fromEntries(PROMPT_TEXT_KEYS.map((key) => [key, 'Game text.'])) as PromptValues;
    localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(addPreset(emptyStore, 'game', 'Game', values, 'markdown')));
    const spy = stubRequests();
    await ask(spy, 'How do I add a trait?');
    expect(systemOf(spy, 0)).toBe(HELP_PICK_SYSTEM_PROMPT);
    expect(systemOf(spy, 1)).toBe(VOICED_HELP_PROMPT);
  });

  it('opens the Prompts tab on the stored preset, read-only for Default', async () => {
    stubRequests();
    renderReporting(<Formaquestion loadIndex={loadFixture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    await screen.findByRole('textbox', { name: 'Ask a Question' });
    await openHelpSettings();
    const dialog = screen.getByRole('dialog', { name: 'Formaquestion Settings' });
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Prompts' }));
    expect(within(dialog).getByRole('combobox', { name: 'Preset' })).toHaveTextContent('Default');
    expect(within(dialog).getByRole('textbox', { name: 'Answer Prompt' })).toHaveAttribute('contenteditable', 'false');
  });
});
