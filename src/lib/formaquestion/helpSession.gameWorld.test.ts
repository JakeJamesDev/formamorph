// A help question in the game: the world block holds the Player View and the fired lore, the story block the story
// so far, and nothing past what the player has met. Each leak guard has a control arm that swaps the Player View
// for the full world, so the guard is seen to bite.
import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { UNKNOWN_REASONING_CAPABILITY, type ReasoningCapability } from '@/lib/reasoningEffort';
import { parseTurns } from '@/lib/turnBanding';
import { sseFrame, sseReply, sseResponse, textSnapshot, textTarget } from '@/test/aiTextFixtures';
import { helpTool, isPickRequest, NO_PICK, openWorld } from '@/test/helpFixtures';
import type { ChatMessage, DictionaryEntry, Entity, GameState, PlayerStat } from '@/types';
import type { GameWorldInput } from './gameWorld';
import { DEFAULT_WORLD_GAME_RULES } from './helpWorldRules';
import { askHelp, type HelpEvent, type HelpQuestion } from './helpSession';
import { helpSettingsOf, type HelpSettingsChange } from './helpSettings';
import type { OpenWorld } from './helpWorld';
import type { HelpEmbedder } from './helpSemantic';
import { buildPlayerView, type PlayerView } from './playerView';
import { storySoFar } from './storySoFar';
import { entryVectorKey } from '@/lib/semanticDictionary';

const index = createDocsIndex({ pages: { Entities: '# Entities\n\nAn entity is a character the narrator plays.\n' } });

const mara: Entity = { id: 'mara', name: 'Mara', playerDescription: 'A widow who keeps the gate.', aiDescription: 'She hides the key under the shrine.' };
const velka: Entity = { id: 'velka', name: 'Velka Thorn', playerDescription: 'A tall woman in grey.', aiDescription: 'The heir in hiding.' };
const stat = (id: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over });
const STATS = [stat('Coins'), stat('Suspicion', { hidden: true })];
const WORLD = { entities: [mara, velka], locations: [], traits: [] };

const PACT: DictionaryEntry = { id: 'pact', name: 'Ashen Pact', key: ['ashen pact'], value: 'An oath sworn in smoke.' };
const BELL: DictionaryEntry = { id: 'bell', name: 'Drowned Bell', key: ['drowned bell'], value: 'A bell rung under the lake.' };
const CROWN: DictionaryEntry = { id: 'crown', name: 'Cinder Crown', key: ['cinder crown'], value: 'The crown the heir will claim.' };
const LORE = [PACT, BELL, CROWN];

const state = (extra: Partial<GameState> = {}): GameState => ({
  globalStats: STATS, globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0,
  characterData: null, choices: [], isGameStarted: true, timestamp: '', worldName: null, playerNotes: '',
  previousStateIndex: null, stateVersion: 1, ...extra,
});

const user = (content: string): ChatMessage => ({ role: 'user', content });
const narrated = (turnId: string, narration: string, extra: Record<string, unknown> = {}): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration, choices: [], stat_changes: [], turnId, ...extra }),
});

const HISTORY: ChatMessage[] = [
  user('I walk to the gate.'), narrated('t1', 'Mara opens the gate.', { summary: 'You met Mara at the gate.', diaries: { Mara: 'I fear the stranger.' } }),
  user('I listen.'), narrated('t2', 'Far off, the drowned bell tolls.'),
];
const CHAIN = [state({ metEntities: ['mara'] }), state({ metEntities: ['mara'] })];

/** The full world in Player View rows, AI text and hidden stats included: the control arm of each leak guard. */
const fullView = (): PlayerView => ({
  entities: WORLD.entities.map((e) => ({ kind: 'entity', id: e.id, name: e.name, description: `${e.playerDescription} ${e.aiDescription}` })),
  locations: [], items: [], traits: [],
  stats: STATS.map((s) => ({ kind: 'stat', id: s.id, name: s.name, type: s.type, value: s.value, min: s.min, max: s.max, band: '' })),
});

function gameInput({ history = HISTORY, chain = CHAIN, memoryDigests = true, view }: {
  history?: ChatMessage[]; chain?: GameState[]; memoryDigests?: boolean; view?: PlayerView;
} = {}): GameWorldInput {
  return {
    view: view ?? buildPlayerView({ world: WORLD, chain, history, persona: null, resolve: (text) => text }),
    story: storySoFar({ turns: parseTurns(history), memoryDigests, verbatimFloor: 1, milestoneDrop: null, stripMedia: false }),
    lore: LORE,
    loreVectors: null,
    resolve: (text) => text,
  };
}

