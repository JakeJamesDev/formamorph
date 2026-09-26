import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '@/types';
import { sampleChipScene, sampleDictionaries } from '@/lib/chipValues/sampleScene';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { MemoryOverrides } from '@/lib/memoryOverrides';
import { BUILTIN_ENABLED_TOOLS } from '@/lib/promptPresets';
import { TOOL_CATALOG } from './toolCatalog';
import { vectorKey } from '@/lib/memoryRelevance';
import { REHYDRATE_MARGIN_MIN_BAND, REHYDRATE_SIM_THRESHOLD } from '@/lib/semanticRehydration';
import { DIARY_SIM_THRESHOLD } from '@/lib/semanticDiary';
import { buildToolSnapshot, sampleToolSnapshot, type ToolMeaning, type ToolMemory, type ToolMemorySource } from './toolSnapshot';
import { runToolCall } from './toolRunner';
import { recallMatches } from './toolRecall';
import { parseTool } from './toolValidation';

const RECALL = TOOL_CATALOG.find((t) => t.id === 'recall')!;

interface TurnSpec {
  summary?: string;
  diaries?: Record<string, string>;
}

/** A committed history: one user→assistant pair per spec, turn ids `t1`, `t2`, … */
function history(turns: TurnSpec[]): ChatMessage[] {
  return turns.flatMap(({ summary, diaries }, i) => [
    { role: 'user', content: `Action ${i + 1}.` },
    {
      role: 'assistant',
      content: serializeTurnContent({
        narration: `Narration ${i + 1}.`, choices: [], stat_changes: [], turnId: `t${i + 1}`, summary, diaries,
      }),
    },
  ]);
}

type Match = { turn: number; kind: 'digest' | 'diary'; character?: string; text: string };

async function recall(query: string, memory: ToolMemorySource | null): Promise<Match[]> {
  const snapshot = buildToolSnapshot(sampleChipScene(), sampleDictionaries(), memory);
  const result = await runToolCall(RECALL, JSON.stringify({ query }), snapshot);
  expect(result.failure).toBeUndefined();
  return (JSON.parse(result.text) as { matches: Match[] }).matches;
}

const source = (turns: TurnSpec[], verbatimFloor = 0, overrides: MemoryOverrides | null = null): ToolMemorySource =>
  ({ history: history(turns), overrides, verbatimFloor });

describe('the recall catalog Tool', () => {
  it('is a locked lookup of the memories source by one required query, offered to narration only', () => {
    expect(RECALL).toMatchObject({
      name: 'recall',
      params: [{ name: 'query', type: 'string', description: '', required: true, options: [] }],
      handler: { kind: 'lookup', source: 'memories', param: 'query' },
      emptyResult: '{"matches": []}', offeredTo: ['narration'],
    });
    expect(RECALL.callLimit).toBeUndefined();
    expect(RECALL.description.split('\n').map((line) => line.split(':')[0])).toEqual(['Purpose', 'Use when', 'Input', 'Output']);
  });

  it('ships switched off on every built-in preset', () => {
    for (const enabled of Object.values(BUILTIN_ENABLED_TOOLS)) expect(enabled.recall).toBeUndefined();
  });

  it('is refused as a user Tool, so the stored Tool shape stays as it is', () => {
    const imported = parseTool({ ...RECALL, id: 'u-1', name: 'my_recall' });
    expect(imported).toEqual({ error: 'its handler is unreadable' });
  });
});

