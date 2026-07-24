import { describe, it, expect } from 'vitest';
import {
  MILESTONE_RECENT_BAND,
  buildMilestoneUserMessage,
  parseMilestoneReply,
  buildIncrementalMilestoneUserMessage,
  parseIncrementalMilestoneReply,
  applyIncrementalVerdict,
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

describe('buildIncrementalMilestoneUserMessage', () => {
  it('numbers kept context and new arrivals continuously', () => {
    const msg = buildIncrementalMilestoneUserMessage(['old a', 'old b'], ['new c']);
    expect(msg).toContain('1. old a\n2. old b');
    expect(msg).toContain('3. new c');
    expect(msg).toContain('Forget:');
  });

  it('asks only for the Keep line when nothing is kept yet', () => {
    const msg = buildIncrementalMilestoneUserMessage([], ['new a', 'new b']);
    expect(msg).toContain('1. new a\n2. new b');
    expect(msg).not.toContain('Forget:');
  });
});

describe('parseIncrementalMilestoneReply', () => {
  it('parses Keep and honors a Forget only as a citation of a kept new entry', () => {
    const v = parseIncrementalMilestoneReply('Keep: 4, 5\nForget: 2 replaced by 4', 3, 2)!;
    expect([...v.keepFresh]).toEqual([0, 1]); // 4,5 → fresh indices 0,1
    expect([...v.forgetOld]).toEqual([1]);    // 2 → old index 1, cited by kept 4
  });

  it('voids an uncited Forget and one whose citation is not kept — the anti-flip-flop filter', () => {
    expect(parseIncrementalMilestoneReply('Keep: 4\nForget: 2', 3, 2)!.forgetOld.size).toBe(0);
    expect(parseIncrementalMilestoneReply('Keep: 4\nForget: 2 replaced by 5', 3, 2)!.forgetOld.size).toBe(0);
  });

  it('parses one-line replies with trailing prose (the Cydonia shape)', () => {
    const v = parseIncrementalMilestoneReply('Keep: 4 Forget: 2 replaced by 4 The promise is now fulfilled.', 3, 2)!;
    expect([...v.keepFresh]).toEqual([0]);
    expect([...v.forgetOld]).toEqual([1]);
  });

  it('ignores out-of-range numbers: Keep only applies to fresh, Forget only to old', () => {
    const v = parseIncrementalMilestoneReply('Keep: 1, 4\nForget: none', 3, 2)!;
    expect([...v.keepFresh]).toEqual([0]);
    expect(v.forgetOld.size).toBe(0);
  });

  it('accepts a bare number list as keeps and "none" as keep-nothing', () => {
    const v = parseIncrementalMilestoneReply('4, 5', 3, 2)!;
    expect([...v.keepFresh]).toEqual([0, 1]);
    expect(v.forgetOld.size).toBe(0);
    const none = parseIncrementalMilestoneReply('Keep: none\nForget: none', 3, 2)!;
    expect(none.keepFresh.size).toBe(0);
    expect(none.forgetOld.size).toBe(0);
  });

  it('treats an explicit Forget with no Keep line as keep-nothing-new (and voids its uncited forget)', () => {
    const v = parseIncrementalMilestoneReply('Forget: 2', 3, 2)!;
    expect(v.keepFresh.size).toBe(0);
    expect(v.forgetOld.size).toBe(0);
  });

  it('returns null on prose — callers keep all new and touch nothing old', () => {
    expect(parseIncrementalMilestoneReply('', 3, 2)).toBeNull();
    expect(parseIncrementalMilestoneReply('I would keep the moment with the ferryman because the debt still matters to him.', 3, 2)).toBeNull();
  });
});

describe('applyIncrementalVerdict', () => {
  const prev = { seen: ['t0', 't1', 't2'], selected: ['t0', 't2'] };

  it('adds kept fresh ids and forgets superseded old ids, preserving everything else', () => {
    const out = applyIncrementalVerdict(prev, ['t0', 't2'], ['t3', 't4'], {
      keepFresh: new Set([1]),
      forgetOld: new Set([1]), // shown old index 1 = t2
    });
    expect(out.seen).toEqual(['t0', 't1', 't2', 't3', 't4']);
    expect(out.selected).toEqual(['t0', 't4']);
  });

  it('a null verdict keeps every fresh entry and leaves old verdicts untouched', () => {
    const out = applyIncrementalVerdict(prev, ['t0', 't2'], ['t3'], null);
    expect(out.seen).toEqual(['t0', 't1', 't2', 't3']);
    expect(out.selected).toEqual(['t0', 't2', 't3']);
  });

  it('materializes a legacy malformed full-vote (selected null) as keep-everything-seen', () => {
    const out = applyIncrementalVerdict({ seen: ['t0', 't1'], selected: null }, ['t0', 't1'], ['t2'], {
      keepFresh: new Set([0]),
      forgetOld: new Set([0]),
    });
    expect(out.selected).toEqual(['t1', 't2']);
  });

  it('starts from nothing: no prior selection, first batch judged', () => {
    const out = applyIncrementalVerdict(null, [], ['t0', 't1'], { keepFresh: new Set([1]), forgetOld: new Set() });
    expect(out.seen).toEqual(['t0', 't1']);
    expect(out.selected).toEqual(['t1']);
  });
});
