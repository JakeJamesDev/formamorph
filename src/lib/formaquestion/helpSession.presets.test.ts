import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { HELP_CHIP } from './helpChips';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE, type HelpPresetStore } from './helpPresets';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_PICK_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT } from './helpPrompt';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf } from './helpSettings';

const PAGES = {
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Traits](Traits)\n' });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[] }
const systemOf = (spy: FetchSpy, call: number) => (JSON.parse(spy.mock.calls[call][1].body as string) as SentBody).messages[0].content;

/** A fetch that answers every request, the pick request first, with one reply. */
const answers = (): FetchSpy => vi.fn(async () => sseResponse(sseReply('Open the **Traits** tab.')));
const asFetch = (spy: FetchSpy) => spy as unknown as typeof fetch;

async function sent(question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}): Promise<HelpEvent[]> {
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question, settings: DEFAULT_HELP_SETTINGS, snapshot: textSnapshot(), index, fetchImpl: asFetch(fetchImpl), ...over })) events.push(event);
  return events;
}

/** A custom preset with each text changed, active. */
const custom = (prompts: Partial<Record<'answer' | 'pick' | 'lookup', string>>): HelpPresetStore => {
  let store = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');
  for (const [key, text] of Object.entries(prompts) as ['answer' | 'pick' | 'lookup', string][]) store = editHelpPrompt(store, 'mine', key, text);
  return store;
};

/** An endpoint known to take function calls, so lookup mode runs. */
const CAPABLE = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

describe('the help prompts of a question', () => {
  it('come from the Default preset as the fixed texts, with the pick request first', async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(systemOf(fetchImpl, 0)).toBe(HELP_PICK_SYSTEM_PROMPT);
    expect(systemOf(fetchImpl, 1)).toBe(HELP_SYSTEM_PROMPT);
  });

  it('come from the active custom preset: its answer text and its pick text, chips rendered', async () => {
    const fetchImpl = answers();
    const presets = custom({ answer: `Answer in one line. Write ${HELP_CHIP.marker} first when the guide is silent.`, pick: `Pick ${HELP_CHIP.pickLimit}.\n${HELP_CHIP.replyFormat}` });
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets }) });
    expect(systemOf(fetchImpl, 0)).toBe('Pick 5.\n- Reply with the lines of your picks alone, one on each line, each copied as the list writes it.');
    expect(systemOf(fetchImpl, 1)).toBe(`Answer in one line. Write ${GENERAL_KNOWLEDGE_MARKER} first when the guide is silent.`);
  });

  it('come from the active custom preset in lookup mode: its lookup text, with the function chip rendered', async () => {
    const fetchImpl = answers();
    const presets = custom({ lookup: `Read more with ${HELP_CHIP.lookupFunction}, then answer.` });
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets, lookup: true, sources: { aiPicks: false } }), snapshot: CAPABLE });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(systemOf(fetchImpl, 0)).toBe('Read more with read_guide, then answer.');
    const defaults = answers();
    await sent('How do I add a trait?', defaults, { settings: helpSettingsOf({ lookup: true, sources: { aiPicks: false } }), snapshot: CAPABLE });
    expect(systemOf(defaults, 0)).toBe(HELP_LOOKUP_SYSTEM_PROMPT);
  });

  it('send no marker text when the custom answer prompt places no marker chip', async () => {
    const fetchImpl = answers();
    const presets = custom({ answer: 'Answer from the guide sections. Say when they do not cover the question.' });
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets }) });
    expect(systemOf(fetchImpl, 1)).not.toContain(GENERAL_KNOWLEDGE_MARKER);
  });

  it('follow the active id: a custom preset that is not active sends nothing', async () => {
    const fetchImpl = answers();
    const presets = { ...custom({ answer: 'Mine.' }), activeId: DEFAULT_HELP_PRESET_ID };
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets }) });
    expect(systemOf(fetchImpl, 1)).toBe(HELP_SYSTEM_PROMPT);
  });
});
