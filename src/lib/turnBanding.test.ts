import { describe, it, expect } from 'vitest';
import type { AITurnResult, ChatMessage, DictionaryEntry } from '@/types';
import {
  parseTurns,
  buildVerbatimHistory,
  extractKeywords,
  scoreTurnDigest,
  selectRehydrations,
  buildBandedHistory,
  type BandTurn,
} from './turnBanding';

const user = (content: string): ChatMessage => ({ role: 'user', content });

const assistant = (turn: Partial<AITurnResult> & { game_text?: string }): ChatMessage => ({
  role: 'assistant',
  content: JSON.stringify({ game_text: '', choices: [], stat_changes: [], ...turn }),
});

/** A user→assistant pair, the unit the flat history is built from. */
const pair = (action: string, turn: Partial<AITurnResult>): ChatMessage[] => [user(action), assistant(turn)];

/** A BandTurn fixture (bypasses parsing) for the retriever/assembler units. */
const bandTurn = (index: number, over: Partial<BandTurn> = {}): BandTurn => ({
  index,
  turnId: `t${index}`,
  userMsg: user(`a${index}`),
  gameText: `g${index}`,
  summary: `s${index}`,
  ...over,
});

const WIDE = 1_000_000; // a context window large enough that nothing is trimmed

describe('parseTurns', () => {
  it('parses each pair, capturing turnId/summary/game_text', () => {
    const history = [
      ...pair('a1', { turnId: 't1', game_text: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2' }),
    ];
    const turns = parseTurns(history);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ turnId: 't1', gameText: 'g1', summary: 's1' });
    expect(turns[1]).toMatchObject({ turnId: 't2', gameText: 'g2', summary: undefined });
  });

  it('skips unparseable assistant turns', () => {
    const history = [user('a1'), { role: 'assistant', content: 'not json {' } as ChatMessage];
    expect(parseTurns(history)).toEqual([]);
  });
});

describe('buildVerbatimHistory', () => {
  it('returns every turn chronologically when the budget is ample', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2' }),
    ]);
    const out = buildVerbatimHistory(turns, WIDE, 0, 0);
    expect(out.map((m) => m.content)).toEqual(['a1', 'g1', 'a2', 'g2']);
  });

  it('keeps the newest turns and drops older ones past the budget', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'x'.repeat(40000) }), // huge, will not fit
      ...pair('a2', { turnId: 't2', game_text: 'g2' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3' }),
    ]);
    const out = buildVerbatimHistory(turns, 5120, 0, 0);
    expect(out.map((m) => m.content)).toEqual(['a2', 'g2', 'a3', 'g3']);
  });
});

describe('extractKeywords', () => {
  it('keeps significant words and drops short words / stopwords', () => {
    const kw = extractKeywords('You talk to the guard about Mira');
    expect(kw).toContain('talk');
    expect(kw).toContain('guard');
    expect(kw).toContain('mira');
    expect(kw).not.toContain('you'); // stopword
    expect(kw).not.toContain('to'); // too short
    expect(kw).not.toContain('the'); // stopword
  });

  it('unions in keywords of activated dictionary entries', () => {
    const dict: DictionaryEntry[] = [{ id: '1', name: 'Mira', key: 'Mira, vault keeper', value: 'A guard.' }];
    const kw = extractKeywords('talk to mira', dict);
    expect(kw).toContain('mira');
    expect(kw).toContain('vault keeper'); // multi-word entity term from the dictionary
  });
});

describe('scoreTurnDigest', () => {
  it('counts word-bounded keyword hits in the digest', () => {
    const turn = bandTurn(1, { summary: 'You entered the cave and met Mira.' });
    expect(scoreTurnDigest(turn, ['cave', 'mira'])).toBe(2);
  });

  it('does not match a keyword inside a larger word', () => {
    const turn = bandTurn(1, { summary: 'You explored the cavern.' });
    expect(scoreTurnDigest(turn, ['cave'])).toBe(0);
  });

  it('is zero for a turn with no digest', () => {
    expect(scoreTurnDigest(bandTurn(1, { summary: undefined }), ['cave'])).toBe(0);
  });
});

