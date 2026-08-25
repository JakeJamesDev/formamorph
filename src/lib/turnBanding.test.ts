import { describe, it, expect } from 'vitest';
import type { AITurnResult, ChatMessage, DictionaryEntry } from '@/types';
import {
  parseTurns,
  buildVerbatimHistory,
  extractKeywords,
  scoreTurnDigest,
  selectRehydrations,
  buildBandedHistory,
  importanceFactors,
  IMPORTANCE_SPREAD,
  type BandTurn,
} from './turnBanding';
import { runsTile } from './requestAnatomy';

const user = (content: string): ChatMessage => ({ role: 'user', content });

const assistant = (turn: Partial<AITurnResult> & { narration?: string }): ChatMessage => ({
  role: 'assistant',
  content: JSON.stringify({ narration: '', choices: [], stat_changes: [], ...turn }),
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
  it('parses each pair, capturing turnId/summary/narration', () => {
    const history = [
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2' }),
    ];
    const turns = parseTurns(history);
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({ turnId: 't1', gameText: 'g1', summary: 's1' });
    expect(turns[1]).toMatchObject({ turnId: 't2', gameText: 'g2', summary: undefined });
  });

  it('carries the measured turn duration through, for the clock', () => {
    const turns = parseTurns(pair('a1', { turnId: 't1', narration: 'g1', timeDelta: 8 }));
    expect(turns[0].timeDelta).toBe(8);
    // A pre-clock turn stays undefined rather than defaulting here — the resolver charges the flat hour.
    expect(parseTurns(pair('a2', { turnId: 't2', narration: 'g2' }))[0].timeDelta).toBeUndefined();
  });

  it('skips unparseable assistant turns', () => {
    const history = [user('a1'), { role: 'assistant', content: 'not json {' } as ChatMessage];
    expect(parseTurns(history)).toEqual([]);
  });
});

