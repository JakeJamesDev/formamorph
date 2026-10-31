import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, isIntentRequest, isPickRequest, openWorld } from '@/test/helpFixtures';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Entity, EntityGroup, Placeholder } from '@/types';
import { ENTITY_RIDER, entityAddNote } from './entityBlock';
import { createContextOf, createUserMessage } from './helpCreate';
import { HELP_ROLL } from './helpRoll';
import { CREATE_REFUSAL_RIDER, TWO_ASK_RIDER } from './helpIntent';
import { DEFAULT_HELP_OPTIONS } from './helpPresets';
import { DEFAULT_HELP_PROMPTS, helpSystemPrompt, worldNamesLine } from './helpPrompt';
import { renderHelpPrompt } from './helpChips';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { HelpTrace } from './helpTrace';
import type { OpenWorld } from './helpWorld';
import type { WorldIndexInput } from './worldIndex';
import { DEFAULT_MASCOT_RIG } from './mascot';
import { DEFAULT_MASCOT_NAME } from './mascotPresets';

const index = createDocsIndex({ pages: { Entities: '# Entities\n\nAn entity is a character the narrator plays.\n\n## How to Add an Entity\n\n1. Select **Add**.\n' } });

const GATE: EntityGroup = { id: 'gate', name: 'Gate', parentId: null, order: 0 };
// Authored order differs from the Entities tab's: the folder comes first there, and Bram has no AI Description.
const entities: Entity[] = [
  { id: 'oren', name: 'Oren', playerDescription: '', aiDescription: 'A ferryman who counts every coin twice.', groupId: null, order: 2 },
  { id: 'bram', name: 'Bram', playerDescription: '', aiDescription: '', groupId: 'gate', order: 0 },
  { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.', groupId: 'gate', order: 1 },
  { id: 'tess', name: 'Tess', playerDescription: '', aiDescription: 'A reed cutter who sings to the eels.', groupId: null, order: 3 },
];
const sedge = (): WorldIndexInput => ({
  worldOverview: { name: 'Sedge Landing', description: 'A fen town on stilts.', author: '', thumbnail: null, bgm: null, systemPrompt: 'Secret narrator notes.', tags: [] },
  stats: [], locations: [], traits: [], entities, entityGroups: [GATE], items: [], dictionaries: [],
});
const editorWorld: OpenWorld = { ...openWorld(), lean: 'editor', world: sedge };

const QUESTION = 'Make me a gate guard.';
const CONTEXT_MESSAGE = createUserMessage(QUESTION, {
  name: 'Sedge Landing',
  description: 'A fen town on stilts.',
  entityNames: ['Bram', 'Mara', 'Oren', 'Tess'],
  samples: [
    { name: 'Mara', aiDescription: 'She hides the key under the shrine.' },
    { name: 'Oren', aiDescription: 'A ferryman who counts every coin twice.' },
  ],
});
const CREATE_PROMPT = renderHelpPrompt(DEFAULT_HELP_PROMPTS.create, { voice: DEFAULT_MASCOT_RIG.voice, name: DEFAULT_MASCOT_NAME });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[]; tools?: { function: { name: string } }[]; temperature?: number; max_tokens?: number }

/** The endpoint: the classifier request gets `reply`, the pick request no pick, the answer a short answer. */
function endpoint(reply = 'Intent: Create\nSecond ask: no') {
  const answers: FetchSpy = vi.fn(async () => sseResponse(sseReply('Done.')));
  const classifier: FetchSpy = vi.fn(async () => sseResponse(sseReply(reply)));
  const fetchImpl = ((url: string, init: RequestInit) => {
    if (isIntentRequest(init)) return classifier(url, init);
    if (isPickRequest(init)) return sseResponse(sseReply('No section of the list answers the question.'));
    return answers(url, init);
  }) as unknown as typeof fetch;
  return { fetchImpl, answers, classifier };
}

const bodyOf = (spy: FetchSpy) => JSON.parse(spy.mock.calls[0][1].body as string) as SentBody;
const userOf = (spy: FetchSpy) => bodyOf(spy).messages.at(-1)!.content;
const systemOf = (spy: FetchSpy) => bodyOf(spy).messages[0].content;
const toolNames = (spy: FetchSpy) => (bodyOf(spy).tools ?? []).map((tool) => tool.function.name);

const capability = (): ReasoningCapability => ({ ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } });

/** A snapshot whose `creator` preset sends to its own URL; every other route goes to the answer URL. */
const routedSnapshot = () => {
  const answer = textTarget({ reasoning: capability() });
  const creator = { ...answer, url: 'https://creator.example.com/v1/chat/completions' };
  return { ...textSnapshot(answer), resolveTarget: (_kind: string, routes: readonly string[] = []) => (routes[0] === 'creator' ? creator : answer) } as HelpQuestion['snapshot'];
};

async function ask(fetchImpl: typeof fetch, settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}) {
  const events: HelpEvent[] = [];
  const tool = helpTool();
  for await (const event of askHelp({
    question: QUESTION,
    settings: helpSettingsOf({
      intentClassifier: true, creation: true, mascot: true, roll: true, lookup: true,
      tools: [tool], toolSwitches: { [tool.id]: true }, ...settings,
    }),
    snapshot: routedSnapshot(),
    index,
    world: editorWorld,
    fetchImpl,
    ...over,
  })) events.push(event);
  return events;
}

const lastTrace = (events: HelpEvent[]) => events.filter((event): event is { type: 'trace'; trace: HelpTrace } => event.type === 'trace').at(-1)!.trace;

