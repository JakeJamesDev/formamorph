import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, isIntentRequest, isPickRequest, openWorld } from '@/test/helpFixtures';
import type { Entity } from '@/types';
import { DEFAULT_CODE_RIDER, SCRIPT_TAB } from './helpCodeRider';
import { HELP_CODE_TEST } from './helpCodeTest';
import { DOCS_LOOKUP } from './docsLookup';
import { HELP_ROLL } from './helpRoll';
import { NO_WORLD_RIDER, TWO_ASK_RIDER } from './helpIntent';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { HelpTrace } from './helpTrace';
import type { OpenWorld } from './helpWorld';
import { DEFAULT_WORLD_EDITOR_RULES } from './helpWorldRules';
import type { WorldIndexInput } from './worldIndex';

const index = createDocsIndex({
  pages: {
    Entities: '# Entities\n\nAn entity is a character the narrator plays.\n\n## How to Add an Entity\n\n1. Select **Add**.\n',
    'World-Editor-Stats': '# 📊 World Editor Stats\n\nA stat holds a number.\n\n## Scripts\n\nThe **Code** tab holds two boxes.\n',
    ScriptsGuide: '# Scripts Guide\n\nScripts run each turn.\n\n## Quick Reference\n\nThe reference card lists every global.\n',
  },
});

const mara: Entity = { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.' };
const sedge = (): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], traits: [], entities: [mara], items: [], dictionaries: [],
});
const editorWorld: OpenWorld = { ...openWorld(), lean: 'editor', world: sedge };
const CODE_TAB: Surface = { screen: 'worldEditor', dialog: null, tabs: [SCRIPT_TAB] };


type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[]; tools?: { function: { name: string } }[]; response_format?: unknown }