describe('buildVerbatimHistory', () => {
  it('returns every turn chronologically when the budget is ample', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2' }),
    ]);
    const out = buildVerbatimHistory(turns, WIDE, 0, 0);
    expect(out.messages.map((m) => m.content)).toEqual(['a1', 'g1', 'a2', 'g2']);
  });

  it('keeps the newest turns and drops older ones past the budget', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'x'.repeat(40000) }), // huge, will not fit
      ...pair('a2', { turnId: 't2', narration: 'g2' }),
      ...pair('a3', { turnId: 't3', narration: 'g3' }),
    ]);
    const out = buildVerbatimHistory(turns, 5120, 0, 0);
    expect(out.messages.map((m) => m.content)).toEqual(['a2', 'g2', 'a3', 'g3']);
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
    const dict: DictionaryEntry[] = [{ id: '1', name: 'Mira', key: ['Mira', 'vault keeper'], value: 'A guard.' }];
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
  const RECAP = 'Recap the story so far.';
  const base = { contextWindow: WIDE, promptTokens: 0, maxTokens: 0, verbatimFloor: 2, rehydrateCap: WIDE, actionEntities: [] as string[], recapPrompt: RECAP };

  it('keeps the recent floor verbatim and merges older turns into one leading recap exchange', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
    ]);
    const { messages, recap } = buildBandedHistory({ ...base, turns, keywords: [] });
    // Banded turns (t1,t2) ride as ONE exchange — the recap question answered by the merged digests —
    // never as per-turn pairs (many short "own replies" collapse small-model narration length; see
    // digest-framing-probe.mjs). The recent floor (t3,t4) stays full. Alternation stays strict.
    expect(messages.map((m) => m.role)).toEqual([
      'user', 'assistant', 'user', 'assistant', 'user', 'assistant',
    ]);
    expect(messages.map((m) => m.content)).toEqual([RECAP, 's1 s2', 'a3', 'g3', 'a4', 'g4']);
    // The banded turns' real actions ride only in the planner recap, never as history user messages.
    expect(messages.some((m) => m.content === 'a1' || m.content === 'a2')).toBe(false);
    // The "Earlier events" label lives only in the planner recap, never in the narration history.
    expect(messages.some((m) => m.content.includes('Earlier events'))).toBe(false);
    expect(recap).toContain('Earlier events');
    expect(recap).toContain('s1');
    expect(recap).toContain('s2');
    expect(recap).not.toContain('s3'); // floor turns aren't in the band recap
  });

  it('appends the now-line to the recap reply, and only when a band exists', () => {
    const NOW = 'Now you are at the dock; the scene is already underway.';
    const withBand = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
    ]);
    const { messages } = buildBandedHistory({ ...base, turns: withBand, keywords: [], nowLine: NOW });
    expect(messages[1].content).toBe(`s1\n\n${NOW}`);
    // No band (short game) → no recap exchange, so no now-line either.
    const short = parseTurns([...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' })]);
    const shortOut = buildBandedHistory({ ...base, turns: short, keywords: [], nowLine: NOW });
    expect(shortOut.messages.some((m) => m.content.includes(NOW))).toBe(false);
  });

  it('drops older turns that have no digest', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1' }), // no summary
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
    ]);
    const { messages } = buildBandedHistory({ ...base, turns, keywords: [] });
    // t1 has no summary → dropped entirely; t2 alone fills the recap exchange, t3/t4 stay full.
    expect(messages.map((m) => m.content)).toEqual([RECAP, 's2', 'a3', 'g3', 'a4', 'g4']);
    expect(messages.some((m) => m.content === 'g1' || m.content === 'a1')).toBe(false);
  });

  // TODO(rehydration): re-enable with the feature. Rehydration is disabled in buildBandedHistory (it drove
  // the charged-scene freeze); these two behavior tests assert the disabled path. selectRehydrations and the
  // scorers stay unit-tested above, so the logic is still covered for when it is restored.
  it.skip('rehydrates a relevant older turn to full text and removes it from the band', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'the vault scene', summary: 'You opened the vault.' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 'A quiet walk.' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
    ]);
    const { messages, recap, counts } = buildBandedHistory({ ...base, turns, keywords: ['vault'] });
    // t1 comes back verbatim (full narration, not its summary), ahead of the banded t2 and the floor.
    expect(messages.some((m) => m.content === 'the vault scene')).toBe(true);
    expect(messages.some((m) => m.content === 'You opened the vault.')).toBe(false);
    expect(recap).not.toContain('You opened the vault.'); // no longer in the band
    expect(recap).toContain('A quiet walk.'); // t2 still banded
    expect(counts.rehydratedTokens).toBeGreaterThan(0);
  });

  it.skip('caps how many older turns rehydrate so the band is not cannibalized', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 'Mira vault gold.' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 'Mira vault.' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 'Mira.' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
      ...pair('a5', { turnId: 't5', narration: 'g5', summary: 's5' }),
    ]);
    // Floor (base) is 2 → t4,t5 verbatim; candidates t1,t2,t3 all match, but only 1 may rehydrate.
    const { recap, counts } = buildBandedHistory({
      ...base,
      turns,
      keywords: ['mira', 'vault', 'gold'],
      maxRehydrations: 1,
    });
    expect(counts.rehydratedTokens).toBeGreaterThan(0); // t1 (top score) rehydrated
    expect(counts.turnsBanded).toBe(2); // t2,t3 stay in the band — not cannibalized
    expect(recap).toContain('Mira vault.'); // t2 still banded
  });

  it('treats everything as verbatim for a short game (no older turns)', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
    ]);
    const { messages, recap } = buildBandedHistory({ ...base, turns, keywords: [] });
    expect(recap).toBe('');
    expect(messages.some((m) => m.content.includes('Earlier events'))).toBe(false);
    // No band → no recap exchange at all.
    expect(messages.some((m) => m.content === RECAP)).toBe(false);
    expect(messages.map((m) => m.content)).toEqual(['a1', 'g1', 'a2', 'g2']);
  });

  it('trims the oldest band turns when the budget is tight', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 'OLDEST ' + 'x'.repeat(2000) }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 'NEWERBAND' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
    ]);
    // Small window: floor (t3,t4) fits, but the band can't hold the huge oldest turn — it's dropped.
    const { messages, recap } = buildBandedHistory({ ...base, contextWindow: 600, turns, keywords: [] });
    expect(recap).not.toContain('OLDEST');
    expect(recap).toContain('NEWERBAND');
    expect(messages.some((m) => m.content.includes('NEWERBAND'))).toBe(true); // t2 survives in the recap exchange
    expect(messages.some((m) => m.content.includes('OLDEST'))).toBe(false);
  });
});

