import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { GENERAL_KNOWLEDGE_MARKER } from './generalKnowledge';
import { HELP_CHIP } from './helpChips';
import { HELP_PICK_MAX_TOKENS } from './helpPicks';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpOptions, editHelpPrompt, EMPTY_HELP_PRESET_STORE, type HelpPresetStore } from './helpPresets';
import { HELP_LOOKUP_SYSTEM_PROMPT, HELP_PICK_SYSTEM_PROMPT, HELP_SYSTEM_PROMPT } from './helpPrompt';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf } from './helpSettings';
import { DEFAULT_MASCOT_RIG } from './mascot';
import { mascotStoreOf, VOICED_HELP_PROMPT, VOICED_LOOKUP_PROMPT } from '@/test/helpFixtures';

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
    expect(systemOf(fetchImpl, 1)).toBe(VOICED_HELP_PROMPT);
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
    expect(systemOf(defaults, 0)).toBe(VOICED_LOOKUP_PROMPT);
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
    expect(systemOf(fetchImpl, 1)).toBe(VOICED_HELP_PROMPT);
  });
});

describe('the options of each request', () => {
  type Samplers = { temperature?: unknown; repetition_penalty?: unknown; repeat_penalty?: unknown; max_tokens?: unknown };
  const samplersOf = (spy: FetchSpy, call: number): Samplers => {
    const { temperature, repetition_penalty, repeat_penalty, max_tokens } = JSON.parse(spy.mock.calls[call][1].body as string) as Samplers;
    return { temperature, repetition_penalty, repeat_penalty, max_tokens };
  };
  const wire = ({ temperature, repetitionPenalty, maxTokens }: { temperature: number; repetitionPenalty: number; maxTokens: number }): Samplers =>
    ({ temperature, repetition_penalty: repetitionPenalty, repeat_penalty: repetitionPenalty, max_tokens: maxTokens });
  const ANSWER = { temperature: 0.9, repetitionPenalty: 1.1, maxTokens: 1200 };
  const PICK = { temperature: 0.4, repetitionPenalty: 1.04, maxTokens: 90 };
  const LOOKUP = { temperature: 0.6, repetitionPenalty: 1.2, maxTokens: 1500 };
  /** A custom preset whose three blocks all differ, active. */
  const blocks = (): HelpPresetStore => {
    let store = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');
    store = editHelpOptions(store, 'mine', 'answer', ANSWER);
    store = editHelpOptions(store, 'mine', 'pick', PICK);
    return editHelpOptions(store, 'mine', 'lookup', LOOKUP);
  };

  it('send the values of the Default preset: the help pins, the pick cap and the answer cap', async () => {
    const plain = answers();
    await sent('How do I add a trait?', plain);
    expect(samplersOf(plain, 0)).toEqual({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1, max_tokens: HELP_PICK_MAX_TOKENS });
    expect(samplersOf(plain, 1)).toEqual({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1, max_tokens: 800 });
    const lookup = answers();
    await sent('How do I add a trait?', lookup, { settings: helpSettingsOf({ lookup: true }), snapshot: CAPABLE });
    expect(samplersOf(lookup, 1)).toEqual({ temperature: 0.2, repetition_penalty: 1, repeat_penalty: 1, max_tokens: 800 });
  });

  it('send the pick block on the pick request and the answer block on the answer request', async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets: blocks() }) });
    expect(samplersOf(fetchImpl, 0)).toEqual(wire(PICK));
    expect(samplersOf(fetchImpl, 1)).toEqual(wire(ANSWER));
  });

  it('send the lookup block on the answer request in lookup mode', async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ presets: blocks(), lookup: true }), snapshot: CAPABLE });
    expect(samplersOf(fetchImpl, 0)).toEqual(wire(PICK));
    expect(samplersOf(fetchImpl, 1)).toEqual(wire(LOOKUP));
  });
});

