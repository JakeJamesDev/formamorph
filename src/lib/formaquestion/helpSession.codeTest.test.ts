/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { emptyCodeWorld, openWorld, pastPicks } from '@/test/helpFixtures';
import type { Stat } from '@/types';
import { HELP_CODE_TEST, HELP_CODE_TEST_CALL_LIMIT } from './helpCodeTest';
import type { CodeTestResult } from './helpCodeTestRun';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { HelpTrace } from './helpTrace';

const index = createDocsIndex({ pages: { StatCodeGuide: '# Stat Code\n\nCode sets a stat.\n\n## Quick Reference\n\nRead a stat through `.value`.\n' } });

const endpoint = (tools: boolean | null) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: tools === null ? {} : { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};
const CAPABLE = endpoint(true);

const CODE_QUESTION = 'Write stat code that switches Brave on when my Courage reaches 50.';

interface SentMessage { role: string; content: string | null }
interface SentBody { messages: SentMessage[]; tools?: unknown[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');
const toolNames = (body: SentBody) => (body.tools as { function: { name: string } }[] | undefined)?.map((tool) => tool.function.name) ?? [];
const results = (spy: FetchSpy) => toolResults(bodyOf(spy, 1)).map((text) => JSON.parse(text) as CodeTestResult & { error?: string });

interface TestCall { code: string; box?: 'before' | 'after'; stat?: string }
const testFrames = (...calls: TestCall[]): string[] => [
  ...calls.map(({ code, box = 'before', stat = 'Courage' }, at) => sseFrame({
    tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: HELP_CODE_TEST.name, arguments: JSON.stringify({ code, box, stat }) } }],
  })),
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

const stat = (name: string, value: number): Stat => ({ id: name.toLowerCase(), name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });

const sedge = (): StatCodeWorld => ({
  ...emptyCodeWorld(),
  stats: [stat('Courage', 40), stat('Int', 32)],
  traits: [{ id: 'brave', name: 'Brave', statChanges: [] }],
});

