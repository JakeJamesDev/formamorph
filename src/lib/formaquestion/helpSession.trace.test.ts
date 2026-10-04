import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { NO_PICK, pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_CHIP } from './helpChips';
import { pickList } from './helpPicks';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from './helpPresets';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { DEFAULT_HELP_SETTINGS, helpSettingsOf } from './helpSettings';
import { HELP_TRACE_DEPTH, type HelpTrace } from './helpTrace';

const PAGES = {
  Stats: '# 📊 Stats\n\nStats are numbers.\n\n## How to Add a Stat\n\n1. Open the **Stats** tab.\n2. Select **Add Stat**.\n',
  Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Open the **Traits** tab.\n2. Select **Add Trait**.\n',
  Settings: '# ⚙️ Settings\n\nSettings hold your options.\n\n## Display\n\nDisplay holds the theme.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Stats](Stats)\n- [Traits](Traits)\n- [Settings](Settings)\n' });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
const replyWith = (chunks: string[]): FetchSpy => vi.fn(async () => sseResponse(chunks));

/** The pick list's line for the Traits how-to, as a pick reply copies it. */
const TRAIT_LINE = pickList(index).lines.find((line) => line.includes('How to Add a Trait'))!;

const TRAIT = 'How do I add a trait?';

const ask = (question: string, fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}, picked = NO_PICK) =>
  askHelp({ question, settings: DEFAULT_HELP_SETTINGS, snapshot: textSnapshot(), index, fetchImpl: pastPicks(fetchImpl, picked), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const traces = (events: HelpEvent[]): HelpTrace[] => events.flatMap((event) => (event.type === 'trace' ? [event.trace] : []));
const lastTrace = (events: HelpEvent[]): HelpTrace => traces(events).at(-1)!;
const ids = (sections: readonly { id: string }[]) => sections.map((section) => section.id);

const SURFACE: Surface = { screen: null, dialog: 'settings', tabs: ['settings.display'] };

describe('the trace of a help question', () => {
  it('comes before the first answer event, with the search, the pick request and the answer request as sent', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT, fetchImpl, {}, TRAIT_LINE));

    const first = events.findIndex((event) => event.type === 'trace');
    const firstAnswer = events.findIndex((event) => event.type === 'answer');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(firstAnswer);

    const trace = traces(events)[0];
    expect(trace.search?.on).toEqual(['keyword', 'aiPicks']);
    const [query] = trace.search!.queries;
    expect(query.query).toBe(TRAIT);
    expect(query.sources.map((source) => source.source)).toEqual(['keyword', 'aiPicks']);
    expect(ids(query.sources[0].sections)[0]).toBe('Traits#how-to-add-a-trait');
    expect(ids(query.sources[1].sections)).toEqual(['Traits#how-to-add-a-trait']);
    expect(ids(query.merged)[0]).toBe('Traits#how-to-add-a-trait');
    expect(ids(trace.sent)).toContain('Traits#how-to-add-a-trait');

    expect(trace.requests.map((request) => request.record.type)).toEqual(['AI Search', 'Answer']);
    const [pick, answer] = trace.requests;
    expect(pick.record.response).toBe(TRAIT_LINE);
    expect(pick.record.messages[1].content).toContain('<sections>');
    expect(pick.record.endpoint).toMatchObject({ model: 'm', url: 'https://api.example.com/v1/chat/completions' });
    expect(answer.record.messages.at(-1)?.content).toContain(TRAIT);
    expect(answer.record.response).toBeUndefined();
    expect(answer.record.endpoint).toMatchObject({ model: 'm', maxTokens: 800 });
    expect(answer.samplers).toEqual({ temperature: 0.2, repetitionPenalty: 1 });
    expect(answer.customPrompt).toBe(false);
    expect(trace.preset).toBe('Default');
  });

  it('ends with the answer request filled in: its response and its reasoning', async () => {
    const fetchImpl = replyWith([sseFrame({ reasoning: 'The player asks about traits.' }), ...sseReply('Select **Add Trait**.')]);
    const events = await collect(ask(TRAIT, fetchImpl));
    const trace = lastTrace(events);
    expect(events.at(-1)?.type).toBe('done');
    expect(events.at(-2)?.type).toBe('trace');
    const answer = trace.requests.at(-1)!;
    expect(answer.record.response).toBe('Select **Add Trait**.');
    expect(answer.record.reasoning).toBe('The player asks about traits.');
  });

  it('lists every source that was on, with no sections for one that gave no ranking, and the pick request that found nothing', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    const trace = lastTrace(await collect(ask(TRAIT, fetchImpl)));
    expect(trace.search?.on).toEqual(['keyword', 'aiPicks']);
    const [query] = trace.search!.queries;
    expect(query.sources.map((source) => source.source)).toEqual(['keyword', 'aiPicks']);
    expect(query.sources[0].sections.length).toBeGreaterThan(0);
    expect(query.sources[1].sections).toEqual([]);
    expect(trace.requests.map((request) => request.record.type)).toEqual(['AI Search', 'Answer']);
    expect(trace.requests[0].record.response).toBe(NO_PICK);
  });

  it('ends with the reply in the trace when the model sends an empty answer, before the error', async () => {
    const fetchImpl = replyWith([sseFrame({ reasoning: 'Nothing to say.' }), ...sseReply('')]);
    const events: HelpEvent[] = [];
    await expect((async () => { for await (const event of ask(TRAIT, fetchImpl)) events.push(event); })()).rejects.toThrow('empty answer');
    const answer = lastTrace(events).requests.at(-1)!.record;
    expect(answer.response).toBe('');
    expect(answer.reasoning).toBe('Nothing to say.');
  });

  it('holds one request with no search for a bare question', async () => {
    const fetchImpl = replyWith(sseReply('Light scatters.'));
    const settings = helpSettingsOf({ sources: { keyword: false, aiPicks: false, semantic: false }, openScreen: false });
    const trace = lastTrace(await collect(ask('Why is the sky blue?', fetchImpl, { settings })));
    expect(trace.search).toBeNull();
    expect(trace.sent).toEqual([]);
    expect(trace.requests.map((request) => request.record.type)).toEqual(['Answer']);
  });

  it('names the open screen and its section, and keeps the screen with Use the Open Screen off', async () => {
    const on = lastTrace(await collect(ask('What is this?', replyWith(sseReply('The theme.')), { surface: SURFACE })));
    expect(on).toMatchObject({ surface: 'Settings dialog, Display tab', openScreen: true });
    expect(on.lead?.id).toBe('Settings#display');
    expect(ids(on.sent)).toContain('Settings#display');

    const off = lastTrace(await collect(ask('What is this?', replyWith(sseReply('The theme.')), { surface: SURFACE, settings: helpSettingsOf({ openScreen: false }) })));
    expect(off).toMatchObject({ surface: 'Settings dialog, Display tab', openScreen: false });
    expect(off.lead).toBeUndefined();
  });

  it('marks a request whose prompt differs from the default text, and only that request', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    let presets = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine');
    presets = editHelpPrompt(presets, 'mine', 'answer', `Answer in one line. ${HELP_CHIP.marker}`);
    const trace = lastTrace(await collect(ask(TRAIT, fetchImpl, { settings: helpSettingsOf({ presets }) })));
    expect(trace.preset).toBe('Mine');
    expect(trace.requests.map((request) => request.customPrompt)).toEqual([false, true]);
  });

  it('adds each tool round to the answer request as it ends, in lookup mode', async () => {
    const capable = textSnapshot(textTarget({ reasoning: { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } } }));
    let request = 0;
    const fetchImpl: FetchSpy = vi.fn(async () => sseResponse(request++ === 0
      ? [sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: DOCS_LOOKUP.name, arguments: JSON.stringify({ query: 'stat' }) } }] }), sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n']
      : sseReply('Select **Add Stat**.')));
    const events = await collect(ask(TRAIT, fetchImpl, { settings: helpSettingsOf({ lookup: true }), snapshot: capable }));

    const rounds = traces(events).map((trace) => trace.requests.at(-1)!.record.toolRounds?.length ?? 0);
    expect(rounds[0]).toBe(0);
    expect(rounds.at(-1)).toBe(1);
    const answer = lastTrace(events).requests.at(-1)!.record;
    expect(answer.toolRounds?.[0].calls[0].name).toBe(DOCS_LOOKUP.name);
    expect(answer.response).toBe('Select **Add Stat**.');
  });

  it('keeps each query a follow-up runs, and every sent section in the merged list past the depth', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    const history = [{ question: 'How do I add a stat?', answer: 'Select **Add Stat**.', sources: [index.search('add a stat', 1)[0]] }];
    const trace = lastTrace(await collect(ask('and a trait?', fetchImpl, { history })));
    expect(trace.search?.queries.map((query) => query.query)).toEqual(['and a trait?', 'How do I add a stat? and a trait?']);
    for (const query of trace.search!.queries) {
      expect(query.merged.length).toBeLessThanOrEqual(HELP_TRACE_DEPTH + trace.sent.length);
    }
  });

  it('keeps the answer events and the request bodies as they are without it', async () => {
    const fetchImpl = replyWith(sseReply('Select **Add Trait**.'));
    const events = await collect(ask(TRAIT, fetchImpl));
    const plain = events.filter((event) => event.type !== 'trace' && event.type !== 'stage');
    expect(plain.map((event) => event.type)).toEqual(['answer', 'done']);
    expect(Object.keys(JSON.parse(fetchImpl.mock.calls[0][1].body as string) as object).sort()).toEqual(
      ['max_tokens', 'messages', 'model', 'repeat_penalty', 'repetition_penalty', 'stream', 'temperature'],
    );
  });
});
