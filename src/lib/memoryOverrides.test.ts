import { describe, it, expect } from 'vitest';
import type { AITurnResult, ChatMessage } from '@/types';
import { parseTurns, buildBandedHistory, buildVerbatimHistory, type BandTurn } from './turnBanding';
import { applyMemoryOverrides, activeNotes, PLAYER_EDIT_IMPORTANCE, type MemoryOverrides } from './memoryOverrides';
import { milestoneCandidates, resolveMilestoneKeep, resolveMilestoneDrop } from './milestoneMemory';
import { buildMemoryLedger } from './memoryView';

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (turn: Partial<AITurnResult> & { narration?: string }): ChatMessage => ({
  role: 'assistant',
  content: JSON.stringify({ narration: '', choices: [], stat_changes: [], ...turn }),
});
const pair = (action: string, turn: Partial<AITurnResult>): ChatMessage[] => [user(action), assistant(turn)];

/** Four summarized turns — enough for a band plus a floor. */
const history = (): ChatMessage[] => [
  ...pair('a1', { turnId: 't1', narration: 'g1', summary: 's1' }),
  ...pair('a2', { turnId: 't2', narration: 'g2', summary: 's2' }),
  ...pair('a3', { turnId: 't3', narration: 'g3', summary: 's3' }),
  ...pair('a4', { turnId: 't4', narration: 'g4', summary: 's4' }),
];

const WIDE = 1_000_000;

const band = (turns: BandTurn[], overrides: MemoryOverrides = {}, verbatimFloor = 1) =>
  buildBandedHistory({
    turns,
    contextWindow: WIDE,
    promptTokens: 0,
    maxTokens: 0,
    verbatimFloor,
    keywords: [],
    actionEntities: [],
    rehydrateCap: 0,
    recapPrompt: 'RECAP?',
    notes: activeNotes(overrides),
  });

describe('applyMemoryOverrides', () => {
  it('leaves turns untouched when there is no override layer', () => {
    const turns = parseTurns(history());
    expect(applyMemoryOverrides(turns, null)).toBe(turns);
    expect(applyMemoryOverrides(turns, {})).toBe(turns);
    expect(applyMemoryOverrides(turns, { edits: {}, deleted: [], notes: [] })).toBe(turns);
  });

  it('replaces the summary with a player rewrite and ranks it top importance', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), {
      edits: { t2: { text: 'the player version', source: 'player' } },
    });
    expect(turns[1].summary).toBe('the player version');
    expect(turns[1].importance).toBe(PLAYER_EDIT_IMPORTANCE);
  });

  it('a regenerated summary replaces the text but does NOT claim top importance', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), {
      edits: { t2: { text: 'the AI second attempt', source: 'ai' } },
    });
    expect(turns[1].summary).toBe('the AI second attempt');
    expect(turns[1].importance).toBeUndefined();
  });

  it('never mutates the input turns — the AI original survives for revert', () => {
    const turns = parseTurns(history());
    applyMemoryOverrides(turns, { edits: { t2: { text: 'x', source: 'player' } }, deleted: ['t3'] });
    expect(turns[1].summary).toBe('s2');
    expect(turns[2].summary).toBe('s3');
  });

  it('a tombstone strips the summary but keeps the turn (its narration still rides the floor)', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), { deleted: ['t2'] });
    expect(turns).toHaveLength(4);
    expect(turns[1].summary).toBeUndefined();
    expect(turns[1].gameText).toBe('g2');
  });

  it('a tombstone wins over an edit on the same turn', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), {
      deleted: ['t2'],
      edits: { t2: { text: 'edited', source: 'player' } },
    });
    expect(turns[1].summary).toBeUndefined();
  });
});

describe('activeNotes', () => {
  it('returns notes chronologically and drops tombstoned ones', () => {
    const notes = activeNotes({
      notes: [
        { id: 'n2', text: 'later', anchorTurn: 8 },
        { id: 'n1', text: 'earlier', anchorTurn: 2 },
        { id: 'n3', text: 'gone', anchorTurn: 4 },
      ],
      deleted: ['n3'],
    });
    expect(notes.map((n) => n.text)).toEqual(['earlier', 'later']);
  });
});