/** The endpoint: the classifier request gets `reply`, the pick request no pick, the answer a short answer. Each request's kind is logged in order. */
function endpoint(reply: string | (() => Promise<Response>) = 'Intent: Help\nSecond ask: no') {
  const order: string[] = [];
  const answers: FetchSpy = vi.fn(async () => sseResponse(sseReply('Done.')));
  const classifier: FetchSpy = vi.fn(async () => (typeof reply === 'function' ? reply() : sseResponse(sseReply(reply))));
  const picks: FetchSpy = vi.fn(async () => sseResponse(sseReply('No section of the list answers the question.')));
  const fetchImpl = ((url: string, init: RequestInit) => {
    const kind = isIntentRequest(init) ? 'classifier' : isPickRequest(init) ? 'pick' : 'answer';
    order.push(kind);
    return { classifier, pick: picks, answer: answers }[kind](url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, answers, classifier, picks, order };
}

const bodyOf = (spy: FetchSpy, call = 0) => JSON.parse(spy.mock.calls[call][1].body as string) as SentBody;
const userOf = (spy: FetchSpy) => bodyOf(spy).messages.at(-1)!.content;
const toolNames = (spy: FetchSpy) => (bodyOf(spy).tools ?? []).map((tool) => tool.function.name);

const capability = (over: Partial<ReasoningCapability> = {}): ReasoningCapability => ({ ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' }, ...over });

async function ask(fetchImpl: typeof fetch, settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}, reasoning = capability()) {
  const events: HelpEvent[] = [];
  const tool = helpTool();
  for await (const event of askHelp({
    question: 'Who keeps the gate?',
    settings: helpSettingsOf({
      intentClassifier: true, mascot: true, roll: true, sources: { keyword: true, aiPicks: true, semantic: false },
      tools: [tool], toolSwitches: { [tool.id]: true }, ...settings,
    }),
    snapshot: textSnapshot(textTarget({ reasoning })),
    index,
    world: editorWorld,
    fetchImpl,
    ...over,
  })) events.push(event);
  return events;
}

const lastTrace = (events: HelpEvent[]) => events.filter((event): event is { type: 'trace'; trace: HelpTrace } => event.type === 'trace').at(-1)!.trace;

/** The answer body of the same question with the switch off: today's full request. */
async function fullBody(settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}, reasoning?: ReasoningCapability) {
  const off = endpoint();
  await ask(off.fetchImpl, { ...settings, intentClassifier: false }, over, reasoning);
  expect(off.classifier).not.toHaveBeenCalled();
  return bodyOf(off.answers);
}

describe('the Intent plans', () => {
  it('sends Chat the question alone, with the face call and the roll but no Tool, guide, world or lookup', async () => {
    const { fetchImpl, answers, picks } = endpoint('Intent: Chat\nSecond ask: no');
    await ask(fetchImpl, { lookup: true });
    expect(userOf(answers)).toBe('Who keeps the gate?');
    expect(toolNames(answers).sort()).toEqual(['set_face', HELP_ROLL.name].sort());
    // The picks still went out (Q59); the answer drops them.
    expect(picks).toHaveBeenCalled();
  });

  it('sends Help the guide and the world with no code rider, code test or Quick Reference, even for a question with code words', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Help\nSecond ask: no');
    await ask(fetchImpl, { lookup: true }, { question: 'Who keeps the gate, and can stats.Hunger drain?' });
    const message = userOf(answers);
    expect(message).toContain('<guide>');
    expect(message).toContain('A widow who keeps the gate.');
    expect(message).not.toContain(DEFAULT_CODE_RIDER);
    expect(message).not.toContain('The reference card lists every global.');
    expect(message.endsWith(DEFAULT_WORLD_EDITOR_RULES)).toBe(true);
    expect(toolNames(answers)).toContain(DOCS_LOOKUP.name);
    expect(toolNames(answers)).not.toContain(HELP_CODE_TEST.name);
    expect(toolNames(answers)).toContain(helpTool().name);
  });

  it('sends no code rider to a Help question from an open Code tab', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Help\nSecond ask: no');
    await ask(fetchImpl, {}, { surface: CODE_TAB });
    expect(userOf(answers)).not.toContain(DEFAULT_CODE_RIDER);
  });

  it('sends Code the code rider, the Quick Reference and the code test for a question with no code words', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Code\nSecond ask: no');
    await ask(fetchImpl);
    const message = userOf(answers);
    expect(message).toContain(DEFAULT_CODE_RIDER);
    expect(message).toContain('The reference card lists every global.');
    expect(toolNames(answers)).toContain(HELP_CODE_TEST.name);
    expect(toolNames(answers)).toContain(helpTool().name);
  });

  it('sends Code the same body as a code-word question gets with the switch off', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Code\nSecond ask: no');
    const question = { question: 'How do stats.Hunger scripts work?' };
    await ask(fetchImpl, {}, question);
    expect(bodyOf(answers)).toEqual(await fullBody({}, question));
  });

  it('sends World the world block and its rules with no guide, docs lookup or code', async () => {
    const { fetchImpl, answers } = endpoint('Intent: World\nSecond ask: no');
    await ask(fetchImpl, { lookup: true });
    const message = userOf(answers);
    expect(message).not.toContain('<guide>');
    expect(message).toContain('A widow who keeps the gate.');
    expect(message).toContain('Answer the question from the world sections above.');
    expect(message.endsWith(DEFAULT_WORLD_EDITOR_RULES)).toBe(true);
    expect(toolNames(answers)).not.toContain(DOCS_LOOKUP.name);
    expect(toolNames(answers)).not.toContain(HELP_CODE_TEST.name);
  });

  it('sends World with no world open no world block, and the no-world rider', async () => {
    const { fetchImpl, answers } = endpoint('Intent: World\nSecond ask: no');
    await ask(fetchImpl, {}, { world: undefined });
    const message = userOf(answers);
    expect(message).not.toContain('<world>');
    expect(message).not.toContain('<guide>');
    expect(message.endsWith(NO_WORLD_RIDER)).toBe(true);
  });

  it('sends World with Read the World off the full request', async () => {
    const { fetchImpl, answers } = endpoint('Intent: World\nSecond ask: no');
    await ask(fetchImpl, { readWorld: false });
    expect(bodyOf(answers)).toEqual(await fullBody({ readWorld: false }));
  });

  it('adds the two-ask rider last when the reply marks a second ask', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Help\nSecond ask: yes');
    await ask(fetchImpl);
    expect(userOf(answers).endsWith(TWO_ASK_RIDER)).toBe(true);
    const chat = endpoint('Intent: Chat\nSecond ask: yes');
    await ask(chat.fetchImpl);
    expect(userOf(chat.answers)).toBe(`Who keeps the gate?\n\n${TWO_ASK_RIDER}`);
  });
});

describe('the fallback to the full request', () => {
  it.each([
    ['an unknown label', 'Intent: Lore\nSecond ask: no'],
    ['a reply with no label', 'I think this is about the gate.'],
    ['Create, until it has its own request', 'Intent: Create\nSecond ask: no'],
  ])('sends %s the body the switch-off question gets', async (_case, reply) => {
    const { fetchImpl, answers } = endpoint(reply);
    await ask(fetchImpl);
    expect(bodyOf(answers)).toEqual(await fullBody());
  });

  it('sends the full request when the classifier request fails', async () => {
    const { fetchImpl, answers } = endpoint(async () => new Response('down', { status: 500 }));
    await ask(fetchImpl);
    expect(bodyOf(answers)).toEqual(await fullBody());
  });
});