const gameWorld = (input: () => GameWorldInput, over: Partial<OpenWorld> = {}): OpenWorld => ({ ...openWorld(), lean: 'game', game: input, ...over });

type FetchSpy = ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>;
interface SentBody { messages: { role: string; content: string }[] }

function endpoint() {
  const answers: FetchSpy = vi.fn(async () => sseResponse(sseReply('Mara keeps the gate.')));
  const fetchImpl = ((url: string, init: RequestInit) => (isPickRequest(init) ? sseResponse(sseReply(NO_PICK)) : answers(url, init))) as unknown as typeof fetch;
  return { fetchImpl, answers };
}

const userMessage = (spy: FetchSpy) => (JSON.parse(spy.mock.calls[0][1].body as string) as SentBody).messages.at(-1)!.content;
const worldBlock = (spy: FetchSpy) => /<world>[\s\S]*?<\/world>/.exec(userMessage(spy))?.[0];
const storyBlock = (spy: FetchSpy) => /<story>[\s\S]*?<\/story>/.exec(userMessage(spy))?.[0];
/** What the request holds of the world: the world block and the story block. The question is the player's own. */
const worldText = (spy: FetchSpy) => `${worldBlock(spy) ?? ''}\n${storyBlock(spy) ?? ''}`;

async function collect(events: AsyncIterable<HelpEvent>): Promise<HelpEvent[]> {
  const all: HelpEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const ask = (fetchImpl: typeof fetch, question: string, over: Partial<HelpQuestion> = {}, settings: HelpSettingsChange = {}) => collect(askHelp({
  question,
  settings: helpSettingsOf({ mascot: false, sources: { keyword: true, aiPicks: false, semantic: false }, ...settings }),
  snapshot: textSnapshot(textTarget()),
  index,
  fetchImpl,
  ...over,
}));

const done = (events: HelpEvent[]) => events.find((event): event is Extract<HelpEvent, { type: 'done' }> => event.type === 'done')!;

/** The world text a question gets, with the Player View or with the full world in its place. */
async function sentWorld(question: string, view?: PlayerView) {
  const { fetchImpl, answers } = endpoint();
  await ask(fetchImpl, question, { world: gameWorld(() => gameInput({ view })) });
  return worldText(answers);
}

describe('a question in the game', () => {
  it.each([
    ['an unmet name', 'Who is the tall woman in grey?', /Velka|tall woman in grey/],
    ['an AI description', 'Where does Mara hide the key?', /shrine/],
    ['a hidden stat', 'How high is my suspicion?', /Suspicion/],
  ])('sends no %s', async (_, question, leak) => {
    expect(await sentWorld(question)).not.toMatch(leak);
    expect(await sentWorld(question, fullView())).toMatch(leak);
  });

  it("sends no diary text, though the turn's narration rides", async () => {
    const text = await sentWorld('What happened at the gate?');
    expect(text).toContain('You met Mara at the gate.');
    expect(text).not.toContain('I fear the stranger.');
  });

  it('puts the met entity in the world block, with the game rules after the question', async () => {
    const { fetchImpl, answers } = endpoint();
    const events = await ask(fetchImpl, 'Who keeps the gate?', { world: gameWorld(() => gameInput()) });
    expect(worldBlock(answers)).toContain('A widow who keeps the gate.');
    expect(userMessage(answers).endsWith(DEFAULT_WORLD_GAME_RULES)).toBe(true);
    expect(userMessage(answers)).toContain('Answer the question from the guide and world sections above.');
    expect(done(events).sources).toContainEqual({ kind: 'world', worldKind: 'entity', id: 'mara', name: 'Mara' });
  });

  it('fires an entry whose keyword is in the question', async () => {
    const { fetchImpl, answers } = endpoint();
    const events = await ask(fetchImpl, 'What is the Ashen Pact?', { world: gameWorld(() => gameInput()) });
    expect(worldBlock(answers)).toContain('An oath sworn in smoke.');
    expect(done(events).sources).toContainEqual({ kind: 'world', worldKind: 'dictionary', id: 'pact', name: 'Ashen Pact' });
  });

  it('fires an entry whose keyword is in the story so far', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'What was that sound?', { world: gameWorld(() => gameInput()) });
    expect(worldBlock(answers)).toContain('A bell rung under the lake.');
  });

  it('leaves out an entry whose keyword is nowhere in the fed context', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'What is the Ashen Pact?', { world: gameWorld(() => gameInput()) });
    expect(userMessage(answers)).not.toContain('The crown the heir will claim.');
  });

  it('fires an entry by meaning against the question while Semantic Lore has vectors', async () => {
    const near = new Float32Array([1, 0]);
    const embedder: HelpEmbedder = { open: async () => true, embed: async () => [near], vectors: async () => ({ model: '', sections: [] }) as never };
    const input = () => ({ ...gameInput(), loreVectors: new Map([[entryVectorKey(CROWN), near]]) });
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'Who will rule after the queen?', { world: gameWorld(input), embedder });
    expect(worldBlock(answers)).toContain('The crown the heir will claim.');
  });

  it('sends the milestone memories and the recent turns as the story so far', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'What happened?', { world: gameWorld(() => gameInput()) });
    expect(storyBlock(answers)).toBe('<story>\nEarlier events:\nYou met Mara at the gate.\n\nRecent turns:\nPlayer: I listen.\nFar off, the drowned bell tolls.\n</story>');
  });

  it('sends the recent turns alone with memory digests off', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'What happened?', { world: gameWorld(() => gameInput({ memoryDigests: false })) });
    const story = storyBlock(answers);
    expect(story).not.toContain('Earlier events');
    expect(story).toContain('Player: I walk to the gate.\nMara opens the gate.');
    expect(story).toContain('Far off, the drowned bell tolls.');
  });

  it('forgets what an undone turn showed', async () => {
    const met = [...HISTORY, user('I wait.'), narrated('t3', 'Velka Thorn steps from the fog.')];
    const chain = [...CHAIN, state({ metEntities: ['mara', 'velka'] })];
    const before = endpoint();
    await ask(before.fetchImpl, 'Who did I meet?', { world: gameWorld(() => gameInput({ history: met, chain })) });
    expect(worldText(before.answers)).toMatch(/Velka Thorn|fog/);
    // Undo leaves the history and the snapshots of the turns before it.
    const after = endpoint();
    await ask(after.fetchImpl, 'Who did I meet?', { world: gameWorld(() => gameInput({ history: met.slice(0, -2), chain: chain.slice(0, -1) })) });
    expect(worldText(after.answers)).not.toMatch(/Velka|fog|tall woman/);
  });

  it('sends no world, story or lore with Read the World off', async () => {
    const game = vi.fn(() => gameInput());
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'What is the Ashen Pact?', { world: gameWorld(game) }, { readWorld: false });
    expect(game).not.toHaveBeenCalled();
    expect(userMessage(answers)).not.toMatch(/<world>|<story>|An oath sworn in smoke/);
  });

  it('sends no world on a bare question', async () => {
    const { fetchImpl, answers } = endpoint();
    await ask(fetchImpl, 'Who keeps the gate?', { world: gameWorld(() => gameInput()) }, { sources: { keyword: false, aiPicks: false, semantic: false }, lookup: false });
    expect(userMessage(answers)).toBe('Who keeps the gate?');
  });
});

describe('a Formaquestion Tool in the game', () => {
  const reasoning: ReasoningCapability = { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'native' } };
  const tool = helpTool();

  it("builds its snapshot with the question's fired entries", async () => {
    const snapshot = vi.fn(openWorld().snapshot);
    let request = 0;
    const replies = [
      [sseFrame({ tool_calls: [{ index: 0, id: 'srv-0', type: 'function', function: { name: tool.name, arguments: '{"name":"Mara"}' } }] }), sseFrame({}, 'tool_calls'), 'data: [DONE]\n\n'],
      sseReply('Mara keeps the gate.'),
    ];
    const fetchImpl = ((_url: string, init: RequestInit) => sseResponse(isPickRequest(init) ? sseReply(NO_PICK) : replies[request++])) as unknown as typeof fetch;
    await ask(fetchImpl, 'What is the Ashen Pact?', { world: gameWorld(() => gameInput(), { snapshot }), snapshot: textSnapshot(textTarget({ reasoning })) },
      { tools: [tool], toolSwitches: { [tool.id]: true } });
    // The question fires the pact; the story fires the bell.
    expect(snapshot).toHaveBeenCalledWith([PACT, BELL]);
  });
});
