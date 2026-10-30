import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { emptyCodeWorld, isPickRequest, NO_PICK, openWorld } from '@/test/helpFixtures';
import type { Entity } from '@/types';
import { languageDirective } from '@/lib/languages';
import { DEFAULT_WORLD_EDITOR_RULES } from './helpWorldRules';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from './helpPresets';
import { HELP_SYSTEM_PROMPT } from './helpPrompt';
import { HELP_PICK_WORLD_LINES, PICK_GAME_LINE, PICK_WORLD_LINE } from './helpPicks';
import type { HelpEmbedder } from './helpSemantic';
import { askHelp, HELP_SECTION_LIMIT, HELP_WORLD_CHAR_BUDGET, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { OpenWorld } from './helpWorld';
import type { HelpTrace } from './helpTrace';
import type { WorldIndexInput } from './worldIndex';

const index = createDocsIndex({
  pages: {
    Entities: '# Entities\n\nAn entity is a character the narrator plays.\n\n## How to Add an Entity\n\n1. Select **Add**.\n',
    Dictionary: '# Dictionary\n\nA dictionary entry adds lore when its keywords appear.\n',
  },
});

const mara: Entity = { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.' };

const sedge = (entities: Entity[] = [mara]): WorldIndexInput => ({
  worldOverview: { name: 'Sedge', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], locations: [], traits: [], entities, items: [],
  dictionaries: [{ id: 'book', name: 'Lore', entries: [{ id: 'pact', name: 'Ashen Pact', key: ['ashen pact'], value: 'An oath sworn in smoke by the founders.' }] }],
});

const editorWorld = (world: () => WorldIndexInput): OpenWorld => ({ ...openWorld(), lean: 'editor', world });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[] }

/** The endpoint: the pick request gets `picked`, the answer request a short answer. */
function endpoint(picked = NO_PICK) {
  const answers: FetchSpy = vi.fn(async () => sseResponse(sseReply('Mara keeps the gate.')));
  const picks: FetchSpy = vi.fn(async () => sseResponse(sseReply(picked)));
  const fetchImpl = ((url: string, init: RequestInit) => (isPickRequest(init) ? picks(url, init) : answers(url, init))) as unknown as typeof fetch;
  return { fetchImpl, answers, picks };
}

const bodyOf = (spy: FetchSpy, call = 0) => JSON.parse(spy.mock.calls[call][1].body as string) as SentBody;
const userMessage = (spy: FetchSpy, call = 0) => bodyOf(spy, call).messages.at(-1)!.content;
const worldBlock = (spy: FetchSpy, call = 0) => /<world>[\s\S]*?<\/world>/.exec(userMessage(spy, call))?.[0];
const guideBlock = (spy: FetchSpy, call = 0) => /<guide>[\s\S]*?<\/guide>/.exec(userMessage(spy, call))?.[0];

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const ask = (fetchImpl: typeof fetch, over: Partial<HelpQuestion> = {}, settings: HelpSettingsChange = {}) => collect(askHelp({
  question: 'Who keeps the gate?',
  settings: helpSettingsOf({ mascot: false, sources: { keyword: true, aiPicks: false, semantic: false }, ...settings }),
  snapshot: textSnapshot(textTarget()),
  index,
  fetchImpl,
  ...over,
}));

const done = (events: HelpEvent[]) => events.find((event): event is Extract<HelpEvent, { type: 'done' }> => event.type === 'done')!;
const lastTrace = (events: HelpEvent[]) => events.filter((event): event is { type: 'trace'; trace: HelpTrace } => event.type === 'trace').at(-1)!.trace;

describe('a question in the World Editor', () => {
  it('puts the asked item in the world block, with the editor rules after the question', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, { world: editorWorld(() => sedge()) });
    expect(worldBlock(answers)).toContain('A widow who keeps the gate.');
    expect(worldBlock(answers)).toContain('She hides the key under the shrine.');
    expect(userMessage(answers)).toContain('Answer the question from the guide and world sections above.');
    expect(userMessage(answers).endsWith(DEFAULT_WORLD_EDITOR_RULES)).toBe(true);
  });

  it('lists the item among the sources and in the trace', async () => {
    const { fetchImpl } = endpoint();
    const events = await ask(fetchImpl, { world: editorWorld(() => sedge()) });
    const mine = { kind: 'world', worldKind: 'entity', id: 'mara', name: 'Mara' };
    expect(done(events).sources).toContainEqual(mine);
    expect(done(events).flagged).toBe(false);
    const trace = lastTrace(events);
    expect(trace.sent).toContainEqual(mine);
    expect(trace.worldSearch?.queries[0].merged).toContainEqual(mine);
  });

  it('reads an unsaved edit on the next question', async () => {
    let live = sedge();
    const world = editorWorld(() => live);
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, { world });
    live = sedge([{ ...mara, playerDescription: 'A smith who keeps the gate now.' }]);
    await ask(fetchImpl, { world });
    expect(worldBlock(answers, 0)).not.toContain('smith');
    expect(worldBlock(answers, 1)).toContain('A smith who keeps the gate now.');
  });

  it('fills a world budget of its own, so a full world block keeps every guide hit', async () => {
    const guardsOf = (count: number) => Array.from({ length: count }, (_, at): Entity => ({
      id: `guard-${at}`, name: `Guard ${at}`, playerDescription: `${'A guard who keeps the gate. '.repeat(100)}`,
    }));
    const question = 'How do I add an entity who keeps the gate?';
    const alone = endpoint();
    await ask(alone.fetchImpl, { question });
    const full = endpoint();
    await ask(full.fetchImpl, { question, world: editorWorld(() => sedge(guardsOf(8))) });
    expect(guideBlock(full.answers)).toBe(guideBlock(alone.answers));
    const sections = worldBlock(full.answers)!.match(/<section kind=/g)!.length;
    expect(sections).toBeGreaterThan(1);
    expect(sections).toBeLessThanOrEqual(HELP_SECTION_LIMIT);
    expect(worldBlock(full.answers)!.length).toBeLessThan(HELP_WORLD_CHAR_BUDGET + 500);
  });
});