describe('recall, lexical', () => {
  it('finds a digest by its words, in any case, with its turn number', async () => {
    const memory = source([{ summary: 'Mira gave Wren a silver key.' }, { summary: 'The storm broke.' }]);
    expect(await recall('Silver KEY', memory)).toEqual([{ turn: 1, kind: 'digest', text: 'Mira gave Wren a silver key.' }]);
  });

  it('finds a diary entry and names its character', async () => {
    const memory = source([{ summary: 'The storm broke.', diaries: { Bell: 'I promised the ferryman my lantern.' } }]);
    expect(await recall('lantern promise', memory)).toEqual([
      { turn: 1, kind: 'diary', character: 'Bell', text: 'I promised the ferryman my lantern.' },
    ]);
  });

  it('skips the turns inside the verbatim floor and keeps the newest turn outside it', async () => {
    const memory = source([
      { summary: 'Wren hid the key under the pier.' },
      { summary: 'Wren checked the key again.', diaries: { Wren: 'The key is safe.' } },
      { summary: 'Wren lost the key.' },
      { summary: 'Harrow found a key.' },
    ], 2);
    expect((await recall('key', memory)).map((m) => m.turn)).toEqual([1, 2, 2]);
  });

  it('finds a rewritten digest by its new text, never its old', async () => {
    const overrides: MemoryOverrides = { edits: { t1: { text: 'Wren sold the lantern.', source: 'player' } } };
    const memory = source([{ summary: 'Wren broke the lantern.' }], 0, overrides);
    expect(await recall('broke', memory)).toEqual([]);
    expect(await recall('sold', memory)).toEqual([{ turn: 1, kind: 'digest', text: 'Wren sold the lantern.' }]);
  });

  it('never finds a deleted digest', async () => {
    const overrides: MemoryOverrides = { deleted: ['t1'], edits: { t1: { text: 'Wren sold the lantern.', source: 'player' } } };
    const memory = source([{ summary: 'Wren broke the lantern.' }], 0, overrides);
    expect(await recall('lantern broke sold', memory)).toEqual([]);
  });

  it('keeps a deleted digest\'s diary entries searchable', async () => {
    const memory = source([{ summary: 'Wren broke the lantern.', diaries: { Bell: 'Wren broke my lantern.' } }], 0, { deleted: ['t1'] });
    expect(await recall('lantern', memory)).toEqual([{ turn: 1, kind: 'diary', character: 'Bell', text: 'Wren broke my lantern.' }]);
  });

  it('never finds a hand-written memory', async () => {
    const overrides: MemoryOverrides = { notes: [{ id: 'n1', text: 'Wren owes Harrow a lantern.', anchorTurn: 1 }] };
    const memory = source([{ summary: 'The storm broke.' }], 0, overrides);
    expect(await recall('lantern', memory)).toEqual([]);
  });

  it('skips a "nothing notable" diary entry, in any case', async () => {
    const memory = source([{ diaries: { Wren: 'Nothing notable', Bell: 'nothing notable' } }]);
    expect(await recall('nothing notable', memory)).toEqual([]);
  });

  it('keeps the five best matches, a higher score first and the newer turn on a tie, then sorts them oldest first', async () => {
    const turns: TurnSpec[] = [
      { summary: 'The bell rang at the ferry.' },
      ...Array.from({ length: 6 }, (_, i) => ({ summary: `The bell rang ${i + 2} times.` })),
    ];
    expect((await recall('bell ferry', source(turns))).map((m) => m.turn)).toEqual([1, 4, 5, 6, 7]);
  });

  it('returns a turn\'s digest before its diary entries', async () => {
    const memory = source([{ summary: 'Wren rowed out.', diaries: { Bell: 'Wren rowed out alone.' } }]);
    expect((await recall('rowed', memory)).map((m) => m.kind)).toEqual(['digest', 'diary']);
  });

  it('matches whole words only and ignores stop words', async () => {
    const memory = source([{ summary: 'The keystone of the bridge cracked.' }]);
    expect(await recall('key', memory)).toEqual([]);
    expect(await recall('the', memory)).toEqual([]);
  });

  it('returns the empty result with no digests, and with no memory source', async () => {
    const snapshot = buildToolSnapshot(sampleChipScene(), sampleDictionaries(), source([{}, {}]));
    expect(await runToolCall(RECALL, '{"query": "anything"}', snapshot)).toEqual({ text: '{"matches": []}' });
    expect(await recall('anything', null)).toEqual([]);
  });

  it('no longer finds a turn the player rolled back', async () => {
    const turns: TurnSpec[] = [{ summary: 'The storm broke.' }, { summary: 'Wren sank the boat.' }];
    const played = history(turns);
    expect(await recall('boat', { history: played, overrides: null, verbatimFloor: 0 })).toHaveLength(1);
    expect(await recall('boat', { history: played.slice(0, -2), overrides: null, verbatimFloor: 0 })).toEqual([]);
  });
});

/** A unit vector whose cosine to QUERY_VEC is `sim`. */
const vec = (sim: number) => new Float32Array([sim, Math.sqrt(1 - sim * sim), 0]);
const QUERY_VEC = new Float32Array([1, 0, 0]);

/** One memory per turn: a digest or a diary entry, with the query similarity its cached vector holds. */
interface Rec { text: string; sim?: number; diary?: string }

function hybrid(recs: Rec[], diaries = true) {
  const memories: ToolMemory[] = recs.map(({ text, diary }, i) => ({
    turn: i + 1, digest: diary ? '' : text, diaries: diary ? [{ character: diary, text }] : [],
  }));
  const vectors = new Map(recs.flatMap(({ text, sim }) => (sim === undefined ? [] : [[vectorKey(text), vec(sim)] as const])));
  return (query: string) => recallMatches(query, memories, { queryVec: QUERY_VEC, vectors, diaries }).map((m) => m.text);
}

