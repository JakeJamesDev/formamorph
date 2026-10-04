// The player's Formaquestion Tools in a help question: offered on the capability gate with the lookup or
// without it, run on the open world's snapshot or on none, and the answer follows the tool round.
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { toolSchema } from '@/lib/tools/toolSchema';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';

const index = createDocsIndex({ pages: { Traits: '# Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });

const endpoint = (tools: boolean) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};

const FIND_PERSON = helpTool();
const WEATHER = helpTool({ id: 'h-2', name: 'weather', description: 'The weather.', params: [], handler: { kind: 'template', body: 'Clear.' }, emptyResult: 'Unknown.' });

interface SentMessage { role: string; content: string | null; tool_calls?: { function: { name: string; arguments: string } }[] }
interface SentBody { messages: SentMessage[]; tools?: { function: { name: string } }[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const toolNames = (body: SentBody) => body.tools?.map((tool) => tool.function.name);
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');

const callFrames = (name: string, args: unknown): string[] => [
  sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name, arguments: JSON.stringify(args) } }] }),
  sseFrame({}, 'tool_calls'),
  'data: [DONE]\n\n',
];

const script = (...replies: string[][]): FetchSpy => {
  let request = 0;
  return vi.fn(async () => {
    const reply = replies[request++];
    if (!reply) throw new Error(`request ${request} has no scripted reply`);
    return sseResponse(reply);
  });
};

// The Mascot is off, so the face call stays out of the offered functions.
const settings = (change: HelpSettingsChange = {}) => helpSettingsOf({ tools: [FIND_PERSON, WEATHER], toolSwitches: { 'h-1': true }, mascot: false, ...change });

const ask = (fetchImpl: FetchSpy, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question: 'Who is Wren?', settings: settings(), snapshot: endpoint(true), index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

describe('the Formaquestion Tools in a help request', () => {
  it('sends the Tools that are on, and not the ones that are off', async () => {
    const fetchImpl = script(sseReply('Wren sells lanterns.'));
    await collect(ask(fetchImpl));
    expect(bodyOf(fetchImpl).tools).toEqual([toolSchema(FIND_PERSON)]);
  });

  it('sends none when every switch is off, and the request equals one with no Tools', async () => {
    const off = script(sseReply('Wren sells lanterns.'));
    await collect(ask(off, { settings: settings({ toolSwitches: {} }) }));
    const none = script(sseReply('Wren sells lanterns.'));
    await collect(ask(none, { settings: settings({ tools: [], toolSwitches: {} }) }));
    expect(bodyOf(off).tools).toBeUndefined();
    expect(bodyOf(off)).toEqual(bodyOf(none));
  });

  it('sends none to an endpoint that takes no function calls', async () => {
    const fetchImpl = script(sseReply('Wren sells lanterns.'));
    await collect(ask(fetchImpl, { snapshot: endpoint(false) }));
    expect(bodyOf(fetchImpl).tools).toBeUndefined();
  });

  it('goes with the guide lookup when that is on, lookup first, and with the retrieval prompt when it is off', async () => {
    const withLookup = script(sseReply('Wren sells lanterns.'));
    await collect(ask(withLookup, { settings: settings({ lookup: true }) }));
    expect(toolNames(bodyOf(withLookup))).toEqual([DOCS_LOOKUP.name, FIND_PERSON.name]);
    expect(bodyOf(withLookup).messages[0].content).toContain(DOCS_LOOKUP.name);

    const retrieval = script(sseReply('Wren sells lanterns.'));
    await collect(ask(retrieval));
    const plain = script(sseReply('Wren sells lanterns.'));
    await collect(ask(plain, { settings: settings({ tools: [], toolSwitches: {} }) }));
    expect(toolNames(bodyOf(retrieval))).toEqual([FIND_PERSON.name]);
    expect(bodyOf(retrieval).messages).toEqual(bodyOf(plain).messages);
  });

  it('runs a Tool round on the open world and the answer follows it', async () => {
    const fetchImpl = script(callFrames(FIND_PERSON.name, { name: 'Wren' }), sseReply('Wren is a trader.'));
    const events = await collect(ask(fetchImpl, { world: sampleToolSnapshot }));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const second = bodyOf(fetchImpl, 1);
    expect(second.messages.at(-2)?.tool_calls?.[0].function).toEqual({ name: FIND_PERSON.name, arguments: '{"name":"Wren"}' });
    const [result] = toolResults(second);
    expect(JSON.parse(result)).toMatchObject({ matches: [{ id: 'wren', name: 'Wren' }] });
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Wren is a trader.', stopped: false });
  });

  it('runs a Tool on an empty snapshot with no world open, so a lookup returns its empty result', async () => {
    const fetchImpl = script(callFrames(FIND_PERSON.name, { name: 'Wren' }), sseReply('The guide names no Wren.'));
    await collect(ask(fetchImpl));
    expect(toolResults(bodyOf(fetchImpl, 1))).toEqual([FIND_PERSON.emptyResult]);
  });

  it('builds the world snapshot once per question, at the first call', async () => {
    const world = vi.fn(sampleToolSnapshot);
    const fetchImpl = script(
      [
        sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: FIND_PERSON.name, arguments: '{"name":"Wren"}' } }] }),
        sseFrame({ tool_calls: [{ index: 1, id: 'srv-1', type: 'function', function: { name: WEATHER.name, arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ],
      sseReply('Wren, under a clear sky.'),
    );
    await collect(ask(fetchImpl, { world, settings: settings({ toolSwitches: { 'h-1': true, 'h-2': true } }) }));
    expect(world).toHaveBeenCalledTimes(1);
    expect(toolResults(bodyOf(fetchImpl, 1))[1]).toBe('Clear.');
  });

  it('routes a lookup call to the guide and a Tool call to the world in one round', async () => {
    const fetchImpl = script(
      [
        sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: DOCS_LOOKUP.name, arguments: '{"search":"trait"}' } }] }),
        sseFrame({ tool_calls: [{ index: 1, id: 'srv-1', type: 'function', function: { name: FIND_PERSON.name, arguments: '{"name":"Bell"}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ],
      sseReply('Bell, and a trait.'),
    );
    const events = await collect(ask(fetchImpl, { world: sampleToolSnapshot, settings: settings({ lookup: true }) }));
    const [guide, person] = toolResults(bodyOf(fetchImpl, 1));
    expect(guide).toContain('<section id="Traits#how-to-add-a-trait">');
    expect(JSON.parse(person)).toMatchObject({ matches: [{ id: 'bell' }] });
    const done = events.at(-1);
    expect(done?.type === 'done' && done.sources.map((section) => section.id)).toContain('Traits#how-to-add-a-trait');
  });
});