describe('buildBandedHistory relevance-ranked trimming', () => {
  const RECAP = 'Recap the story so far.';
  // verbatimFloor 0 keeps the whole budget for the band; each ~400-char digest costs ~100 tokens and
  // contextWindow 620 (margin 256) leaves room for three of the five.
  const base = { contextWindow: 620, promptTokens: 0, maxTokens: 0, verbatimFloor: 0, rehydrateCap: 0, actionEntities: [] as string[], keywords: [] as string[], recapPrompt: RECAP };
  const digest = (tag: string) => `${tag} ${'x'.repeat(392)}`;
  const fiveTurns = () =>
    parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: digest('D1') }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: digest('D2') }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: digest('D3') }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: digest('D4') }),
      ...pair('a5', { turnId: 't5', narration: 'g5', summary: digest('D5') }),
    ]);
  const scores = (map: Record<string, number>) => new Map(Object.entries(map));
  const survivors = (recap: string) => ['D1', 'D2', 'D3', 'D4', 'D5'].filter((d) => recap.includes(d));

  it('drops the lowest-scored eligible memories instead of the oldest, keeping chronological order', () => {
    const { recap, counts } = buildBandedHistory({
      ...base, turns: fiveTurns(),
      relevanceScores: scores({ t1: 0.9, t2: 0.1, t3: 0.8, t4: 0.2, t5: 0.7 }),
    });
    // t4/t5 are the newest two (immune); the middle competes and t2 then t3 go.
    expect(survivors(recap)).toEqual(['D1', 'D4', 'D5']);
    expect(counts.turnsRelevanceDropped).toBe(2);
    expect(counts.turnsSelectedOut).toBe(0);
  });

  it('never drops the protected ends — opening or the newest two — however low they score', () => {
    const { recap } = buildBandedHistory({
      ...base, turns: fiveTurns(),
      relevanceScores: scores({ t1: 0.0, t2: 0.9, t3: 0.8, t4: 0.0, t5: 0.0 }),
    });
    // t1 (opening) and t4/t5 (scene lead-in) all score lowest yet survive; the middle goes instead.
    expect(survivors(recap)).toEqual(['D1', 'D4', 'D5']);
  });

  it('falls back to oldest-first when the score map misses any band turn', () => {
    const { recap, counts } = buildBandedHistory({
      ...base, turns: fiveTurns(),
      relevanceScores: scores({ t1: 0.9, t2: 0.9, t3: 0.9, t4: 0.9 }), // t5 missing
    });
    expect(survivors(recap)).toEqual(['D3', 'D4', 'D5']);
    expect(counts.turnsRelevanceDropped).toBe(0);
  });

  it('produces the oldest-first result when scores are absent — the off path', () => {
    const unscored = buildBandedHistory({ ...base, turns: fiveTurns() });
    const nullScored = buildBandedHistory({ ...base, turns: fiveTurns(), relevanceScores: null });
    expect(unscored).toEqual(nullScored);
    expect(survivors(unscored.recap)).toEqual(['D3', 'D4', 'D5']);
  });

  it('applies milestone drops first, then ranks the survivors — scores for dropped turns not required', () => {
    const { recap, counts } = buildBandedHistory({
      ...base, turns: fiveTurns(),
      milestoneDrop: new Set(['t2']),
      relevanceScores: scores({ t1: 0.9, t3: 0.1, t4: 0.8, t5: 0.7 }), // no t2 — it's already gone
    });
    expect(counts.turnsSelectedOut).toBe(1);
    // Four remain, three fit: t3 is least relevant.
    expect(survivors(recap)).toEqual(['D1', 'D4', 'D5']);
    expect(counts.turnsRelevanceDropped).toBe(1);
  });

  it('still empties a one-turn band that cannot fit', () => {
    const turns = parseTurns([...pair('a1', { turnId: 't1', narration: 'g1', summary: 'HUGE ' + 'x'.repeat(4000) })]);
    const { recap, counts } = buildBandedHistory({
      ...base, turns, relevanceScores: scores({ t1: 1 }),
    });
    expect(recap).toBe('');
    expect(counts.turnsRelevanceDropped).toBe(0); // terminal drop is the plain path, not a ranked one
  });
});

