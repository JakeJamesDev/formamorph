/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, mascotStoreOf, pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_FACE } from './helpFace';
import { HELP_ROLL } from './helpRoll';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import { DEFAULT_MASCOT_RIG, type MascotRig } from './mascot';

const index = createDocsIndex({ pages: { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });

const endpoint = (tools: boolean | null) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: tools === null ? {} : { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};
const CAPABLE = endpoint(true);

/** The default rig's faces, in list order. */
const EXPRESSIONS = ['Happy', 'Excited', 'Surprised', 'Pondering', 'Confused', 'Sad', 'Sleepy', 'Smitten', 'Dizzy', 'Wink', 'Flustered', 'Unimpressed'];

/** The default rig with the layers `ids` switched off. */
const without = (...ids: string[]): MascotRig => ({
  ...DEFAULT_MASCOT_RIG,
  layers: DEFAULT_MASCOT_RIG.layers.map((row) => (ids.includes(row.id) ? { ...row, enabled: false } : row)),
});

interface FunctionSchema { function: { name: string; parameters: { properties: Record<string, { enum?: string[] }>; required: string[] } } }
interface SentBody { messages: { role: string; content: string | null }[]; tools?: FunctionSchema[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const toolNames = (body: SentBody) => body.tools?.map((tool) => tool.function.name);
const faceSchema = (body: SentBody) => body.tools?.find((tool) => tool.function.name === HELP_FACE.name);
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');

const faceFrames = (...faces: string[]): string[] => [
  ...faces.map((face, at) => sseFrame({ tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: HELP_FACE.name, arguments: JSON.stringify({ face }) } }] })),
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

const ask = (fetchImpl: FetchSpy, settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question: 'How do I add a trait?', settings: helpSettingsOf(settings), snapshot: CAPABLE, index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const faceEvents = (events: HelpEvent[]) => events.filter((event) => event.type === 'face');

describe('the face call', () => {
  it('is offered with the Mascot on, with the enabled expressions as its enum, in list order', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask(fetchImpl));
    const schema = faceSchema(bodyOf(fetchImpl))!;
    expect(schema.function.parameters.properties.face.enum).toEqual(EXPRESSIONS);
    expect(schema.function.parameters.required).toEqual(['face']);
  });

  it('drops a disabled expression from its enum', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask(fetchImpl, { mascotPresets: mascotStoreOf(without('happy', 'wink')) }));
    expect(faceSchema(bodyOf(fetchImpl))!.function.parameters.properties.face.enum).toEqual(EXPRESSIONS.filter((name) => name !== 'Happy' && name !== 'Wink'));
  });

  it('is not offered with the Mascot off, and the request then equals one with every expression disabled', async () => {
    const off = script(sseReply('Select **Add Trait**.'));
    await collect(ask(off, { mascot: false }));
    const noFaces = script(sseReply('Select **Add Trait**.'));
    const expressionIds = DEFAULT_MASCOT_RIG.layers.filter((row) => row.kind === 'expression').map((row) => row.id);
    // A blank Voice keeps the Voice chip out, so the two requests can differ only by the face call.
    await collect(ask(noFaces, { mascotPresets: mascotStoreOf({ ...without(...expressionIds), voice: '' }) }));
    expect(bodyOf(off)).not.toHaveProperty('tools');
    expect(bodyOf(noFaces)).toEqual(bodyOf(off));
  });

  it('is not offered when the endpoint is not known to take function calls', async () => {
    for (const tools of [false, null]) {
      const fetchImpl = script(sseReply('Select **Add Trait**.'));
      await collect(ask(fetchImpl, {}, { snapshot: endpoint(tools) }));
      expect(bodyOf(fetchImpl)).not.toHaveProperty('tools');
    }
  });

  it('follows the guide lookup and the dice roll, ahead of the player’s Tools', async () => {
    const fetchImpl = script(sseReply('Select **Add Trait**.'));
    await collect(ask(fetchImpl, { lookup: true, roll: true, tools: [helpTool()], toolSwitches: { 'h-1': true } }));
    expect(toolNames(bodyOf(fetchImpl))).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, HELP_FACE.name, helpTool().name]);
  });

  it('yields a face event with the layer id, and the trace records the call', async () => {
    const fetchImpl = script(faceFrames('Happy'), sseReply('Select **Add Trait**.'));
    const events = await collect(ask(fetchImpl));

    expect(faceEvents(events)).toEqual([{ type: 'face', face: 'happy' }]);
    expect(toolResults(bodyOf(fetchImpl, 1))).toEqual([JSON.stringify({ face: 'Happy' })]);
    const trace = events.filter((event) => event.type === 'trace').at(-1)!.trace;
    const [round] = trace.requests.at(-1)!.record.toolRounds!;
    expect(round.calls.map((call) => [call.name, call.arguments])).toEqual([[HELP_FACE.name, JSON.stringify({ face: 'Happy' })]]);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
  });

  it('yields one face event per call, in call order, across rounds', async () => {
    const fetchImpl = script(faceFrames('Happy', 'Wink'), faceFrames('Sad'), sseReply('Select **Add Trait**.'));
    const events = await collect(ask(fetchImpl));
    expect(faceEvents(events).map((event) => event.face)).toEqual(['happy', 'wink', 'sad']);
  });

  it('answers a face that is not offered with an error, and yields no face event', async () => {
    const fetchImpl = script(faceFrames('Happy'), sseReply('Select **Add Trait**.'));
    const events = await collect(ask(fetchImpl, { mascotPresets: mascotStoreOf(without('happy')) }));
    expect(faceEvents(events)).toEqual([]);
    expect(toolResults(bodyOf(fetchImpl, 1))[0]).toContain('"error"');
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'Select **Add Trait**.' });
  });
});