describe('the Voice of a question', () => {
  const VOICE = 'Speak like a ship captain.';
  const rig = { ...DEFAULT_MASCOT_RIG, voice: VOICE };
  /** The lines the chip sends for `voice`. */
  const framed = (voice: string) => `Speak in this voice: ${voice}\nKeep that voice. Start with the answer, and write each step and control name as the guide writes it.`;
  /** The prompt with the framed `voice` as its own paragraph after the intro line. */
  const voiced = (prompt: string, voice: string) => {
    const [intro, ...rest] = prompt.split('\n\n');
    return [intro, framed(voice), ...rest].join('\n\n');
  };
  const bodyOf = (spy: FetchSpy, call: number) => JSON.parse(spy.mock.calls[call][1].body as string) as SentBody;

  it("sits after the answer prompt's intro with the mascot on, and nowhere in the pick request", async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig) }) });
    expect(systemOf(fetchImpl, 1)).toBe(voiced(HELP_SYSTEM_PROMPT, VOICE));
    expect(systemOf(fetchImpl, 0)).toBe(HELP_PICK_SYSTEM_PROMPT);
  });

  it("sits after the lookup prompt's intro in lookup mode", async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig), lookup: true, sources: { aiPicks: false } }), snapshot: CAPABLE });
    expect(systemOf(fetchImpl, 0)).toBe(voiced(HELP_LOOKUP_SYSTEM_PROMPT, VOICE));
  });

  it("sends the prompts with no Voice while the mascot is off, and changes nothing else in the body", async () => {
    const off = answers();
    await sent('How do I add a trait?', off, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig), mascot: false }) });
    expect(systemOf(off, 1)).toBe(HELP_SYSTEM_PROMPT);
    const on = answers();
    await sent('How do I add a trait?', on, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig) }) });
    const { messages: [, ...offRest], ...offBody } = bodyOf(off, 1) as SentBody & Record<string, unknown>;
    const { messages: [, ...onRest], ...onBody } = bodyOf(on, 1) as SentBody & Record<string, unknown>;
    expect(onRest).toEqual(offRest);
    expect(onBody).toEqual(offBody);
    const lookupOff = answers();
    await sent('How do I add a trait?', lookupOff, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig), mascot: false, lookup: true, sources: { aiPicks: false } }), snapshot: CAPABLE });
    expect(systemOf(lookupOff, 0)).toBe(HELP_LOOKUP_SYSTEM_PROMPT);
  });

  it("sends the prompt with no Voice when the Voice is empty or blank", async () => {
    for (const voice of ['', '  \n ']) {
      const fetchImpl = answers();
      await sent('How do I add a trait?', fetchImpl, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf({ ...rig, voice }) }) });
      expect(systemOf(fetchImpl, 1), JSON.stringify(voice)).toBe(HELP_SYSTEM_PROMPT);
    }
  });

  it('goes out in a custom answer prompt only where it places the chip', async () => {
    const without = answers();
    await sent('How do I add a trait?', without, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig), presets: custom({ answer: 'Answer from the guide sections.' }) }) });
    expect(systemOf(without, 1)).toBe('Answer from the guide sections.');
    const placed = answers();
    await sent('How do I add a trait?', placed, { settings: helpSettingsOf({ mascotPresets: mascotStoreOf(rig), presets: custom({ answer: `Answer from the guide sections.\n${HELP_CHIP.voice}` }) }) });
    expect(systemOf(placed, 1)).toBe(`Answer from the guide sections.\n${framed(VOICE)}`);
  });

  it('comes with the question: the default rig sends its Voice', async () => {
    const fetchImpl = answers();
    await sent('How do I add a trait?', fetchImpl, { settings: DEFAULT_HELP_SETTINGS });
    expect(systemOf(fetchImpl, 1)).toBe(voiced(HELP_SYSTEM_PROMPT, DEFAULT_MASCOT_RIG.voice));
  });
});
