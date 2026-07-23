import { describe, it, expect } from 'vitest';
import {
  MILESTONE_RECENT_BAND,
  buildMilestoneUserMessage,
  parseMilestoneReply,
  milestoneCandidates,
  agedMilestoneCandidates,
  resolveMilestoneKeep,
  resolveMilestoneDrop,
} from './milestoneMemory';
import { buildBandedHistory, type BandTurn } from './turnBanding';
import type { ChatMessage } from '@/types';

/** A digest-carrying turn; `summary: undefined` models a turn whose digest hasn't been written yet. */
function turn(i: number, summary?: string): BandTurn {
  return {
    index: i * 2 + 1,
    turnId: `t${i}`,
    userMsg: { role: 'user', content: `action ${i}` } as ChatMessage,
    gameText: `narration ${i}`,
    summary,
  };
}

const turns = (n: number) => Array.from({ length: n }, (_, i) => turn(i, `digest ${i}`));

describe('milestoneCandidates', () => {
  it('lists every digest-carrying turn — a memory shows the turn it forms, floor included', () => {
    const list = turns(4);
    list[1] = turn(1, undefined); // digest not yet written
    expect(milestoneCandidates(list).map((t) => t.turnId)).toEqual(['t0', 't2', 't3']);
  });
});

describe('agedMilestoneCandidates', () => {
  it('ships with no recent band: a digest filters context the moment it leaves the floor', () => {
    expect(MILESTONE_RECENT_BAND).toBe(0);
    expect(agedMilestoneCandidates(turns(3), 3)).toEqual([]);
    expect(agedMilestoneCandidates(turns(4), 3).map((t) => t.turnId)).toEqual(['t0']);
  });

  it('returns the oldest digest-carrying turns past the floor and recent band, chronological', () => {
    const cands = agedMilestoneCandidates(turns(12), 3, 6);
    expect(cands.map((t) => t.turnId)).toEqual(['t0', 't1', 't2']);
  });

  it('counts the recent band in digest-carrying turns (an undigested turn does not shift the window)', () => {
    const list = turns(12);
    list[1] = turn(1, undefined); // digest not yet written
    const cands = agedMilestoneCandidates(list, 3, 6);
    expect(cands.map((t) => t.turnId)).toEqual(['t0', 't2']);
  });
});

describe('parseMilestoneReply', () => {
  it('parses a comma-separated keep list to zero-based indices', () => {
    expect([...parseMilestoneReply('2, 5, 9', 10)!]).toEqual([1, 4, 8]);
  });

  it('ignores out-of-range numbers', () => {
    expect([...parseMilestoneReply('1, 40', 10)!]).toEqual([0]);
  });

  it('is null (keep everything) on empty or prose replies', () => {
    expect(parseMilestoneReply('', 10)).toBeNull();
    expect(parseMilestoneReply('I would keep the entry about the ferry because it still matters to Halvern and the debt (entry 2).', 10)).toBeNull();
  });
});

describe('resolveMilestoneKeep / resolveMilestoneDrop', () => {
  const cands = turns(5);
  const selection = { seen: new Set(['t0', 't1', 't2', 't3', 't4']), selected: new Set(['t1', 't3']) };

  it('keeps everything when there is no selection yet', () => {
    expect(resolveMilestoneKeep(cands, null).size).toBe(5);
    expect(resolveMilestoneDrop(cands, null).size).toBe(0);
  });

  it('applies the selector verdict — except the opening anchor, which is always kept', () => {
    expect([...resolveMilestoneKeep(cands, selection)]).toEqual(['t0', 't1', 't3']);
    expect([...resolveMilestoneDrop(cands, selection)]).toEqual(['t2', 't4']);
  });

  it('a turn the selector never saw always survives', () => {
    const partial = { seen: new Set(['t0', 't1']), selected: new Set<string>([]) };
    expect([...resolveMilestoneKeep(cands, partial)]).toEqual(['t0', 't2', 't3', 't4']);
  });

  it('a player drop-pin still removes the opening anchor', () => {
    const keep = resolveMilestoneKeep(cands, selection, { t0: 'drop' });
    expect(keep.has('t0')).toBe(false);
  });

  it('a malformed run (selected null) keeps everything it saw', () => {
    expect(resolveMilestoneKeep(cands, { seen: selection.seen, selected: null }).size).toBe(5);
  });

  it('pins override the verdict both ways', () => {
    const keep = resolveMilestoneKeep(cands, selection, { t0: 'keep', t3: 'drop' });
    expect([...keep]).toEqual(['t0', 't1']);
  });
});

describe('buildBandedHistory milestone filtering', () => {
  const args = {
    contextWindow: 100000,
    promptTokens: 0,
    maxTokens: 0,
    verbatimFloor: 3,
    keywords: [],
    actionEntities: [],
    rehydrateCap: 0,
    recapPrompt: 'Recap the story so far.',
  };

  it('drops exactly the given turn ids from the digest band', () => {
    const list = turns(12);
    const { messages, counts } = buildBandedHistory({ ...args, turns: list, milestoneDrop: new Set(['t0', 't2']) });
    const joined = messages.map((m) => m.content).join('\n');
    expect(joined).not.toContain('digest 0');
    expect(joined).toContain('digest 1');
    expect(joined).not.toContain('digest 2');
    expect(joined).toContain('narration 11'); // floor untouched
    expect(counts.turnsSelectedOut).toBe(2);
  });

  it('an empty or absent drop set filters nothing', () => {
    const list = turns(12);
    const { counts } = buildBandedHistory({ ...args, turns: list, milestoneDrop: new Set() });
    expect(counts.turnsSelectedOut).toBe(0);
    expect(buildBandedHistory({ ...args, turns: list }).counts.turnsSelectedOut).toBe(0);
  });
});

describe('buildMilestoneUserMessage', () => {
  it('numbers the digests oldest first', () => {
    expect(buildMilestoneUserMessage(['a', 'b'])).toContain('1. a\n2. b');
  });
});