describe('buildBandedHistory always-on band cap', () => {
  const RECAP = 'Recap the story so far.';
  // Wide window: nothing is budget-trimmed, so any drop comes from the cap alone.
  const base = { contextWindow: 1_000_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 0, rehydrateCap: 0, actionEntities: [] as string[], keywords: [] as string[], recapPrompt: RECAP };
  const sixTurns = () =>
    parseTurns(Array.from({ length: 6 }, (_, i) => pair(`a${i + 1}`, { turnId: `t${i + 1}`, narration: `g${i + 1}`, summary: `D${i + 1}` })).flat());
  const scores = (map: Record<string, number>) => new Map(Object.entries(map));
  const survivors = (recap: string) => ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].filter((d) => new RegExp(`${d}\\b`).test(recap));

  it('trims a fitting band down to the K most relevant, ends protected', () => {
    const { recap, counts } = buildBandedHistory({
      ...base, turns: sixTurns(), bandCap: 4,
      relevanceScores: scores({ t1: 0.0, t2: 0.9, t3: 0.1, t4: 0.2, t5: 0.0, t6: 0.0 }),
    });
    // 6 → 4: t3 and t4 (lowest eligible) go; t1 (opening) and t5/t6 (newest two) are immune.
    expect(survivors(recap)).toEqual(['D1', 'D2', 'D5', 'D6']);
    expect(counts.turnsRelevanceDropped).toBe(2);
    expect(counts.turnsBanded).toBe(4);
  });

  it('does nothing without scores, at cap 0, or when the band is already within the cap', () => {
    const unscored = buildBandedHistory({ ...base, turns: sixTurns(), bandCap: 3 });
    expect(survivors(unscored.recap)).toHaveLength(6); // no scores → cap never blind-trims by age
    const uncapped = buildBandedHistory({ ...base, turns: sixTurns(), bandCap: 0, relevanceScores: scores({ t1: 1, t2: 1, t3: 1, t4: 1, t5: 1, t6: 1 }) });
    expect(survivors(uncapped.recap)).toHaveLength(6);
    const within = buildBandedHistory({ ...base, turns: sixTurns(), bandCap: 10, relevanceScores: scores({ t1: 1, t2: 1, t3: 1, t4: 1, t5: 1, t6: 1 }) });
    expect(within.counts.turnsRelevanceDropped).toBe(0);
  });

  it('clamps a too-small cap to the protected floor (opening + newest two)', () => {
    const { recap } = buildBandedHistory({
      ...base, turns: sixTurns(), bandCap: 1,
      relevanceScores: scores({ t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0 }),
    });
    expect(survivors(recap)).toEqual(['D1', 'D5', 'D6']); // floor of 3, never fewer
  });

  it('reports the surviving band ids so the caller can feed them back as sticky', () => {
    const { bandTurnIds } = buildBandedHistory({
      ...base, turns: sixTurns(), bandCap: 4,
      relevanceScores: scores({ t1: 0.0, t2: 0.9, t3: 0.1, t4: 0.2, t5: 0.0, t6: 0.0 }),
    });
    expect(bandTurnIds).toEqual(['t1', 't2', 't5', 't6']);
  });
});

describe('importanceFactors', () => {
  it('spreads by RANK, not by raw value — so a model-relative scale still orders correctly', () => {
    // Cydonia rates in a compressed band (2 vs 3), the cloud tier in a wide one (1 vs 3). Ranking
    // must produce the SAME factors from both, which is the whole reason it exists.
    const compressed = importanceFactors(['a', 'b'], new Map([['a', 2], ['b', 3]]));
    const wide = importanceFactors(['a', 'b'], new Map([['a', 1], ['b', 3]]));
    expect(compressed.get('a')).toBeCloseTo(1 / IMPORTANCE_SPREAD);
    expect(compressed.get('b')).toBeCloseTo(1);
    expect([...compressed.entries()]).toEqual([...wide.entries()]);
  });

  it('places an unrated memory at the midpoint, never at the bottom', () => {
    const f = importanceFactors(['lo', 'mid', 'hi'], new Map([['lo', 1], ['hi', 3]]));
    expect(f.get('mid')!).toBeGreaterThan(f.get('lo')!);
    expect(f.get('mid')!).toBeLessThan(f.get('hi')!);
  });

  it('collapses to a flat 1 when nothing distinguishes the band', () => {
    const allSame = importanceFactors(['a', 'b'], new Map([['a', 2], ['b', 2]]));
    const none = importanceFactors(['a', 'b'], new Map());
    const off = importanceFactors(['a', 'b'], null);
    for (const f of [allSame, none, off]) expect([...f.values()]).toEqual([1, 1]);
  });
});