describe('overrides through the selector', () => {
  it('a deleted memory is not a selection candidate at all', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), { deleted: ['t2'] });
    expect(milestoneCandidates(turns).map((t) => t.turnId)).toEqual(['t1', 't3', 't4']);
  });

  it('the selector judges the edited text, not the original', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), {
      edits: { t2: { text: 'what the player wrote', source: 'player' } },
    });
    expect(milestoneCandidates(turns).map((t) => t.summary)).toContain('what the player wrote');
    expect(milestoneCandidates(turns).map((t) => t.summary)).not.toContain('s2');
  });

  it('a keep pin holds an edited memory even when the selector dropped it', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), {
      edits: { t3: { text: 'mine', source: 'player' } },
    });
    const cands = milestoneCandidates(turns);
    const selection = { seen: new Set(['t2', 't3', 't4']), selected: new Set<string>() };
    // Without the auto-pin the selector's verdict would let it go...
    expect(resolveMilestoneKeep(cands, selection, {}).has('t3')).toBe(false);
    // ...with it (what editing writes), it stays.
    expect(resolveMilestoneKeep(cands, selection, { t3: 'keep' }).has('t3')).toBe(true);
  });

  it('the oldest-memory guard slides to the next survivor when the opening is deleted', () => {
    const selection = { seen: new Set(['t1', 't2', 't3', 't4']), selected: new Set<string>() };
    const before = milestoneCandidates(applyMemoryOverrides(parseTurns(history()), {}));
    // The guard force-keeps the opening against a drop-everything verdict.
    expect([...resolveMilestoneKeep(before, selection, {})]).toEqual(['t1']);
    const after = milestoneCandidates(applyMemoryOverrides(parseTurns(history()), { deleted: ['t1'] }));
    expect([...resolveMilestoneKeep(after, selection, {})]).toEqual(['t2']);
  });

  it('a deleted memory never reaches the drop set (it is gone, not dropped)', () => {
    const turns = applyMemoryOverrides(parseTurns(history()), { deleted: ['t2'] });
    const drop = resolveMilestoneDrop(milestoneCandidates(turns), null, {});
    expect(drop.has('t2')).toBe(false);
  });
});

describe('notes in the assembled history', () => {
  it('splices a note at its anchor, between the digests it was written among', () => {
    const turns = parseTurns(history());
    // t1..t4 sit at message indices 1,3,5,7; anchor 4 falls between t2 and t3.
    const { messages } = band(turns, { notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 4 }] });
    const recap = messages.find((m) => m.role === 'assistant')!.content;
    expect(recap).toBe('s1 s2 NOTE s3');
  });

  it('a note anchored past the band lands last — the standing block before the floor', () => {
    const turns = parseTurns(history());
    const { messages } = band(turns, { notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 99 }] });
    expect(messages.find((m) => m.role === 'assistant')!.content).toBe('s1 s2 s3 NOTE');
  });

  it('a note rides even when every digest was dropped', () => {
    const turns = parseTurns(history());
    const { messages } = buildBandedHistory({
      turns,
      contextWindow: WIDE,
      promptTokens: 0,
      maxTokens: 0,
      verbatimFloor: 1,
      keywords: [],
      actionEntities: [],
      rehydrateCap: 0,
      recapPrompt: 'RECAP?',
      milestoneDrop: new Set(['t1', 't2', 't3']),
      notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 2 }],
    });
    expect(messages[0]).toEqual({ role: 'user', content: 'RECAP?' });
    expect(messages[1].content).toBe('NOTE');
  });

  it('notes survive milestone filtering — they are never judged', () => {
    const turns = parseTurns(history());
    const { messages } = buildBandedHistory({
      turns,
      contextWindow: WIDE,
      promptTokens: 0,
      maxTokens: 0,
      verbatimFloor: 1,
      keywords: [],
      actionEntities: [],
      rehydrateCap: 0,
      recapPrompt: 'RECAP?',
      milestoneDrop: new Set(['t2']),
      notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 4 }],
    });
    expect(messages.find((m) => m.role === 'assistant')!.content).toBe('s1 NOTE s3');
  });

  it('the planner recap carries notes too, one per line', () => {
    const turns = parseTurns(history());
    const { recap } = band(turns, { notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 4 }] });
    expect(recap).toBe('Earlier events:\ns1\ns2\nNOTE\ns3');
  });

  it('no notes leaves the band byte-identical to the pre-feature body', () => {
    const turns = parseTurns(history());
    expect(band(turns, {}).messages.find((m) => m.role === 'assistant')!.content).toBe('s1 s2 s3');
  });

  it('with digests off, notes lead as a standing block ahead of the verbatim history', () => {
    const turns = parseTurns(history());
    const messages = buildVerbatimHistory(turns, WIDE, 0, 0, [
      { id: 'n1', text: 'FIRST', anchorTurn: 2 },
      { id: 'n2', text: 'SECOND', anchorTurn: 6 },
    ], 'RECAP?');
    expect(messages[0]).toEqual({ role: 'user', content: 'RECAP?' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'FIRST SECOND' });
    expect(messages[2]).toEqual({ role: 'user', content: 'a1' });
    expect(messages).toHaveLength(10);
  });

  it('with digests off and no notes, the verbatim history is unchanged', () => {
    const turns = parseTurns(history());
    expect(buildVerbatimHistory(turns, WIDE, 0, 0)).toEqual(buildVerbatimHistory(turns, WIDE, 0, 0, [], 'RECAP?'));
  });
});