describe('a question that reads no world', () => {
  const bodies = async (world: OpenWorld | undefined, settings: HelpSettingsChange = {}) => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, { world }, settings);
    return userMessage(answers);
  };

  it('sends the body of today with Read the World off, a game world, or no world', async () => {
    const today = await bodies(undefined);
    expect(today).not.toContain('<world>');
    expect(await bodies(editorWorld(() => sedge()), { readWorld: false })).toBe(today);
    expect(await bodies({ ...editorWorld(() => sedge()), lean: 'game' })).toBe(today);
    expect(await bodies(openWorld(undefined, emptyCodeWorld))).toBe(today);
  });

  it('sends the world rules only with a world block', async () => {
    expect(await bodies(undefined)).not.toContain(DEFAULT_WORLD_EDITOR_RULES);
  });

  it('sends the AI Language body of today with no world block', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, { language: 'Spanish', world: editorWorld(() => sedge()) }, { readWorld: false });
    expect(bodyOf(answers).messages[0].content).toBe(`${HELP_SYSTEM_PROMPT}\n\n${languageDirective('answers', 'Spanish')} Keep each control name exactly as the guide writes it, in bold, so the player finds it on the screen.`);
  });
});

describe('the AI Language with a world block', () => {
  const NAMES = 'Names from the world are proper names: write each one exactly as the world spells it, in its own language, inside every Spanish sentence too.';
  const systemPrompt = async (over: Partial<HelpQuestion>, settings: HelpSettingsChange = {}) => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, over, settings);
    return bodyOf(answers).messages[0].content;
  };

  it('keeps world names after the control names', async () => {
    const prompt = await systemPrompt({ language: 'Spanish', world: editorWorld(() => sedge()) });
    expect(prompt.endsWith(`on the screen. ${NAMES}`)).toBe(true);
  });

  it('keeps world names when the world rules are cleared', async () => {
    const copy = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'p-1', 'No Rules');
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, { language: 'Spanish', world: editorWorld(() => sedge()) }, { presets: editHelpPrompt(copy, 'p-1', 'worldEditor', '') });
    expect(userMessage(answers)).not.toContain(DEFAULT_WORLD_EDITOR_RULES);
    expect(bodyOf(answers).messages[0].content).toContain(NAMES);
  });

  it('keeps world names when the search missed and the world block is empty', async () => {
    const prompt = await systemPrompt({ language: 'Spanish', question: 'zzqx', world: editorWorld(() => sedge([])) });
    expect(prompt).toContain(NAMES);
  });

  it('adds nothing with no AI Language', async () => {
    const prompt = await systemPrompt({ language: '', world: editorWorld(() => sedge()) });
    expect(prompt).not.toContain(NAMES);
  });
});

