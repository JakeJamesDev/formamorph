import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '@/types';
import { sampleChipScene, sampleDictionaries } from '@/lib/chipValues/sampleScene';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { MemoryOverrides } from '@/lib/memoryOverrides';
import { BUILTIN_ENABLED_TOOLS } from '@/lib/promptPresets';
import { TOOL_CATALOG } from './toolCatalog';
import { buildToolSnapshot, sampleToolSnapshot, type ToolMemorySource } from './toolSnapshot';
import { runToolCall } from './toolRunner';
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