describe('the classifier request', () => {
  it('goes out with the picks before either returns, and the answer waits for all three', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const { fetchImpl, order, picks } = endpoint(async () => {
      await held;
      return sseResponse(sseReply('Intent: Chat\nSecond ask: no'));
    });
    const asked = ask(fetchImpl);
    await vi.waitFor(() => expect(picks).toHaveBeenCalled());
    expect(order).toEqual(['classifier', 'pick', 'pick']);
    release();
    await asked;
    expect(order).toEqual(['classifier', 'pick', 'pick', 'answer']);
  });

  it('reads the question, the last exchange and the open screen', async () => {
    const { fetchImpl, classifier } = endpoint();
    await ask(fetchImpl, {}, { surface: CODE_TAB, history: [{ question: 'Who is Mara?', answer: 'The gate widow.' }], question: 'yes, do it' });
    const message = userOf(classifier);
    expect(message).toContain("The player's earlier question: Who is Mara?");
    expect(message).toContain('The earlier answer:\nThe gate widow.');
    expect(message).toContain('The player asks from this screen:');
    expect(message.endsWith('Message: yes, do it')).toBe(true);
  });

  it('sends the schema where the endpoint accepts one, and the schema reply reaches the plan the prompted label does', async () => {
    const schema = endpoint('{"intent":"World","secondAsk":"yes"}');
    await ask(schema.fetchImpl);
    expect(bodyOf(schema.classifier).response_format).toMatchObject({ type: 'json_schema' });
    const prompted = endpoint('Intent: World\nSecond ask: yes');
    await ask(prompted.fetchImpl, {}, {}, capability({ structuredOutput: false }));
    expect(bodyOf(prompted.classifier).response_format).toBeUndefined();
    expect(userOf(prompted.answers)).toBe(userOf(schema.answers));
    expect(userOf(prompted.answers).endsWith(TWO_ASK_RIDER)).toBe(true);
  });

  it('sends the request once more without the schema when the endpoint refuses it', async () => {
    let call = 0;
    const { fetchImpl, classifier, answers } = endpoint(async () => (call++ === 0
      ? new Response(JSON.stringify({ error: { message: 'response_format is not supported', param: 'response_format' } }), { status: 400 })
      : sseResponse(sseReply('Intent: Chat\nSecond ask: no'))));
    await ask(fetchImpl);
    expect(classifier).toHaveBeenCalledTimes(2);
    expect(bodyOf(classifier, 1).response_format).toBeUndefined();
    expect(userOf(answers)).toBe('Who keeps the gate?');
  });

  it('reads the last exchange with History Length 0', async () => {
    const { fetchImpl, classifier, answers } = endpoint();
    await ask(fetchImpl, { historyLength: 0 }, { history: [{ question: 'Who is Mara?', answer: 'The gate widow.' }], question: 'and her key?' });
    expect(userOf(classifier)).toContain("The player's earlier question: Who is Mara?");
    expect(bodyOf(answers).messages.map((message) => message.content)).not.toContain('Who is Mara?');
  });

  it('does not go out with the switch off', async () => {
    const { fetchImpl, classifier, answers } = endpoint();
    const events = await ask(fetchImpl, { intentClassifier: false });
    expect(classifier).not.toHaveBeenCalled();
    expect(answers).toHaveBeenCalledTimes(1);
    expect(lastTrace(events).intent).toBeUndefined();
    expect(lastTrace(events).requests.map((request) => request.record.type)).toEqual(['AI Search', 'AI World Search', 'Answer']);
  });

  it('puts the Intent and the classifier request in the trace, and null for an unclear reply', async () => {
    const { fetchImpl } = endpoint('Intent: World\nSecond ask: no');
    const trace = lastTrace(await ask(fetchImpl));
    expect(trace.intent).toBe('World');
    expect(trace.requests.map((request) => request.record.type)).toEqual(['Sorting', 'AI Search', 'AI World Search', 'Answer']);
    expect(trace.requests[0].record.response).toContain('Intent: World');
    const unclear = endpoint('Maybe.');
    expect(lastTrace(await ask(unclear.fetchImpl)).intent).toBeNull();
  });
});