describe('buildBandedHistory importance ranking', () => {
  const RECAP = 'Recap the story so far.';
  const base = { contextWindow: 1_000_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 0, rehydrateCap: 0, actionEntities: [] as string[], keywords: [] as string[], recapPrompt: RECAP };
  const scores = (map: Record<string, number>) => new Map(Object.entries(map));
  const turnsWith = (importance: Record<string, number | undefined>) =>
    parseTurns(Array.from({ length: 6 }, (_, i) => pair(`a${i + 1}`, {
      turnId: `t${i + 1}`, narration: `g${i + 1}`, summary: `D${i + 1}`, importance: importance[`t${i + 1}`],
    })).flat());

  it('keeps the pivotal memory over the slightly more topical one', () => {
    // t4 is marginally more relevant (0.40 vs 0.36) but rated 1; t3 is rated 3. This is the
    // turn-96 shape from the findings doc: a comfort scene out-matching the arc it belongs to.
    const args = { ...base, bandCap: 4, relevanceScores: scores({ t1: 0.9, t2: 0.0, t3: 0.36, t4: 0.40, t5: 0.9, t6: 0.9 }) };
    const { bandTurnIds } = buildBandedHistory({ ...args, turns: turnsWith({ t3: 3, t4: 1 }) });
    expect(bandTurnIds).toContain('t3');
    expect(bandTurnIds).not.toContain('t4');
    // Same relevance, no ratings → the topical one wins, proving importance is what flipped it.
    const unrated = buildBandedHistory({ ...args, turns: turnsWith({}) });
    expect(unrated.bandTurnIds).toContain('t4');
    expect(unrated.bandTurnIds).not.toContain('t3');
  });

  it('does not let importance override a large relevance gap', () => {
    const { bandTurnIds } = buildBandedHistory({
      ...base, bandCap: 4, turns: turnsWith({ t3: 3, t4: 1 }),
      relevanceScores: scores({ t1: 0.9, t2: 0.0, t3: 0.10, t4: 0.90, t5: 0.9, t6: 0.9 }),
    });
    expect(bandTurnIds).toContain('t4');
  });
});

describe('buildBandedHistory sticky band membership', () => {
  const RECAP = 'Recap the story so far.';
  const base = { contextWindow: 1_000_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 0, rehydrateCap: 0, actionEntities: [] as string[], keywords: [] as string[], recapPrompt: RECAP };
  const sixTurns = () =>
    parseTurns(Array.from({ length: 6 }, (_, i) => pair(`a${i + 1}`, { turnId: `t${i + 1}`, narration: `g${i + 1}`, summary: `D${i + 1}` })).flat());
  const scores = (map: Record<string, number>) => new Map(Object.entries(map));

  // t3 is the incumbent; t4 outscores it raw (0.40 vs 0.35) but by less than STICKY_BONUS, so the
  // incumbent must hold. This is the churn the feature exists to stop: without hysteresis the band
  // flips on a margin this small every turn (measured 57% of free slots/turn on a real session).
  const contested = {
    ...base, turns: sixTurns(), bandCap: 4,
    relevanceScores: scores({ t1: 0.9, t2: 0.0, t3: 0.35, t4: 0.40, t5: 0.9, t6: 0.9 }),
  };

  it('holds an incumbent that a challenger beats by less than the margin', () => {
    const { bandTurnIds } = buildBandedHistory({ ...contested, stickyIds: new Set(['t3']) });
    expect(bandTurnIds).toContain('t3');
    expect(bandTurnIds).not.toContain('t4');
  });

  it('drops that same incumbent when it is not sticky — proving the bonus is what held it', () => {
    const { bandTurnIds } = buildBandedHistory({ ...contested, stickyIds: null });
    expect(bandTurnIds).toContain('t4');
    expect(bandTurnIds).not.toContain('t3');
  });

  it('still evicts an incumbent a challenger beats by more than the margin', () => {
    // 0.9 vs 0.35 × 1.25 = 0.4375 — a real improvement, not noise.
    const { bandTurnIds } = buildBandedHistory({
      ...base, turns: sixTurns(), bandCap: 4, stickyIds: new Set(['t3']),
      relevanceScores: scores({ t1: 0.9, t2: 0.0, t3: 0.35, t4: 0.9, t5: 0.9, t6: 0.9 }),
    });
    expect(bandTurnIds).toContain('t4');
    expect(bandTurnIds).not.toContain('t3');
  });

  it('never lets stickiness override the protected ends or act unscored', () => {
    // t2 sticky and top-scored cannot save t1/t5/t6 from being protected regardless.
    const { bandTurnIds } = buildBandedHistory({
      ...base, turns: sixTurns(), bandCap: 1, stickyIds: new Set(['t2']),
      relevanceScores: scores({ t1: 0, t2: 0.9, t3: 0, t4: 0, t5: 0, t6: 0 }),
    });
    expect(bandTurnIds).toEqual(['t1', 't5', 't6']);
    // Unscored: hysteresis has nothing to rank, so the band is untouched.
    const unscored = buildBandedHistory({ ...base, turns: sixTurns(), bandCap: 3, stickyIds: new Set(['t3']) });
    expect(unscored.bandTurnIds).toHaveLength(6);
  });
});