/** Records that share no query word and sit far from it: the world's baseline for the median. */
const filler = (n: number): Rec[] => Array.from({ length: n }, (_, i) => ({ text: `Quiet moment ${i}.`, sim: 0 }));

describe('recall, hybrid', () => {
  it('matches by meaning a memory that shares no word with the query', () => {
    const find = hybrid([{ text: 'Agreed to escort Mira to the ferry.', sim: 0.8 }, { text: 'A gull stole bread.', sim: 0.1 }]);
    expect(find('the promise to her')).toEqual(['Agreed to escort Mira to the ferry.']);
  });

  it('keeps a word match whose meaning score is below the floor', () => {
    const find = hybrid([{ text: 'Harrow mended the net.', sim: 0.1 }, { text: 'A gull stole bread.', sim: 0.1 }]);
    expect(find('Harrow')).toEqual(['Harrow mended the net.']);
  });

  it('ranks both-ways matches first for the limit, then meaning-only by cosine, then word-only', () => {
    const find = hybrid([
      { text: 'The lantern glowed.', sim: 0.5 },
      { text: 'Wren lit a lantern.', sim: 0.45 },
      { text: 'She kept her word about the light.', sim: 0.95 },
      { text: 'A light burned in the tower.', sim: 0.92 },
      { text: 'The beacon was relit.', sim: 0.9 },
      { text: 'Embers in the dark.', sim: 0.88 },
      ...filler(8),
      { text: 'A lantern hung by the door.', sim: 0.1 },
      { text: 'Bell sold a lantern.', sim: 0.05 },
    ]);
    expect(find('lantern')).toEqual([
      'The lantern glowed.', 'Wren lit a lantern.', 'She kept her word about the light.', 'A light burned in the tower.', 'The beacon was relit.',
    ]);
  });

  it('orders the both-ways group by cosine, word count on a cosine tie, then the newer turn', () => {
    const find = hybrid([
      { text: 'Bell rang.', sim: 0.8 },
      { text: 'Bell rang at the ferry.', sim: 0.5 },
      { text: 'The ferry bell tolled.', sim: 0.6 },
      { text: 'Bell rang again.', sim: 0.6 },
      { text: 'Bell rang once more.', sim: 0.6 },
      { text: 'Bell rang twice.', sim: 0.7 },
      { text: 'Bell rang for Mira.', sim: 0.9 },
      ...filler(8),
    ]);
    // 0.9, 0.8, 0.7, then the 0.6 with two words, then the newer of the two 0.6 ties with one. The 0.5 with
    // two words drops out.
    expect(find('bell ferry')).toEqual(['Bell rang.', 'The ferry bell tolled.', 'Bell rang once more.', 'Bell rang twice.', 'Bell rang for Mira.']);
  });

  it('matches a memory with no cached vector by its words', () => {
    const find = hybrid([{ text: 'Harrow mended the net.' }, { text: 'The net tore.' }, { text: 'A gull stole bread.', sim: 0.1 }]);
    expect(find('Harrow')).toEqual(['Harrow mended the net.']);
  });

  it('keeps the result small in a same-cast world where every memory clears the floor', () => {
    const sims = [0.4, 0.42, 0.44, 0.46, 0.48, 0.5, 0.52, 0.7];
    const find = hybrid(sims.map((sim, i) => ({ text: `Mira and Wren talked in the house ${i}.`, sim })));
    // Median 0.47 plus the margin: only the standout clears it.
    expect(find('the argument')).toEqual(['Mira and Wren talked in the house 7.']);
  });

  it('keeps the floor-only rule below the minimum candidate count', () => {
    // Flat and above the floor: the margin would drop all but the top one, the floor alone keeps them all.
    const sims = Array.from({ length: REHYDRATE_MARGIN_MIN_BAND - 1 }, (_, i) => REHYDRATE_SIM_THRESHOLD + 0.01 * (i + 1));
    const find = hybrid([...sims.map((sim, i) => ({ text: `Mira and Wren talked ${i}.`, sim })), { text: 'A gull stole bread.' }]);
    expect(find('the argument')).toHaveLength(sims.length);
  });

  it('holds a digest to the Scene Recall floor and a diary entry to the Diary Recall floor', () => {
    expect(DIARY_SIM_THRESHOLD).toBeLessThan(REHYDRATE_SIM_THRESHOLD);
    const sim = (REHYDRATE_SIM_THRESHOLD + DIARY_SIM_THRESHOLD) / 2;
    const find = hybrid([{ text: 'Wren kept the oath.', sim }, { text: 'I kept my oath to Wren.', sim, diary: 'Bell' }]);
    expect(find('the promise')).toEqual(['I kept my oath to Wren.']);
  });

  it('matches a diary entry by its words only when Diary Recall is off', () => {
    const recs: Rec[] = [{ text: 'I kept my oath to Wren.', sim: 0.9, diary: 'Bell' }, { text: 'I lost the oar.', sim: 0.1, diary: 'Wren' }];
    expect(hybrid(recs, true)('the promise')).toEqual(['I kept my oath to Wren.']);
    expect(hybrid(recs, false)('the promise')).toEqual([]);
    expect(hybrid(recs, false)('oar')).toEqual(['I lost the oar.']);
  });
});