describe('buildMemoryLedger', () => {
  const ledger = (overrides: MemoryOverrides, pins = {}, selection: { seen: string[]; selected: string[] | null } | null = null) =>
    buildMemoryLedger({ history: history(), overrides, pins, selection, verbatimFloor: 1 });

  it('lists every memory chronologically with its turn number', () => {
    const { rows, totalCount } = ledger({});
    expect(rows.map((r) => r.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(rows.map((r) => r.turnNumber)).toEqual([1, 2, 3, 4]);
    expect(totalCount).toBe(4);
  });

  it('carries the AI original alongside an edit so revert has a target', () => {
    const { rows } = ledger({ edits: { t2: { text: 'mine', source: 'player' } } });
    expect(rows[1]).toMatchObject({ text: 'mine', original: 's2', edited: 'player' });
  });

  it('keeps a deleted memory in the ledger, flagged and out of the counts', () => {
    const { rows, totalCount } = ledger({ deleted: ['t2'] });
    const t2 = rows.find((r) => r.id === 't2')!;
    expect(t2).toMatchObject({ deleted: true, kept: false, text: 's2' });
    expect(totalCount).toBe(3);
  });

  it('places a note at its anchor and marks it kept without a verdict', () => {
    const { rows } = ledger({ notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 4 }] });
    expect(rows.map((r) => r.id)).toEqual(['t1', 't2', 'n1', 't3', 't4']);
    expect(rows[2]).toMatchObject({ isNote: true, kept: true });
  });

  it('counts a let-go memory as not kept', () => {
    const { keptCount } = ledger({}, {}, { seen: ['t2', 't3'], selected: ['t2'] });
    expect(keptCount).toBe(3); // t1 (opening guard), t2 (kept), t4 (unseen) — t3 was let go
  });

  it('puts the Recent divider where the verbatim floor begins', () => {
    // Floor 1 → t4 rides verbatim, so it is the first Recent row.
    expect(ledger({}).recentFrom).toBe(3);
  });
});

describe('buildMemoryLedger time stamps', () => {
  /** Four turns, each a full day apart — a measured clock, not the flat hour. */
  const measured = (): ChatMessage[] => [
    ...pair('a1', { turnId: 't1', summary: 's1', timeDelta: 24 }),
    ...pair('a2', { turnId: 't2', summary: 's2', timeDelta: 24 }),
    ...pair('a3', { turnId: 't3', summary: 's3', timeDelta: 24 }),
    ...pair('a4', { turnId: 't4', summary: 's4', timeDelta: 24 }),
  ];
  const stamped = (history: ChatMessage[], nowHours: number, overrides: MemoryOverrides = {}) =>
    buildMemoryLedger({ history, overrides, pins: {}, selection: null, verbatimFloor: 1, clock: { nowHours } }).rows;

  it('leaves every row unstamped when no clock is passed', () => {
    const { rows } = buildMemoryLedger({ history: measured(), overrides: {}, pins: {}, selection: null, verbatimFloor: 1 });
    expect(rows.every((r) => r.stamp === undefined)).toBe(true);
  });

  it('dates each memory by its own measured elapsed time, not its position in the list', () => {
    // Day 1 opens at hour 8, so a turn costing 24h lands on the next day at the same daypart.
    const rows = stamped(measured(), 96);
    expect(rows.map((r) => r.stamp)).toEqual([
      'Day 2, morning — three days ago',
      'Day 3, morning — two days ago',
      'Day 4, morning — yesterday',
      'Day 5, morning — moments ago',
    ]);
  });

  it('charges the flat hour for turns the clock never measured, so a mixed history stays ordered', () => {
    // t1/t2 predate the setting; t3/t4 were measured at a day each.
    const mixed: ChatMessage[] = [
      ...pair('a1', { turnId: 't1', summary: 's1' }),
      ...pair('a2', { turnId: 't2', summary: 's2' }),
      ...pair('a3', { turnId: 't3', summary: 's3', timeDelta: 24 }),
      ...pair('a4', { turnId: 't4', summary: 's4', timeDelta: 24 }),
    ];
    expect(stamped(mixed, 50).map((r) => r.stamp)).toEqual([
      'Day 1, morning — two days ago',
      'Day 1, morning — two days ago',
      'Day 2, morning — yesterday',
      'Day 3, morning — moments ago',
    ]);
  });

  it('stamps player-written memories at their anchor, like any other row', () => {
    const rows = stamped(measured(), 96, { notes: [{ id: 'n1', text: 'NOTE', anchorTurn: 4 }] });
    const note = rows.find((r) => r.id === 'n1')!;
    expect(note.stamp).toBe('Day 3, morning — two days ago');
  });

  it('stamps rows under the Recent divider too', () => {
    const rows = stamped(measured(), 96);
    expect(rows[rows.length - 1].stamp).toBeTruthy();
  });
});