describe('buildBandedHistory semantic rehydration', () => {
  const RECAP = 'Recap the story so far.';
  const RECALL = 'Recall the earlier scene.';
  const base = {
    contextWindow: 1_000_000, promptTokens: 0, maxTokens: 0, verbatimFloor: 1,
    rehydrateCap: 1_000_000, actionEntities: [] as string[], keywords: [] as string[],
    recapPrompt: RECAP, rehydratePrompt: RECALL,
  };
  const fourTurns = () =>
    parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'SCENE-ONE', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'SCENE-TWO', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'SCENE-THREE', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'FLOOR-TURN', summary: 's4' }),
    ]);

  it('rides chosen turns as ONE framed exchange after the recap, never as live pairs', () => {
    const { messages, counts } = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: ['t2', 't1'] });
    expect(messages.map((m) => m.content)).toEqual([
      RECAP, 's3',                          // band shrinks to the un-rehydrated digest
      RECALL, 'SCENE-ONE\n\nSCENE-TWO',     // remembered scenes, chronological, one exchange
      'a4', 'FLOOR-TURN',                   // floor unchanged
    ]);
    // The rehydrated turns' real user messages must NOT ride — that's the live-looking-history bug.
    expect(messages.some((m) => m.content === 'a1' || m.content === 'a2')).toBe(false);
    expect(counts.turnsRehydrated).toBe(2);
    expect(counts.turnsVerbatim).toBe(3); // 2 recalled + 1 floor
  });

  it('removes rehydrated turns from the recap so no event rides twice', () => {
    const { messages, recap } = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: ['t1'] });
    const recapReply = messages[1].content;
    expect(recapReply).not.toContain('s1');
    expect(recapReply).toContain('s2');
    expect(recap).not.toContain('s1'); // the planner recap agrees
  });

  it('ignores ids not in the band and does nothing when the list is empty', () => {
    const withUnknown = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: ['t4', 'ghost'] }); // t4 is floor
    expect(withUnknown.messages.some((m) => m.content === RECALL)).toBe(false);
    expect(withUnknown.counts.turnsRehydrated).toBe(0);
    const empty = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: [] });
    expect(empty.messages).toEqual(buildBandedHistory({ ...base, turns: fourTurns() }).messages);
  });

  it('respects the token budget and the maxRehydrations cap', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'HUGE ' + 'x'.repeat(4000), summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'SMALL-SCENE', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'ALSO-SMALL', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'FLOOR-TURN', summary: 's4' }),
    ]);
    // Budget fits the small scenes but not the huge one — it's skipped, not blocking.
    const budgeted = buildBandedHistory({ ...base, turns, rehydrateCap: 200, semanticRehydrate: ['t1', 't2', 't3'] });
    expect(budgeted.messages.find((m) => m.content.includes('SMALL-SCENE'))).toBeTruthy();
    expect(budgeted.messages.some((m) => m.content.includes('HUGE'))).toBe(false);
    // maxRehydrations 1 keeps only the best-ranked.
    const capped = buildBandedHistory({ ...base, turns, maxRehydrations: 1, semanticRehydrate: ['t2', 't3'] });
    expect(capped.counts.turnsRehydrated).toBe(1);
    expect(capped.messages.some((m) => m.content.includes('ALSO-SMALL'))).toBe(false);
  });

});