describe('the world pool sources', () => {
  // Two concepts: an oath or a promise, and everything else.
  const embedder: HelpEmbedder = {
    open: async () => true,
    embed: async (texts) => texts.map((text) => (/oath|promise/i.test(text) ? new Float32Array([1, 0]) : new Float32Array([0, 1]))),
    vectors: async () => ({ model: 'none', dims: 2, sections: [] }),
  };
  const question = 'What promise did people make long ago?';

  it('reaches a dictionary entry by meaning when no keyword matches', async () => {
    const world = editorWorld(() => sedge());
    const keywordOnly = endpoint();
    await ask(keywordOnly.fetchImpl, { question, world, embedder });
    expect(worldBlock(keywordOnly.answers)).not.toContain('Ashen Pact');
    const semantic = endpoint();
    await ask(semantic.fetchImpl, { question, world, embedder, semanticFloor: 0.5 }, { sources: { keyword: true, aiPicks: false, semantic: true } });
    expect(worldBlock(semantic.answers)).toContain('An oath sworn in smoke by the founders.');
  });

  const picksOn = { sources: { keyword: false, aiPicks: true, semantic: false } };
  const pickBodies = (spy: FetchSpy) => spy.mock.calls.map((_, call) => userMessage(spy, call));

  it('takes the AI picks of the world list from a pick request of its own', async () => {
    const { fetchImpl, answers, picks } = endpoint('Dictionary Entry › Lore › Ashen Pact');
    await ask(fetchImpl, { question, world: editorWorld(() => sedge()) }, picksOn);
    expect(picks).toHaveBeenCalledTimes(2);
    expect(pickBodies(picks).some((body) => body.startsWith(PICK_GAME_LINE))).toBe(false);
    const worldPick = pickBodies(picks).find((body) => body.startsWith('The sections are the parts of the world open in the World Editor, one on each line.\n\n'));
    expect(worldPick).toBe([
      'The sections are the parts of the world open in the World Editor, one on each line.',
      '<sections>\nEntity › Mara\nDictionary Entry › Lore › Ashen Pact\n</sections>',
      `Question: ${question}`,
      'Reply with the lines of the sections that answer the question, the best one first.',
    ].join('\n\n'));
    expect(worldBlock(answers)).toContain('An oath sworn in smoke by the founders.');
  });

  it('sends the guide pick request with the same body with or without a world open', async () => {
    const docsOnly = endpoint();
    await ask(docsOnly.fetchImpl, { question }, picksOn);
    const withWorld = endpoint();
    await ask(withWorld.fetchImpl, { question, world: editorWorld(() => sedge()) }, picksOn);
    const guidePick = pickBodies(withWorld.picks).filter((body) => !body.startsWith(PICK_WORLD_LINE));
    expect(guidePick).toEqual([userMessage(docsOnly.picks)]);
  });

  it('sends no world pick request for a world over the line cap', async () => {
    const crowd = Array.from({ length: HELP_PICK_WORLD_LINES }, (_, at): Entity => ({ id: `e-${at}`, name: `Extra ${at}` }));
    const { fetchImpl, picks } = endpoint();
    await ask(fetchImpl, { question, world: editorWorld(() => sedge(crowd)) }, picksOn);
    expect(pickBodies(picks).map((body) => body.startsWith(PICK_WORLD_LINE))).toEqual([false]);
  });
});