describe('recall, hybrid through the runner', () => {
  const turns: TurnSpec[] = [{ summary: 'Agreed to escort Mira to the ferry.' }, { summary: 'Mira paid the ferryman.' }];
  const vectors = new Map([[vectorKey(turns[0].summary!), vec(0.9)], [vectorKey(turns[1].summary!), vec(0.1)]]);
  const withMeaning = (embed: ToolMeaning['embed']): ToolMemorySource => ({ ...source(turns), meaning: { embed, vectors, diaries: false } });

  it('matches by meaning when the query embeds', async () => {
    expect((await recall('promise Mira', withMeaning(async () => QUERY_VEC))).map((m) => m.turn)).toEqual([1, 2]);
    expect((await recall('the promise', withMeaning(async () => QUERY_VEC))).map((m) => m.turn)).toEqual([1]);
  });

  it('returns the lexical result when the query embed fails or the model is not loaded', async () => {
    const lexical = await recall('the promise ferryman', source(turns));
    expect(lexical.map((m) => m.turn)).toEqual([2]);
    expect(await recall('the promise ferryman', withMeaning(async () => null))).toEqual(lexical);
    expect(await recall('the promise ferryman', withMeaning(() => Promise.reject(new Error('worker died'))))).toEqual(lexical);
  });

  it('returns the lexical result from a source with no meaning match, where the same query finds more by meaning', async () => {
    expect(buildToolSnapshot(sampleChipScene(), sampleDictionaries(), source(turns)).meaning).toBeNull();
    expect((await recall('the promise ferryman', source(turns))).map((m) => m.turn)).toEqual([2]);
    expect((await recall('the promise ferryman', withMeaning(async () => QUERY_VEC))).map((m) => m.turn)).toEqual([1, 2]);
  });

  it('matches a rewritten digest by words only, since its new text has no cached vector', async () => {
    const overrides: MemoryOverrides = { edits: { t1: { text: 'Wren swore to guard the ferry.', source: 'player' } } };
    const memory = { ...withMeaning(async () => QUERY_VEC), overrides };
    expect((await recall('the promise', memory)).map((m) => m.turn)).toEqual([]);
    expect((await recall('swore', memory)).map((m) => m.turn)).toEqual([1]);
  });

  it('freezes only the vectors of the memory list into the snapshot', () => {
    const live = new Map([...vectors, [vectorKey('A lore entry.'), vec(0.5)]]);
    const { meaning } = buildToolSnapshot(sampleChipScene(), sampleDictionaries(), {
      ...source(turns, 1), meaning: { embed: async () => QUERY_VEC, vectors: live, diaries: false },
    });
    expect([...meaning!.vectors.keys()]).toEqual([vectorKey(turns[0].summary!)]);
    live.clear();
    expect(meaning!.vectors.size).toBe(1);
  });
});

describe('the Tool Snapshot memory list', () => {
  it('counts every committed turn, lists turns with a memory outside the floor, and is frozen', () => {
    const turns: TurnSpec[] = [{}, { summary: 'The storm broke.' }, {}, { summary: 'Wren rowed out.' }];
    const { memories } = buildToolSnapshot(sampleChipScene(), sampleDictionaries(), source(turns, 1));
    expect(memories).toEqual([{ turn: 2, digest: 'The storm broke.', diaries: [] }]);
    expect(Object.isFrozen(memories[0])).toBe(true);
  });
});

describe('recall in Try It with no world open', () => {
  it('searches sample memories', async () => {
    const snapshot = sampleToolSnapshot();
    expect(snapshot.memories.length).toBeGreaterThan(0);
    const result = await runToolCall(RECALL, JSON.stringify({ query: snapshot.memories[0].digest }), snapshot);
    expect((JSON.parse(result.text) as { matches: Match[] }).matches.length).toBeGreaterThan(0);
  });
});