describe('buildBandedHistory in-world time stamps', () => {
  const RECAP = 'Recap the story so far.';
  const base = { contextWindow: WIDE, promptTokens: 0, maxTokens: 0, verbatimFloor: 2, rehydrateCap: WIDE, actionEntities: [] as string[], recapPrompt: RECAP };
  const stamp = (pos: number) => `[T${pos}]`;
  const stamped = (extra: Parameters<typeof buildBandedHistory>[0]['notes'] = []) => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
      ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
    ]);
    return { turns, notes: extra };
  };

  it('prefixes each banded digest with its stamp, leaving the verbatim floor untouched', () => {
    const { turns } = stamped();
    const { messages, recap } = buildBandedHistory({ ...base, turns, keywords: [], stamp });
    // t1 is the assistant at index 1, t2 at index 3.
    expect(messages[1].content).toBe('[T1] s1 [T3] s2');
    expect(recap).toContain('[T1] s1');
    // The floor is the live scene, not a memory — it is never stamped.
    expect(messages.slice(2).every((m) => !m.content.includes('[T'))).toBe(true);
  });

  it('stamps a player-written note at its anchor, like any other memory', () => {
    const { turns, notes } = stamped([{ id: 'n1', text: 'note', anchorTurn: 2 }]);
    const { messages } = buildBandedHistory({ ...base, turns, keywords: [], stamp, notes });
    expect(messages[1].content).toBe('[T1] s1 [T2] note [T3] s2');
  });

  it('leaves the band byte-identical when no stamp is supplied', () => {
    const { turns } = stamped();
    const plain = buildBandedHistory({ ...base, turns, keywords: [] });
    expect(plain.messages[1].content).toBe('s1 s2');
    expect(plain.counts.bandTokens).toBeLessThan(
      buildBandedHistory({ ...base, turns, keywords: [], stamp }).counts.bandTokens,
    );
  });

  it('costs the stamps against the band budget rather than overflowing silently', () => {
    const { turns } = stamped();
    // A window sized to fit the UNSTAMPED band exactly (margin floors at 256). Stamps make the band
    // bigger, so the stamped run must drop a digest at that same window. Were the stamps uncosted the
    // stamped band would keep every digest and silently overflow the window.
    const plain = buildBandedHistory({ ...base, turns, keywords: [] });
    const exact = plain.counts.floorTokens + plain.counts.bandTokens + 256;
    expect(buildBandedHistory({ ...base, turns, keywords: [], contextWindow: exact }).counts.turnsBanded)
      .toBe(plain.counts.turnsBanded);
    expect(buildBandedHistory({ ...base, turns, keywords: [], stamp, contextWindow: exact }).counts.turnsBanded)
      .toBeLessThan(plain.counts.turnsBanded);
  });
});