/** The answer body of the same question with the Intent Classifier off: the full request. */
async function fullBody(settings: HelpSettingsChange = {}, over: Partial<HelpQuestion> = {}) {
  const off = endpoint();
  await ask(off.fetchImpl, { ...settings, intentClassifier: false }, over);
  expect(off.classifier).not.toHaveBeenCalled();
  return bodyOf(off.answers);
}

describe('the Create request in a World Editor', () => {
  it('sends the Create prompt with the world context and the entity rider, and no guide, world block, roll or Tool', async () => {
    const { fetchImpl, answers } = endpoint();
    const events = await ask(fetchImpl);
    expect(systemOf(answers)).toBe(CREATE_PROMPT);
    expect(userOf(answers)).toBe(`${CONTEXT_MESSAGE}\n\n${ENTITY_RIDER}`);
    expect(toolNames(answers)).toEqual(['set_face']);
    expect(bodyOf(answers).temperature).toBe(DEFAULT_HELP_OPTIONS.create.temperature);
    const trace = lastTrace(events);
    expect(trace.intent).toBe('Create');
    expect(trace.requests.at(-1)!.record.type).toBe('Creating');
  });

  it('takes the two samples from the first entities with an AI Description, in the Entities tab order', () => {
    // Bram leads the tab but has no AI Description; Tess comes after Oren.
    const { entityNames, samples } = createContextOf(sedge());
    expect(entityNames).toEqual(['Bram', 'Mara', 'Oren', 'Tess']);
    expect(samples.map((sample) => sample.name)).toEqual(['Mara', 'Oren']);
  });

  it('reads placeholders as their chips', () => {
    const placeholder: Placeholder = { id: 'ph-1', name: 'Captain', values: [{ id: 'v-1', text: 'Ilse' }] };
    const name = encodePlaceholderToken({ id: placeholder.id, mode: 'world', placementId: 'pl-1' });
    const world = { ...sedge(), placeholders: [placeholder], entities: [{ ...entities[2], name }] };
    expect(createContextOf(world).entityNames).toEqual(['{Captain}']);
  });

  it('carries the history, the two-ask rider and the note of added entities after the entity rider', async () => {
    const { fetchImpl, answers } = endpoint('Intent: Create\nSecond ask: yes');
    await ask(fetchImpl, {}, { added: ['Wren'], history: [{ question: 'Hello', answer: 'Hi there.' }] });
    expect(userOf(answers)).toBe(`${CONTEXT_MESSAGE}\n\n${ENTITY_RIDER}\n\n${TWO_ASK_RIDER}\n\n${entityAddNote(['Wren'])}`);
    expect(bodyOf(answers).messages.slice(1, 3)).toEqual([{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there.' }]);
  });

  it('sends the Tools that list Create, and no other', async () => {
    const { fetchImpl, answers } = endpoint();
    const maker = helpTool({ id: 'maker', name: 'name_maker', intents: ['Create'] });
    const other = helpTool();
    await ask(fetchImpl, { tools: [maker, other], toolSwitches: { maker: true, [other.id]: true } });
    expect(toolNames(answers).sort()).toEqual(['name_maker', 'set_face'].sort());
  });

  it('keeps world names in the AI Language directive, with no line about the guide', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, {}, { language: 'Spanish' });
    expect(systemOf(answers)).toBe(helpSystemPrompt('Spanish', CREATE_PROMPT, { world: true, guide: false }));
    expect(systemOf(answers)).toContain(worldNamesLine('Spanish'));
    expect(systemOf(answers)).not.toContain('so the player finds it on the screen');
  });

  it('goes to the Answer Endpoint by default, and to the Creating Endpoint once one is picked', async () => {
    const first = endpoint();
    await ask(first.fetchImpl);
    expect(first.answers.mock.calls[0][0]).toBe(textTarget().url);
    const routed = endpoint();
    await ask(routed.fetchImpl, { createEndpoint: 'creator' });
    expect(routed.answers.mock.calls[0][0]).toBe('https://creator.example.com/v1/chat/completions');
    // Only the Create request follows it.
    const help = endpoint('Intent: Help\nSecond ask: no');
    await ask(help.fetchImpl, { createEndpoint: 'creator' });
    expect(help.answers.mock.calls[0][0]).toBe(textTarget().url);
  });
});

describe('Create elsewhere', () => {
  it('sends the Chat plan with the refusal rider on a screen with no World Editor', async () => {
    for (const world of [openWorld(), undefined]) {
      const { fetchImpl, answers } = endpoint();
      const events = await ask(fetchImpl, {}, { world });
      expect(userOf(answers)).toBe(`${QUESTION}\n\n${CREATE_REFUSAL_RIDER}`);
      expect(systemOf(answers)).not.toBe(CREATE_PROMPT);
      expect(toolNames(answers).sort()).toEqual(['set_face', HELP_ROLL.name].sort());
      expect(lastTrace(events).requests.at(-1)!.record.type).toBe('Answer');
    }
  });

  it('sends the full request with Creation off, in the editor and elsewhere', async () => {
    for (const world of [editorWorld, openWorld()]) {
      const { fetchImpl, answers } = endpoint();
      await ask(fetchImpl, { creation: false }, { world });
      const full = await fullBody({ creation: false }, { world });
      // Ticket 03: the Tools still follow the Create Intent's list, which the default Tool leaves out.
      const playerTool = helpTool().name;
      expect({ ...bodyOf(answers), tools: undefined }).toEqual({ ...full, tools: undefined });
      expect(toolNames(answers)).toEqual((full.tools ?? []).map((tool) => tool.function.name).filter((name) => name !== playerTool));
      expect(toolNames(answers)).toContain(HELP_ROLL.name);
    }
  });
});
