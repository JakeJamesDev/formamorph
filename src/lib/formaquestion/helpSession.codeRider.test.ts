import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { HELP_CHIP } from './helpChips';
import { DEFAULT_CODE_RIDER, STAT_CODE_TAB } from './helpCodeRider';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE, type HelpPresetStore } from './helpPresets';
import { helpUserMessage } from './helpPrompt';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettings } from './helpSettings';

const PAGES = {
  'World-Editor-Stats': '# 📊 World Editor Stats\n\nA stat holds a number.\n\n## Dynamic Value Calculation\n\nThe **Code** tab holds two boxes, **Before the AI** and **After the AI**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [World Editor Stats](World-Editor-Stats)\n- [Traits](Traits)\n' });

const surface = (...tabs: SurfaceId[]): Surface => ({ screen: 'worldEditor', dialog: null, tabs });
const CODE_TAB = surface(STAT_CODE_TAB);

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[]; max_tokens?: number }
const bodyOf = (spy: FetchSpy): SentBody => JSON.parse(spy.mock.calls[0][1].body as string) as SentBody;
const userOf = (spy: FetchSpy): string => bodyOf(spy).messages.at(-1)!.content;

/** One request per question: the pick request is off. */
const settingsOf = (over: Partial<HelpSettings> = {}) => helpSettingsOf({ sources: { aiPicks: false }, ...over });

/** An endpoint known to take function calls, so lookup mode runs. */
const CAPABLE = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));

/** A custom preset with its rider changed, active. */
const riderPreset = (code: string): HelpPresetStore =>
  editHelpPrompt(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine'), 'mine', 'code', code);

async function ask(question: string, over: Partial<HelpQuestion> = {}) {
  const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(sseReply('Done.')));
  const events: HelpEvent[] = [];
  for await (const event of askHelp({ question, settings: settingsOf(), snapshot: textSnapshot(), index, fetchImpl: fetchImpl as unknown as typeof fetch, ...over })) events.push(event);
  const done = events.findLast((event) => event.type === 'done');
  const trace = events.findLast((event) => event.type === 'trace');
  return {
    fetchImpl,
    sources: done?.type === 'done' ? done.sources : [],
    customPrompt: trace?.type === 'trace' ? trace.trace.requests.at(-1)?.customPrompt : undefined,
  };
}

const ORDINARY = 'How do I add a trait?';
const CODE_QUESTION = 'Can stats.Hunger drain each turn?';

describe('the Code rider', () => {
  it('rides a question with code words, after the user message, at the 800 cap', async () => {
    const { fetchImpl, sources } = await ask(CODE_QUESTION);
    expect(userOf(fetchImpl)).toBe(`${helpUserMessage(CODE_QUESTION, sources)}\n\n${DEFAULT_CODE_RIDER}`);
    expect(bodyOf(fetchImpl).max_tokens).toBe(800);
  });

  it('rides any question asked from a stat Code tab', async () => {
    const { fetchImpl } = await ask('How do I make this go down?', { surface: CODE_TAB });
    expect(userOf(fetchImpl).endsWith(`\n\n${DEFAULT_CODE_RIDER}`)).toBe(true);
    expect(bodyOf(fetchImpl).max_tokens).toBe(800);
  });

  it('leaves the Code tab out while Use the Open Screen is off; code words still ride', async () => {
    const off = settingsOf({ openScreen: false });
    expect(userOf((await ask('How do I make this go down?', { surface: CODE_TAB, settings: off })).fetchImpl)).not.toContain(DEFAULT_CODE_RIDER);
    expect(userOf((await ask(CODE_QUESTION, { surface: CODE_TAB, settings: off })).fetchImpl)).toContain(DEFAULT_CODE_RIDER);
  });

  it('leaves an ordinary question as it was: the same body whatever the rider says', async () => {
    const plain = await ask(ORDINARY, { surface: surface('worldEditorStat.details') });
    expect(userOf(plain.fetchImpl)).not.toContain(DEFAULT_CODE_RIDER);
    const custom = await ask(ORDINARY, { surface: surface('worldEditorStat.details'), settings: settingsOf({ presets: riderPreset('Write code always.') }) });
    expect(custom.fetchImpl.mock.calls[0][1].body).toBe(plain.fetchImpl.mock.calls[0][1].body);
    expect(userOf(plain.fetchImpl)).toBe(helpUserMessage(ORDINARY, plain.sources));
  });

  it('sends a custom rider verbatim, chip tokens and all', async () => {
    const rider = `Answer in code. ${HELP_CHIP.voice} ${HELP_CHIP.marker}`;
    const { fetchImpl } = await ask(CODE_QUESTION, { settings: settingsOf({ presets: riderPreset(rider) }) });
    expect(userOf(fetchImpl).endsWith(`\n\n${rider}`)).toBe(true);
  });

  it('adds nothing when a custom rider is empty', async () => {
    const { fetchImpl, sources } = await ask(CODE_QUESTION, { settings: settingsOf({ presets: riderPreset('') }) });
    expect(userOf(fetchImpl)).toBe(helpUserMessage(CODE_QUESTION, sources));
  });

  it('rides lookup mode and a bare question too', async () => {
    const lookup = await ask(CODE_QUESTION, { settings: settingsOf({ lookup: true }), snapshot: CAPABLE });
    expect(userOf(lookup.fetchImpl).endsWith(`\n\n${DEFAULT_CODE_RIDER}`)).toBe(true);
    const bare = settingsOf({ openScreen: false, lookup: false, sources: { keyword: false, aiPicks: false, semantic: false } });
    expect(userOf((await ask(CODE_QUESTION, { settings: bare })).fetchImpl)).toBe(`${CODE_QUESTION}\n\n${DEFAULT_CODE_RIDER}`);
  });

  it('marks the request custom when a custom rider rode it, and only then', async () => {
    const presets = riderPreset('Write code always.');
    expect((await ask(CODE_QUESTION, { settings: settingsOf({ presets }) })).customPrompt).toBe(true);
    expect((await ask(ORDINARY, { settings: settingsOf({ presets }) })).customPrompt).toBe(false);
    expect((await ask(CODE_QUESTION)).customPrompt).toBe(false);
  });
});
