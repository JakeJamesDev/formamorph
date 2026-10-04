/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { ROLL } from '@/lib/tools/rollTool';
import { toolSchema } from '@/lib/tools/toolSchema';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_ROLL, HELP_ROLL_CALL_LIMIT } from './helpRoll';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';

const index = createDocsIndex({ pages: { Traits: '# 🧬 Traits\n\nA trait changes a stat.\n\n## How to Add a Trait\n\n1. Select **Add Trait**.\n' } });

const endpoint = (tools: boolean | null) => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools, sources: tools === null ? {} : { tools: 'native' } };
  return textSnapshot(textTarget({ reasoning }));
};
const CAPABLE = endpoint(true);

interface SentMessage { role: string; content: string | null }
interface SentBody { messages: SentMessage[]; tools?: unknown[] }
type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;

const bodyOf = (spy: FetchSpy, request = 0) => JSON.parse(spy.mock.calls[request][1].body as string) as SentBody;
const toolResults = (body: SentBody) => body.messages.filter((message) => message.role === 'tool').map((message) => message.content ?? '');
const toolNames = (body: SentBody) => (body.tools as { function: { name: string } }[] | undefined)?.map((tool) => tool.function.name);

const rollFrames = (...calls: string[]): string[] => [
  ...calls.map((dice, at) => sseFrame({ tool_calls: [{ index: at, id: `srv-${at}`, type: 'function', function: { name: HELP_ROLL.name, arguments: JSON.stringify({ dice }) } }] })),
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
const ask = (fetchImpl: FetchSpy, settings: HelpSettingsChange, over: Partial<HelpQuestion> = {}) =>
  askHelp({ question: 'Roll 2d6+1 for me.', settings: helpSettingsOf({ mascot: false, ...settings }), snapshot: CAPABLE, index, fetchImpl: pastPicks(fetchImpl), ...over });

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

describe('the help dice roll', () => {
  it('reuses the catalog roll’s handler, parameters and empty result under a description with no narration words', () => {
    expect(HELP_ROLL.name).toBe(ROLL.name);
    expect(HELP_ROLL.handler).toBe(ROLL.handler);
    expect(HELP_ROLL.params).toBe(ROLL.params);
    expect(HELP_ROLL.emptyResult).toBe(ROLL.emptyResult);
    expect(HELP_ROLL.id).not.toBe(ROLL.id);
    expect(HELP_ROLL.description).not.toMatch(/narrat|story|scene|outcome|attack|skill check/i);
    expect(ROLL.offeredTo).toEqual(['narration']);
  });

  it('is offered with the retrieval prompt when the lookup is off, and changes nothing else in the request', async () => {
    const rollOn = script(sseReply('Done.'));
    await collect(ask(rollOn, { roll: true }));
    const rollOff = script(sseReply('Done.'));
    await collect(ask(rollOff, {}));

    const { tools, tool_choice: choice, ...rest } = bodyOf(rollOn) as SentBody & { tool_choice?: string };
    expect(tools).toEqual([toolSchema(HELP_ROLL)]);
    expect(choice).toBe('auto');
    expect(rest).toEqual(bodyOf(rollOff));
  });

  it('follows the guide lookup when both are on, under the lookup prompt', async () => {
    const both = script(sseReply('Done.'));
    await collect(ask(both, { roll: true, lookup: true }));
    const lookupOnly = script(sseReply('Done.'));
    await collect(ask(lookupOnly, { lookup: true }));

    expect(toolNames(bodyOf(both))).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name]);
    expect(bodyOf(both).messages).toEqual(bodyOf(lookupOnly).messages);
  });

  it('is no source: with every source off, the question still goes alone, with the roll offered', async () => {
    const off = { sources: { keyword: false, aiPicks: false, semantic: false }, openScreen: false };
    const fetchImpl = script(sseReply('Done.'));
    await collect(ask(fetchImpl, { ...off, roll: true }));
    const body = bodyOf(fetchImpl);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Roll 2d6+1 for me.' });
    expect(toolNames(body)).toEqual([HELP_ROLL.name]);
  });

  it('is not offered when the endpoint is not known to take function calls', async () => {
    for (const tools of [false, null]) {
      const fetchImpl = script(sseReply('Done.'));
      await collect(ask(fetchImpl, { roll: true }, { snapshot: endpoint(tools) }));
      expect(bodyOf(fetchImpl)).not.toHaveProperty('tools');
    }
  });

  it('runs a roll round: the model reads dice, rolls, modifier and total, and the answer follows', async () => {
    const fetchImpl = script(rollFrames('2d6+1'), sseReply('You rolled a total.'));
    const events = await collect(ask(fetchImpl, { roll: true }));

    const [result] = toolResults(bodyOf(fetchImpl, 1));
    const roll = JSON.parse(result) as { dice: string; rolls: number[]; modifier: number; total: number };
    expect(roll.dice).toBe('2d6+1');
    expect(roll.rolls).toHaveLength(2);
    expect(roll.rolls.every((die) => Number.isInteger(die) && die >= 1 && die <= 6)).toBe(true);
    expect(roll.modifier).toBe(1);
    expect(roll.total).toBe(roll.rolls[0] + roll.rolls[1] + 1);
    expect(events.at(-1)).toMatchObject({ type: 'done', text: 'You rolled a total.', stopped: false });
  });

  it('runs a roll call as a roll when the guide lookup is on too', async () => {
    const fetchImpl = script(rollFrames('1d20'), sseReply('Done.'));
    await collect(ask(fetchImpl, { roll: true, lookup: true }));
    const [result] = toolResults(bodyOf(fetchImpl, 1));
    expect(JSON.parse(result)).toMatchObject({ dice: '1d20', modifier: 0 });
  });

  it('answers bad notation with the catalog roll’s text', async () => {
    const fetchImpl = script(rollFrames('two dice'), sseReply('Done.'));
    await collect(ask(fetchImpl, { roll: true }));
    expect(toolResults(bodyOf(fetchImpl, 1))).toEqual(['Unreadable dice notation. Use dice notation like 2d6+1.']);
  });

  it('takes its call limit from the settings, by default the catalog roll’s', async () => {
    const calls = Array.from({ length: HELP_ROLL_CALL_LIMIT + 1 }, () => '1d6');
    const byDefault = script(rollFrames(...calls), sseReply('Done.'));
    await collect(ask(byDefault, { roll: true }));
    const results = toolResults(bodyOf(byDefault, 1));
    expect(results.filter((text) => text.startsWith('{"dice"'))).toHaveLength(HELP_ROLL_CALL_LIMIT);
    expect(results.at(-1)).toContain('limit');

    const limited = script(rollFrames('1d6', '1d6'), sseReply('Done.'));
    await collect(ask(limited, { roll: true, rollCallLimit: 1 }));
    expect(toolResults(bodyOf(limited, 1)).at(-1)).toContain('limit of 1 call');
  });
});
