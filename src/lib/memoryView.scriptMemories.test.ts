/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, expect, it } from 'vitest';
import type { AITurnResult, ChatMessage } from '@/types';
import { buildMemoryLedger, scriptMemories } from './memoryView';
import { formatStampPlain, type WorldCalendar } from './gameClock';
import { executeStatCode } from './statCodeExecutor';
import type { MemoryOverrides } from './memoryOverrides';

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (turn: Partial<AITurnResult>): ChatMessage => ({
  role: 'assistant',
  content: JSON.stringify({ narration: '', choices: [], stat_changes: [], ...turn }),
});
const pair = (action: string, turn: Partial<AITurnResult>): ChatMessage[] => [user(action), assistant(turn)];

/** Five digested turns on a measured clock: 4, 6, 10, 2 and 8 story hours. */
const history: ChatMessage[] = [
  ...pair('a1', { turnId: 't1', summary: 's1', timeDelta: 4 }),
  ...pair('a2', { turnId: 't2', summary: 's2', timeDelta: 6 }),
  ...pair('a3', { turnId: 't3', summary: 's3', timeDelta: 10 }),
  ...pair('a4', { turnId: 't4', summary: 's4', timeDelta: 2 }),
  ...pair('a5', { turnId: 't5', summary: 's5', timeDelta: 8 }),
];
const calendar: WorldCalendar = { hoursPerDay: 24, startHour: 8 };
// A Custom line added after turn 3, when the history held six messages.
const overrides: MemoryOverrides = { deleted: ['t4'], notes: [{ id: 'n1', text: 'The bridge is out.', anchorTurn: 6 }] };
const ledgerOf = (clock?: { nowHours: number; calendar?: WorldCalendar }) => buildMemoryLedger({
  history, overrides, pins: { t2: 'keep', t3: 'drop' }, selection: null, verbatimFloor: 1, clock,
  context: { bandIds: ['t1'] },
});

describe('scriptMemories', () => {
  it('lists the live rows oldest first, the deleted row absent, verdicts and the Custom flag on the right rows', () => {
    const entries = scriptMemories(ledgerOf(), history, calendar);
    expect(entries.map((entry) => entry.id)).toEqual(['t1', 't2', 't3', 'n1', 't5']);
    expect(entries.map(({ id, pinned, forgotten, custom }) => ({ id, pinned, forgotten, custom }))).toEqual([
      { id: 't1', pinned: false, forgotten: false, custom: false },
      { id: 't2', pinned: true, forgotten: false, custom: false },
      { id: 't3', pinned: false, forgotten: true, custom: false },
      { id: 'n1', pinned: false, forgotten: false, custom: true },
      { id: 't5', pinned: false, forgotten: false, custom: false },
    ]);
    expect(entries[0]).toMatchObject({ text: 's1', kept: true, inContext: true });
    expect(entries[2]).toMatchObject({ kept: false, inContext: false });
    expect(entries[3]).toMatchObject({ text: 'The bridge is out.', kept: true, inContext: true });
  });

  it('reads each entry’s play turn, and the turn that closed before a Custom line was added', () => {
    expect(scriptMemories(ledgerOf(), history, calendar).map((entry) => entry.turn)).toEqual([1, 2, 3, 3, 5]);
  });

  it('times each entry as the panel’s stamp resolver does, a Custom line at its anchor turn', () => {
    const nowHours = 30;
    const ledger = ledgerOf({ nowHours, calendar });
    const entries = scriptMemories(ledger, history, calendar);
    expect(entries.map((entry) => entry.timestamp)).toEqual([4, 10, 20, 20, 30]);
    const stampOf = new Map(ledger.rows.map((row) => [row.id, row.stamp]));
    for (const entry of entries) expect(formatStampPlain(entry.timestamp, nowHours, calendar), entry.id).toBe(stampOf.get(entry.id));
    // Hour 8 + 20 is 04:00 on day 2; hour 8 + 30 is 14:00.
    expect(entries.slice(2).map(({ day, daypart }) => ({ day, daypart }))).toEqual([
      { day: 2, daypart: 'night' }, { day: 2, daypart: 'night' }, { day: 2, daypart: 'afternoon' },
    ]);
  });

  it('lets a script gather the memories made at night', async () => {
    const res = await executeStatCode('return memories.filter((m) => m.daypart === "night").map((m) => m.turn).join("") === "33" ? 1 : 0;',
      [], { id: 's', name: 'S', type: 'number', description: '', min: 0, max: 9, value: 0, regen: 0, descriptors: [] },
      { memories: scriptMemories(ledgerOf(), history, calendar) });
    expect(res.value).toBe(1);
  });

  it('carries no original text, override history or relevance into a run, and stays small over 400 rows', () => {
    const long: ChatMessage[] = [];
    const edits: NonNullable<MemoryOverrides['edits']> = {};
    for (let i = 1; i <= 400; i++) {
      long.push(...pair(`a${i}`, { turnId: `t${i}`, summary: `ORIGINAL-${i} ${'x'.repeat(200)}`, importance: 3, timeDelta: 1 }));
      edits[`t${i}`] = { text: `Edited memory ${i}.`, source: 'player' };
    }
    const ledger = buildMemoryLedger({
      history: long, overrides: { edits }, pins: {}, selection: null, verbatimFloor: 1, context: { bandIds: ['t1'] },
    });
    const entries = scriptMemories(ledger, long);
    expect(entries).toHaveLength(400);
    const json = JSON.stringify(entries);
    expect(json).not.toMatch(/ORIGINAL|importance|original|edited"|source/);
    expect(Object.keys(entries[0]).sort()).toEqual(
      ['custom', 'day', 'daypart', 'forgotten', 'id', 'inContext', 'kept', 'pinned', 'text', 'timestamp', 'turn'],
    );
    // About 150 bytes of fields per row beside its text.
    expect(json.length).toBeLessThan(400 * (160 + 'Edited memory 400.'.length));
  });
});