describe('selectRehydrations', () => {
  it('picks overlapping turns, best score then most recent first, within the cap', () => {
    const candidates = [
      bandTurn(1, { summary: 'Mira and the vault.' }), // score 2
      bandTurn(3, { summary: 'The vault again.' }), // score 1
      bandTurn(5, { summary: 'Nothing relevant.' }), // score 0 → excluded
    ];
    const chosen = selectRehydrations(candidates, ['mira', 'vault'], [], WIDE);
    expect([...chosen]).toEqual(['t1', 't3']);
    expect(chosen.has('t5')).toBe(false);
  });

  it('skips turns without a turnId', () => {
    const candidates = [bandTurn(1, { turnId: undefined, summary: 'Mira.' })];
    expect(selectRehydrations(candidates, ['mira'], [], WIDE).size).toBe(0);
  });

  it('respects the token cap', () => {
    const candidates = [bandTurn(1, { summary: 'Mira.' })];
    expect(selectRehydrations(candidates, ['mira'], [], 0).size).toBe(0);
  });

  it('respects the count cap, keeping the best-scoring turns', () => {
    const candidates = [
      bandTurn(1, { summary: 'Mira vault gold.' }), // score 3
      bandTurn(3, { summary: 'Mira vault.' }), // score 2
      bandTurn(5, { summary: 'Mira.' }), // score 1
    ];
    const chosen = selectRehydrations(candidates, ['mira', 'vault', 'gold'], [], WIDE, 1);
    expect([...chosen]).toEqual(['t1']); // only the top scorer
  });

  it('rehydrates on entity participation even when the digest shares no words', () => {
    const candidates = [
      bandTurn(1, { summary: 'A quiet stroll.', entities: ['Mira'] }), // word score 0, entity hit
      bandTurn(3, { summary: 'Nothing relevant.' }), // no match
    ];
    const chosen = selectRehydrations(candidates, ['vault'], ['Mira'], WIDE);
    expect([...chosen]).toEqual(['t1']);
  });

  it('orders an entity-participation hit ahead of a word-only hit', () => {
    const candidates = [
      bandTurn(1, { summary: 'vault vault vault.' }), // high word score, no entity
      bandTurn(3, { summary: 'A stroll.', entities: ['Mira'] }), // entity hit
    ];
    const chosen = selectRehydrations(candidates, ['vault'], ['mira'], WIDE, 1);
    expect([...chosen]).toEqual(['t3']); // entity hit wins the single slot
  });
});

describe('buildBandedHistory', () => {
  const base = { contextWindow: WIDE, promptTokens: 0, maxTokens: 0, verbatimFloor: 2, rehydrateCap: WIDE, actionEntities: [] as string[] };

  it('keeps the recent floor verbatim and bands older turns, with no overlap', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', game_text: 'g4', summary: 's4' }),
    ]);
    const { messages } = buildBandedHistory({ ...base, turns, keywords: [] });
    // Band leads, covering the two older turns only, as an assistant (narrator) message.
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].content).toContain('Story so far');
    expect(messages[0].content).toContain('s1');
    expect(messages[0].content).toContain('s2');
    expect(messages[0].content).not.toContain('s3');
    expect(messages[0].content).not.toContain('s4');
    // Floor turns follow verbatim, chronological.
    expect(messages.slice(1).map((m) => m.content)).toEqual(['a3', 'g3', 'a4', 'g4']);
  });

  it('drops older turns that have no digest', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1' }), // no summary
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', game_text: 'g4', summary: 's4' }),
    ]);
    const { messages } = buildBandedHistory({ ...base, turns, keywords: [] });
    expect(messages[0].content).toContain('s2');
    expect(messages[0].content).not.toContain('g1'); // dropped, not banded
  });

  it('rehydrates a relevant older turn to full text and removes it from the band', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'the vault scene', summary: 'You opened the vault.' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 'A quiet walk.' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', game_text: 'g4', summary: 's4' }),
    ]);
    const { messages, counts } = buildBandedHistory({ ...base, turns, keywords: ['vault'] });
    // t1 comes back verbatim, ahead of the floor, and its digest is no longer in the band.
    expect(messages.some((m) => m.content === 'the vault scene')).toBe(true);
    const band = messages.find((m) => m.content.includes('Story so far'));
    expect(band?.content).not.toContain('You opened the vault.');
    expect(counts.rehydratedTokens).toBeGreaterThan(0);
  });

  it('caps how many older turns rehydrate so the band is not cannibalized', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1', summary: 'Mira vault gold.' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 'Mira vault.' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3', summary: 'Mira.' }),
      ...pair('a4', { turnId: 't4', game_text: 'g4', summary: 's4' }),
      ...pair('a5', { turnId: 't5', game_text: 'g5', summary: 's5' }),
    ]);
    // Floor (base) is 2 → t4,t5 verbatim; candidates t1,t2,t3 all match, but only 1 may rehydrate.
    const { messages, counts } = buildBandedHistory({
      ...base,
      turns,
      keywords: ['mira', 'vault', 'gold'],
      maxRehydrations: 1,
    });
    expect(counts.rehydratedTokens).toBeGreaterThan(0); // t1 (top score) rehydrated
    expect(counts.turnsBanded).toBe(2); // t2,t3 stay in the band — not cannibalized
    const band = messages.find((m) => m.content.includes('Story so far'));
    expect(band).toBeDefined();
  });

  it('treats everything as verbatim for a short game (no older turns)', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 's2' }),
    ]);
    const { messages } = buildBandedHistory({ ...base, turns, keywords: [] });
    expect(messages.some((m) => m.content.includes('Story so far'))).toBe(false);
    expect(messages.map((m) => m.content)).toEqual(['a1', 'g1', 'a2', 'g2']);
  });

  it('trims the oldest band lines when the budget is tight', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', game_text: 'g1', summary: 'OLDEST ' + 'x'.repeat(2000) }),
      ...pair('a2', { turnId: 't2', game_text: 'g2', summary: 'NEWERBAND' }),
      ...pair('a3', { turnId: 't3', game_text: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', game_text: 'g4', summary: 's4' }),
    ]);
    // Small window: floor (t3,t4) fits, but the band can't hold the huge oldest line.
    const { messages } = buildBandedHistory({ ...base, contextWindow: 600, turns, keywords: [] });
    const band = messages.find((m) => m.content.includes('Story so far'));
    expect(band?.content).not.toContain('OLDEST');
    expect(band?.content).toContain('NEWERBAND');
  });
});