describe('buildBandedHistory anatomy runs', () => {
  const RECAP = 'Recap the story so far.';
  const RECALL = 'Recall in full the earlier moment my next action returns to.';
  const NOW = 'Now you are at the dock; the scene is already underway.';
  const base = {
    contextWindow: WIDE, promptTokens: 0, maxTokens: 0, verbatimFloor: 2, rehydrateCap: WIDE,
    actionEntities: [] as string[], keywords: [] as string[], recapPrompt: RECAP,
  };
  const fourTurns = () => parseTurns([
    ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
    ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
    ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
    ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
  ]);
  /** Every run's label paired with the text its offsets actually select. */
  const labeled = (r: ReturnType<typeof buildBandedHistory>) =>
    r.runs.map((runs, i) => runs.map((run) => [run.source ?? run.contextLabel, r.messages[i].content.slice(run.start, run.end)]));

  it('gives every message a run list that tiles its content exactly', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns(), nowLine: NOW, semanticRehydrate: ['t2'], rehydratePrompt: RECALL });
    expect(out.runs).toHaveLength(out.messages.length);
    out.messages.forEach((m, i) => expect(runsTile(m.content, out.runs[i])).toBe(true));
  });

  it('labels the recap question as authored and its digests as condensed context', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns() });
    expect(labeled(out)[0]).toEqual([['recap', RECAP]]);
    expect(labeled(out)[1]).toEqual([['condensed', 's1 s2']]);
  });

  it('marks the now-line inside the recap reply, sliced to exactly the now-line text', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns(), nowLine: NOW });
    const reply = out.runs[1];
    expect(reply).toHaveLength(2);
    // The blank line that joins them rides with the digests, so the now run starts on its own first word.
    expect(out.messages[1].content.slice(reply[0].start, reply[0].end)).toBe('s1 s2\n\n');
    expect(out.messages[1].content.slice(reply[1].start, reply[1].end)).toBe(NOW);
    expect(reply[1].source).toBe('now');
  });

  it('leaves no now run at all when no now-line was passed', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns() });
    expect(out.runs.flat().some((r) => r.source === 'now')).toBe(false);
  });

  it('leaves no recap or now runs when the floor swallows every turn (no band)', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns(), verbatimFloor: 99, nowLine: NOW });
    const sources = out.runs.flat().map((r) => r.source);
    expect(sources).not.toContain('recap');
    expect(sources).not.toContain('now');
    expect(out.messages.some((m) => m.content.includes(NOW))).toBe(false);
  });

  it('describes a verbatim pair asymmetrically: the action, then the narration that answered it', () => {
    const out = buildBandedHistory({ ...base, turns: fourTurns() });
    expect(labeled(out).slice(2)).toEqual([
      [['past-action', 'a3']],
      [['past-narration', 'g3']],
      [['past-action', 'a4']],
      [['past-narration', 'g4']],
    ]);
  });

  it('labels the recall exchange, and drops both runs when Scene Recall did not fire', () => {
    const on = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: ['t2'], rehydratePrompt: RECALL });
    expect(labeled(on)[2]).toEqual([['recall', RECALL]]);
    expect(labeled(on)[3]).toEqual([['recalled', 'g2']]);
    const off = buildBandedHistory({ ...base, turns: fourTurns(), semanticRehydrate: null, rehydratePrompt: RECALL });
    const labels = off.runs.flat().map((r) => r.source ?? r.contextLabel);
    expect(labels).not.toContain('recall');
    expect(labels).not.toContain('recalled');
  });

  it('separates a player note from the digests it sits between', () => {
    const out = buildBandedHistory({
      ...base, turns: fourTurns(),
      notes: [{ id: 'n1', text: 'The tide turns at dusk.', anchorTurn: 1 }],
    });
    // Each join rides with the piece before it, so every run starts on its own first character.
    expect(labeled(out)[1]).toEqual([
      ['condensed', 's1 '],
      ['notes', 'The tide turns at dusk. '],
      ['condensed', 's2'],
    ]);
  });

  it('carries the in-world stamp inside the run of the memory it labels', () => {
    const stamp = (pos: number) => `[Day ${pos}]`;
    const out = buildBandedHistory({ ...base, turns: fourTurns(), stamp });
    expect(labeled(out)[1]).toEqual([['condensed', '[Day 1] s1 [Day 3] s2']]);
  });
});

describe('buildVerbatimHistory anatomy runs', () => {
  it('tiles every message, and names the notes lead as the player own writing', () => {
    const turns = parseTurns([
      ...pair('a1', { turnId: 't1', narration: 'g1' }),
      ...pair('a2', { turnId: 't2', narration: 'g2' }),
    ]);
    const out = buildVerbatimHistory(turns, WIDE, 0, 0, [{ id: 'n1', text: 'FIRST', anchorTurn: 2 }], 'RECAP?');
    expect(out.runs).toHaveLength(out.messages.length);
    out.messages.forEach((m, i) => expect(runsTile(m.content, out.runs[i])).toBe(true));
    expect(out.runs[0][0].source).toBe('recap');
    expect(out.runs[1][0].contextLabel).toBe('notes');
    expect(out.runs.slice(2).flat().map((r) => r.contextLabel)).toEqual([
      'past-action', 'past-narration', 'past-action', 'past-narration',
    ]);
  });
});
