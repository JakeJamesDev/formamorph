import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/types';
import type { TurnTextEdits } from '@/lib/turnTextEdits';
import { diaryTurn } from '@/test/diaryTurns';
import { buildDiaries, diaryCounts, isReadEntry, visibleDiaryEntries } from './diaryView';

const turn = (turnId: string, diaries: Record<string, string>, codeDiaries?: Record<string, string[]>) =>
  diaryTurn(turnId, { diaries, ...(codeDiaries ? { codeDiaries } : {}) });

const names = (history: ChatMessage[], layer?: TurnTextEdits) => buildDiaries(history, layer).map((d) => d.name);

describe('buildDiaries', () => {
  it('lists one diary per name in order of first appearance, entries oldest first', () => {
    const history = [
      ...turn('t1', { Wick: 'I ran.' }),
      ...turn('t2', { Bram: 'I watched.', Wick: 'I hid.' }),
      ...turn('t3', { Bram: 'I slept.' }),
    ];
    const diaries = buildDiaries(history, undefined);
    expect(diaries.map((d) => d.name)).toEqual(['Wick', 'Bram']);
    expect(diaries[1].entries.map((e) => [e.turnNumber, e.text])).toEqual([[2, 'I watched.'], [3, 'I slept.']]);
  });

  it('keeps every row in place when a new name appears', () => {
    const before = [...turn('t1', { Wick: 'I ran.' }), ...turn('t2', { Bram: 'I watched.' })];
    const after = [...before, ...turn('t3', { Odette: 'I arrived.', Bram: 'Another one.' })];
    expect(names(after)).toEqual([...names(before), 'Odette']);
  });

  it('matches names without case under the first spelling, and keys each entry by its own spelling', () => {
    const history = [...turn('t1', { Bram: 'One.' }), ...turn('t2', { bram: 'Two.' })];
    const layer: TurnTextEdits = { t2: { diaries: { bram: { text: 'Mine.', source: 'player' } } } };
    const [diary] = buildDiaries(history, layer);
    expect(diary.name).toBe('Bram');
    expect(diary.entries.map((e) => e.text)).toEqual(['One.', 'Mine.']);
  });

  it('applies the layer: a player edit, a kept rewrite and a delete', () => {
    const history = [...turn('t1', { Bram: 'One.' }), ...turn('t2', { Bram: 'Two.' }), ...turn('t3', { Bram: 'Three.' })];
    const layer: TurnTextEdits = {
      t1: { diaries: { Bram: { text: 'Fixed.', source: 'player' } } },
      t2: { diaries: { Bram: { text: 'Again.', source: 'ai' } } },
      t3: { diaries: { Bram: { source: 'player', deleted: true } } },
    };
    const [{ entries }] = buildDiaries(history, layer);
    expect(entries.map((e) => [e.text, e.original, e.edited, e.deleted])).toEqual([
      ['Fixed.', 'One.', 'player', false],
      ['Again.', 'Two.', 'ai', false],
      ['Three.', undefined, undefined, true],
    ]);
    expect(entries.map(isReadEntry)).toEqual([true, true, false]);
  });

  it('marks a "nothing notable" entry quiet and unread, and an edit over it makes it a real entry', () => {
    const history = [...turn('t1', { Bram: 'nothing notable' }), ...turn('t2', { Bram: 'Nothing notable' })];
    const layer: TurnTextEdits = { t2: { diaries: { Bram: { text: 'I remember now.', source: 'player' } } } };
    const [{ entries }] = buildDiaries(history, layer);
    expect(entries.map((e) => [e.quiet, isReadEntry(e)])).toEqual([[true, false], [false, true]]);
  });

  it('keeps script lines apart and read-only, beside an edited entry', () => {
    const history = turn('t1', { Bram: 'She knows.' }, { bram: ['My oath grows heavier.'] });
    const layer: TurnTextEdits = { t1: { diaries: { Bram: { text: 'She guessed.', source: 'player' } } } };
    const [{ entries }] = buildDiaries(history, layer);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ text: 'She guessed.', scriptLines: ['My oath grows heavier.'] });
  });

  it('gives a name with only script lines an entry the AI reads, and a quiet entry with script lines too', () => {
    const history = [
      ...turn('t1', {}, { Ferryman: ['The river rose.'] }),
      ...turn('t2', { Bram: 'nothing notable' }, { Bram: ['My oath grows heavier.'] }),
    ];
    const diaries = buildDiaries(history, undefined);
    expect(diaries.map((d) => d.name)).toEqual(['Ferryman', 'Bram']);
    expect(diaries[0].entries[0]).toMatchObject({ text: '', quiet: true, scriptLines: ['The river rose.'] });
    expect(diaries.map((d) => isReadEntry(d.entries[0]))).toEqual([true, true]);
  });

  it('ignores layer records for turns that are gone', () => {
    const history = turn('t1', { Bram: 'One.' });
    const layer: TurnTextEdits = { gone: { diaries: { Bram: { text: 'Stale.', source: 'player' } } } };
    expect(buildDiaries(history, layer)[0].entries.map((e) => e.text)).toEqual(['One.']);
  });

  it('shows no diary for a history without entries', () => {
    expect(buildDiaries(turn('t1', {}), undefined)).toEqual([]);
  });
});

describe('a diary view', () => {
  const history = [
    ...turn('t1', { Bram: 'I watched the door.' }),
    ...turn('t2', { Bram: 'nothing notable' }),
    ...turn('t3', { Bram: 'nothing notable' }, { Bram: ['My oath grows heavier.'] }),
    ...turn('t4', { Bram: 'I slept.' }),
  ];
  const layer: TurnTextEdits = { t4: { diaries: { Bram: { source: 'player', deleted: true } } } };
  const [diary] = buildDiaries(history, layer);
  const turnsOf = (entries: { turnId: string }[]) => entries.map((e) => e.turnId);

  it('counts what the AI reads and the quiet entries, leaving deletes out of both', () => {
    expect(diaryCounts(diary)).toEqual({ read: 2, hidden: 1 });
  });

  it('lists quiet entries only with Show Hidden Entries, and never a deleted one', () => {
    expect(turnsOf(visibleDiaryEntries(diary, { query: '', showHidden: false }))).toEqual(['t1', 't3']);
    expect(turnsOf(visibleDiaryEntries(diary, { query: '', showHidden: true }))).toEqual(['t1', 't2', 't3']);
  });

  it('searches the entry and its script lines', () => {
    expect(turnsOf(visibleDiaryEntries(diary, { query: 'DOOR', showHidden: false }))).toEqual(['t1']);
    expect(turnsOf(visibleDiaryEntries(diary, { query: 'oath', showHidden: false }))).toEqual(['t3']);
    expect(turnsOf(visibleDiaryEntries(diary, { query: 'slept', showHidden: true }))).toEqual([]);
  });
});