// The Mascot is off, so the face call stays out of the offered functions.
const ask = (fetchImpl: FetchSpy, settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question: CODE_QUESTION, settings: helpSettingsOf({ mascot: false, ...settings }), snapshot: CAPABLE, index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

describe('the code test offer', () => {
  it('goes to a code turn on an endpoint that takes function calls, with its call limit', async () => {
    const fetchImpl = script(sseReply('Done.'));
    await collect(ask(fetchImpl));
    const offered = bodyOf(fetchImpl).tools as { function: { name: string } }[];
    expect(offered.map((tool) => tool.function.name)).toEqual([HELP_CODE_TEST.name]);
  });

  it('describes pending writes as no error', () => {
    expect(HELP_CODE_TEST.description).toMatch(/A pending write .*It is not an error/);
  });

  it('stays out with its switch off, on a turn that is not a code turn, and on an endpoint without function calls', async () => {
    const off = script(sseReply('Done.'));
    await collect(ask(off, { codeTest: false }));
    expect(toolNames(bodyOf(off))).toEqual([]);

    const plain = script(sseReply('Done.'));
    await collect(ask(plain, {}, { question: 'How do I add a trait?' }));
    expect(toolNames(bodyOf(plain))).toEqual([]);

    for (const tools of [false, null]) {
      const unsupported = script(sseReply('Done.'));
      await collect(ask(unsupported, {}, { snapshot: endpoint(tools) }));
      expect(toolNames(bodyOf(unsupported))).toEqual([]);
    }
  });
});

describe('a code test call', () => {
  it('returns the analysis, the run, its writes and its dropped writes, and leaves the world as it was', async () => {
    const world = sedge();
    const before = structuredClone(world);
    const authored = vi.fn(() => world);
    const code = [
      'traits.Brave.enabled = stats.Courage.value >= 30;',
      'traits.Seasoned.enabled = true;',
      'self.value = 7;',
      'const wit = stats.Wisdom;',
    ].join('\n');
    const fetchImpl = script(testFrames({ code, stat: 'Int' }, { code: 'return self.value + 1;', box: 'after' }), sseReply('Here is your code.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, authored) }));

    const [first, second] = results(fetchImpl);
    expect(first.world).toBe(true);
    expect(first.errors).toEqual([
      { line: 2, text: 'Seasoned', message: 'No trait is named “Seasoned”.' },
      { line: 4, text: 'Wisdom', message: 'No stat is named “Wisdom”.' },
    ]);
    expect(first.run).toEqual({
      error: null,
      value: 7,
      writes: ['Brave switched on'],
      pending: [],
      dropped: ['Unknown trait names. Writes ignored: Seasoned.'],
    });
    expect(second.run).toMatchObject({ error: null, value: 41 });
    expect(world).toEqual(before);
    expect(authored).toHaveBeenCalledTimes(1);
  });

  it('lists a persona switch on a trait a playable entity holds as pending, and drops one on any other name', async () => {
    // Wren can be played and Ash cannot, and Brave is the world's own.
    const world: StatCodeWorld = {
      ...sedge(),
      entities: [
        { id: 'wren', name: 'Wren', persona: true, traits: [{ id: 'seasoned', name: 'Seasoned', statChanges: [] }] },
        { id: 'ash', name: 'Ash', traits: [{ id: 'loyal', name: 'Loyal', statChanges: [] }] },
      ],
    };
    const code = [
      'persona.traits.Seasoned.enabled = clock.day > 14;',
      'persona.traits.Loyal.enabled = true;',
      'persona.traits.Brave.enabled = true;',
      'persona.traits.Seasoned.acquired = true;',
    ].join('\n');
    const fetchImpl = script(testFrames({ code }), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));

    const [result] = results(fetchImpl);
    expect(result.run).toEqual({
      error: null,
      value: null,
      writes: [],
      pending: ['persona.traits.Seasoned switched off'],
      dropped: [
        'Unknown trait names. Writes ignored: persona.traits.Loyal, persona.traits.Brave.',
        'acquired is read-only. Writes ignored: persona.traits.Seasoned.',
      ],
    });
  });

  it('lists no pending writes on a run that throws', async () => {
    const world: StatCodeWorld = {
      ...sedge(),
      entities: [{ id: 'wren', name: 'Wren', persona: true, traits: [{ id: 'seasoned', name: 'Seasoned', statChanges: [] }] }],
    };
    const fetchImpl = script(testFrames({ code: 'persona.traits.Seasoned.enabled = true;\nreturn wisdom.value;' }), sseReply('Fixed.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, () => world) }));
    const [result] = results(fetchImpl);
    expect(result.run).toMatchObject({ error: expect.any(String), writes: [], pending: [] });
  });

  it('reports a run that throws, with no writes', async () => {
    const fetchImpl = script(testFrames({ code: 'traits.Brave.enabled = true;\nreturn wisdom.value;' }), sseReply('Fixed.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    const [result] = results(fetchImpl);
    expect(result.run?.error).toEqual(expect.any(String));
    expect(result.run?.writes).toEqual([]);
  });

  it('reads an unknown stat as a blank self', async () => {
    const fetchImpl = script(testFrames({ code: 'return self.value + 1;', stat: 'Nope' }, { code: 'return self.value + 1;', stat: '' }), sseReply('Done.'));
    await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    expect(results(fetchImpl).map((result) => result.run?.value)).toEqual([1, 1]);
  });

  it('with no world open, skips the name checks and the run and still reports syntax, clock and comparison errors', async () => {
    const fetchImpl = script(
      testFrames(
        { code: 'if (stats.Wisdom.value > 3 && clock.time >= 20) traits.Nope.enabled = true;\nreturn stats.Courage >= 50 ? 1 : 0;' },
        { code: 'return (;' },
      ),
      sseReply('Done.'),
    );
    await collect(ask(fetchImpl));
    const [names, syntax] = results(fetchImpl);
    expect(names).toMatchObject({ world: false, run: null });
    expect(names.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('clock has no field “time”'),
      expect.stringContaining('stats.Courage is a whole stat, not a number'),
    ]);
    expect(JSON.stringify(names)).not.toMatch(/Wisdom|Nope/);
    expect(syntax.errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('Syntax error') }));
  });

  it('holds to 3 calls a question by default, and to the call limit setting', async () => {
    expect(HELP_CODE_TEST_CALL_LIMIT).toBe(3);
    const calls = Array.from({ length: 4 }, () => ({ code: 'return 1;' }));
    const byDefault = script(testFrames(...calls), sseReply('Done.'));
    await collect(ask(byDefault));
    const defaults = toolResults(bodyOf(byDefault, 1));
    expect(defaults.slice(0, 3).every((text) => JSON.parse(text).world === false)).toBe(true);
    expect(defaults[3]).toContain(`${HELP_CODE_TEST.name} has reached its limit of 3 calls`);

    const limited = script(testFrames(...calls.slice(0, 2)), sseReply('Done.'));
    await collect(ask(limited, { codeTestCallLimit: 1 }));
    expect(toolResults(bodyOf(limited, 1))[1]).toContain(`${HELP_CODE_TEST.name} has reached its limit of 1 call`);
  });

  it('shows each call and its result in the tool rounds of the trace', async () => {
    const fetchImpl = script(testFrames({ code: 'return 1;' }), sseReply('Done.'));
    const events = await collect(ask(fetchImpl, {}, { world: openWorld(undefined, sedge) }));
    const traces = events.flatMap((event): HelpTrace[] => (event.type === 'trace' ? [event.trace] : []));
    const [round] = traces.at(-1)!.requests.at(-1)!.record.toolRounds ?? [];
    expect(round.calls).toEqual([expect.objectContaining({ name: HELP_CODE_TEST.name, result: expect.stringContaining('"world":true') })]);
  });
});
