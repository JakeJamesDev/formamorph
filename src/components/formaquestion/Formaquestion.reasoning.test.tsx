import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REASONING_NOTES } from '@/components/modals/settingsCopy';
import { GENERAL_COPY } from './formaquestionSettingsTabs';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { reasoningCapabilityFromLevels, type ReasoningCapability } from '@/lib/reasoningEffort';
import { sseReply, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpAi } from '@/test/helpAiFixture';
import { openHelpSettings, stubHelpStream } from '@/test/helpFixtures';
import { renderReporting } from '@/test/surfaceReporter';
import type { HelpAi } from './useHelpAi';

const ai = vi.hoisted(() => ({ current: null as unknown as HelpAi }));
vi.mock('./useHelpAi', () => ({ useHelpAi: () => ai.current }));
import { Formaquestion } from './Formaquestion';

const PAGES = { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n' };
const loadFixture = () => Promise.resolve(createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' }));
const SETTINGS_KEY = 'FORMAMORPH_helpSettings';
const settingsDialog = () => screen.getByRole('dialog', { name: 'Formaquestion Settings' });

/** The AI settings with answers resolving to a model whose reasoning record is `reasoning`. */
function reasoningAi(reasoning: ReasoningCapability, maxTokens?: number): HelpAi {
  const target = textTarget({ reasoning, maxTokens });
  return helpAi({
    snapshot: textSnapshot(target, { reasoningEffort: 'medium' }),
    revalidate: vi.fn(async () => true),
    answerTarget: { reasoning, localEngine: false, maxTokens },
  });
}

async function openSettings() {
  renderReporting(<Formaquestion loadIndex={loadFixture} />);
  fireEvent.click(screen.getByRole('button', { name: 'Help' }));
  await screen.findByRole('textbox', { name: 'Ask a Question' });
  await openHelpSettings();
  return settingsDialog();
}

const reasoningSwitch = (dialog: HTMLElement) => within(dialog).getByRole('checkbox', { name: 'Reasoning' });
/** The reasoning level list: the General tab's one list besides the option dropdowns. */
// The General tab also holds the Chat Style and Mascot Position dropdowns and the narrow-screen tab dropdown.
const OTHER_LISTS: readonly string[] = [GENERAL_COPY.chatStyle.label, GENERAL_COPY.mascotPosition.label, 'Tab'];
const levelList = (dialog: HTMLElement) => within(dialog).queryByRole('combobox', { name: (name) => !OTHER_LISTS.includes(name) });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Reasoning row', () => {
  it('starts off at Global, and on sends the effort it follows on the answer request', async () => {
    ai.current = reasoningAi({ ...reasoningCapabilityFromLevels(['none', 'low', 'medium', 'high'], 'probe'), reasons: true, dialect: 'openai' });
    const dialog = await openSettings();
    expect(within(dialog).getByText('Reasoning')).toBeInTheDocument();
    expect(reasoningSwitch(dialog)).toHaveAttribute('aria-checked', 'false');
    expect(levelList(dialog)!).toHaveTextContent('Global');

    await userEvent.click(reasoningSwitch(dialog));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ reasoning: { enabled: true, level: 'global' } });

    await userEvent.keyboard('{Escape}');
    const spy = stubHelpStream(sseReply('Open the **Traits** tab.'));
    const field = screen.getByRole('textbox', { name: 'Ask a Question' });
    await userEvent.type(field, 'How do I add a trait?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(JSON.parse(spy.mock.calls[0][1].body as string)).toMatchObject({ reasoning_effort: 'medium' });
    expect(JSON.parse(spy.picks.mock.calls[0][1].body as string).reasoning_effort).toBeUndefined();
  });

  it('shows the budget of the endpoint answers resolve to', async () => {
    ai.current = reasoningAi({ ...reasoningCapabilityFromLevels([], 'probe'), reasons: true, budget: true, dialect: 'engine' }, 1000);
    const dialog = await openSettings();
    expect(within(dialog).getByText('75% · 750 tok')).toBeInTheDocument();
  });

  it('shows the field for a model that awaits proof: its switch, with no level the wire would drop', async () => {
    ai.current = reasoningAi({ ...reasoningCapabilityFromLevels(['none', 'low', 'high'], 'probe'), dialect: 'vllm' });
    const dialog = await openSettings();
    expect(reasoningSwitch(dialog)).toBeInTheDocument();
    expect(levelList(dialog)).toBeNull();
    expect(within(dialog).queryByText(REASONING_NOTES.never)).toBeNull();
  });

  it('shows its unavailable state for a model that does not reason', async () => {
    ai.current = reasoningAi({ ...reasoningCapabilityFromLevels([], 'probe'), reasons: false });
    const dialog = await openSettings();
    expect(within(dialog).getByText(REASONING_NOTES.never)).toBeInTheDocument();
    expect(levelList(dialog)).toBeNull();
    expect(within(dialog).queryByRole('checkbox', { name: 'Reasoning' })).toBeNull();
  });
});
