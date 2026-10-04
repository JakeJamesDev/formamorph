// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsModal } from './SettingsModal';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { buildStyledValues } from '@/lib/sectionStyle';
import { presetStoreCodec, type PromptPresetStore, type PromptValues } from '@/lib/promptPresets';

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));

const PROMPTS_KEY = 'FORMAMORPH_promptPresets';
const storedValues = () => presetStoreCodec.parse(localStorage.getItem(PROMPTS_KEY)!).presets.find((p) => p.id === 'mine')!.values;

/** What a fresh copy of Default holds: the shipped text in its section style. */
const SHIPPED = buildStyledValues(PROMPT_TEXT_DEFAULTS, 'markdown');
const EDITED_SYSTEM = `Write in present tense.\n${SHIPPED.systemPrompt}`;
const EDITED_RECAP = `${SHIPPED.recapUserPrompt} Keep it short.`;

/** One editable preset holding the shipped text plus `edits`, active unless `activeId` names a built-in. */
function seed(edits: Partial<PromptValues>, activeId = 'mine') {
  const store: PromptPresetStore = {
    activeId,
    presets: [{ id: 'mine', name: 'Mine', values: { ...SHIPPED, ...edits }, style: 'markdown' }],
  };
  localStorage.setItem(PROMPTS_KEY, presetStoreCodec.serialize(store));
}

const openPrompts = (initialPromptSurface: string, initialPromptTab = 'narration') =>
  render(
    <ThemeProvider>
      <SettingsProvider>
        <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" initialTab="prompts" initialPromptTab={initialPromptTab} initialPromptSurface={initialPromptSurface} />
      </SettingsProvider>
    </ThemeProvider>,
  );

const reset = (name: string) => screen.queryByRole('button', { name: `Reset ${name}` });
const compare = (name: string) => screen.queryByRole('button', { name: `Compare ${name}` });

/** Whether `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(() => localStorage.clear());

describe('Settings → Prompts: Reset and Compare on one prompt', () => {
  it('puts Reset then Compare in the footer, right-aligned, under the editor', () => {
    seed({ systemPrompt: EDITED_SYSTEM });
    openPrompts('system');
    const resetButton = reset('Narration Prompt')!;
    const compareButton = compare('Narration Prompt')!;
    expect(resetButton).toHaveTextContent('Reset');
    expect(compareButton).toHaveTextContent('Compare');
    expect(precedes(resetButton, compareButton)).toBe(true);
    const footer = resetButton.parentElement!;
    expect(footer).toBe(compareButton.parentElement);
    expect(footer).toHaveClass('justify-end');
    // The footer sits outside the editor's panel, after it.
    const panel = screen.getAllByRole('tabpanel').find((p) => p.id.endsWith('-content-narration'))!;
    expect(panel.contains(footer)).toBe(false);
    expect(precedes(panel, footer)).toBe(true);
  });

  it('names the User Message on its own editor', () => {
    seed({});
    openPrompts('user', 'choices');
    expect(reset('Choices Message')).not.toBeNull();
    expect(compare('Choices Message')).not.toBeNull();
  });

  it('disables both while the text equals the default', () => {
    seed({});
    openPrompts('system');
    expect(reset('Narration Prompt')).toBeDisabled();
    expect(compare('Narration Prompt')).toBeDisabled();
  });

  it('opens a diff against the default text', async () => {
    seed({ systemPrompt: EDITED_SYSTEM });
    openPrompts('system');
    fireEvent.click(compare('Narration Prompt')!);
    const dialog = await screen.findByRole('dialog', { name: 'Narration Prompt vs. Default' });
    expect([...dialog.querySelectorAll('ins')].map((el) => el.textContent).join('')).toContain('present tense');
    expect(dialog.querySelectorAll('del')).toHaveLength(0);
  });

  it('confirms with a dialog that names the prompt, then resets it', async () => {
    seed({ systemPrompt: EDITED_SYSTEM });
    openPrompts('system');
    fireEvent.click(reset('Narration Prompt')!);
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Reset the Narration Prompt to its default text?');
    expect(storedValues().systemPrompt).toBe(EDITED_SYSTEM);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    expect(storedValues().systemPrompt).toBe(SHIPPED.systemPrompt);
    expect(reset('Narration Prompt')).toBeDisabled();
  });

  it('leaves the text alone when the confirm is canceled', async () => {
    seed({ systemPrompt: EDITED_SYSTEM });
    openPrompts('system');
    fireEvent.click(reset('Narration Prompt')!);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(storedValues().systemPrompt).toBe(EDITED_SYSTEM);
  });

  it('hides both on a built-in preset', () => {
    seed({ systemPrompt: EDITED_SYSTEM }, 'default');
    openPrompts('system');
    expect(reset('Narration Prompt')).toBeNull();
    expect(compare('Narration Prompt')).toBeNull();
  });

  it('shows neither on the Options view or the hub', () => {
    seed({ systemPrompt: EDITED_SYSTEM });
    const { unmount } = openPrompts('options');
    expect(screen.queryByRole('button', { name: /^(Reset|Compare) / })).toBeNull();
    unmount();
    openPrompts('anatomy');
    expect(screen.queryByRole('button', { name: /^(Reset|Compare) / })).toBeNull();
  });
});

describe('Settings → Prompts: Reset and Compare on stacked Messages', () => {
  it('puts the pair at the right of each label row, Reset then Compare, and none in the footer', () => {
    seed({ recapUserPrompt: EDITED_RECAP });
    openPrompts('messages');
    for (const name of ['Recap Message', 'Now Message']) {
      const resetButton = reset(name)!;
      const compareButton = compare(name)!;
      expect(precedes(resetButton, compareButton)).toBe(true);
      const pair = resetButton.parentElement!;
      expect(pair).toHaveClass('justify-end');
      // The label row holds the label on the left and the pair on the right.
      const row = pair.parentElement!;
      expect(row.firstElementChild).toHaveTextContent(name);
      expect(row.lastElementChild).toBe(pair);
    }
    expect(reset('Narration Prompt')).toBeNull();
  });

  it('enables only the edited message and resets it after a confirm', async () => {
    seed({ recapUserPrompt: EDITED_RECAP });
    openPrompts('messages');
    expect(reset('Now Message')).toBeDisabled();
    expect(compare('Now Message')).toBeDisabled();
    expect(compare('Recap Message')).toBeEnabled();
    fireEvent.click(reset('Recap Message')!);
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Reset the Recap Message to its default text?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    expect(storedValues().recapUserPrompt).toBe(SHIPPED.recapUserPrompt);
  });

  it('opens the diff for the message it sits beside', async () => {
    seed({ recapUserPrompt: EDITED_RECAP });
    openPrompts('messages');
    fireEvent.click(compare('Recap Message')!);
    const dialog = await screen.findByRole('dialog', { name: 'Recap Message vs. Default' });
    expect([...dialog.querySelectorAll('ins')].map((el) => el.textContent).join('')).toContain('Keep it short.');
  });

  it('hides the pairs on a built-in preset', () => {
    seed({ recapUserPrompt: EDITED_RECAP }, 'default');
    openPrompts('messages');
    expect(screen.queryByRole('button', { name: /^(Reset|Compare) / })).toBeNull();
  });
});
