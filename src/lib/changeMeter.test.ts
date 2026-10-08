import { describe, it, expect } from 'vitest';
import { diffSlice, type SliceEdit, type SliceName, type WorldSlices } from '@/lib/editorHistory';
import { DISCRETE_UNITS, measureChange, measureEdits, textChange } from '@/lib/changeMeter';
import type { Dictionary, Entity, Stat, WorldOverview } from '@/types';

const edit = <S extends SliceName>(slice: S, was: WorldSlices[S], now: WorldSlices[S]): SliceEdit[] => {
  const found = diffSlice(slice, was, now);
  return found ? [found] : [];
};
const units = (edits: SliceEdit[]) => measureChange({ edits, merged: false });

const overview = { name: 'Sedge Landing', description: '', tags: ['fen'], thumbnail: null } as unknown as WorldOverview;
const entity = (over: Partial<Entity> = {}) => ({ id: 'e1', name: 'Odd Wick', aiDescription: 'Keeps lamps.', ...over }) as Entity;
const stat = (id: string) => ({ id, name: id }) as unknown as Stat;

describe('textChange', () => {
  it('counts a typed character as one', () => expect(textChange('Odd Wic', 'Odd Wick')).toBe(1));
  it('counts a replaced word by its longer side', () => expect(textChange('the old lamp', 'the brass lamp')).toBe(5));
  it('counts a deleted selection by its length', () => expect(textChange('a long tail', 'a tail')).toBe(5));
  it('counts a repeated letter once', () => expect(textChange('aaa', 'aaaa')).toBe(1));
});

describe('measureEdits', () => {
  it('counts text in the overview by the characters changed', () => {
    expect(units(edit('worldOverview', overview, { ...overview, name: 'Sedge Landings' }))).toBe(1);
  });

  it('counts the first character of a field that was absent', () => {
    expect(units(edit('entities', [entity()], [entity({ playerDescription: 'A' })]))).toBe(1);
  });

  it('counts a toggle as one discrete action', () => {
    expect(units(edit('worldOverview', overview, { ...overview, use3DModel: true }))).toBe(DISCRETE_UNITS);
  });

  it('counts an added tag and a removed tag as one action each', () => {
    expect(units(edit('worldOverview', overview, { ...overview, tags: ['fen', 'mist'] }))).toBe(DISCRETE_UNITS);
    expect(units(edit('worldOverview', overview, { ...overview, tags: [] }))).toBe(DISCRETE_UNITS);
  });

  it('counts an image as one action, however long its data', () => {
    const image = `data:image/webp;base64,${'A'.repeat(5000)}`;
    expect(units(edit('worldOverview', overview, { ...overview, thumbnail: image }))).toBe(DISCRETE_UNITS);
  });

  it('counts an added and a removed record as one action each', () => {
    expect(units(edit('stats', [stat('a')], [stat('a'), stat('b')]))).toBe(DISCRETE_UNITS);
    expect(units(edit('stats', [stat('a'), stat('b')], [stat('a')]))).toBe(DISCRETE_UNITS);
  });

  it('counts a reorder as one action', () => {
    const [a, b, c] = [stat('a'), stat('b'), stat('c')];
    expect(units(edit('stats', [a, b, c], [c, a, b]))).toBe(DISCRETE_UNITS);
  });

  it('reaches text inside a nested record by id', () => {
    const book = (content: string) => ({
      id: 'book', name: 'Lore', entries: [{ id: 'x', keys: ['fen'], content: 'Old.' }, { id: 'y', keys: ['lamp'], content }],
    }) as unknown as Dictionary;
    expect(units(edit('dictionaries', [book('Lit at dusk')], [book('Lit at dusk.')]))).toBe(1);
  });

  it('adds text and discrete parts across slices', () => {
    const edits = [
      ...edit('worldOverview', overview, { ...overview, name: 'Sedge' }),
      ...edit('stats', [], [stat('a')]),
    ];
    expect(measureEdits(edits)).toEqual({ text: 8, discrete: DISCRETE_UNITS });
  });
});

describe('measureChange', () => {
  it('counts only the text of a write that joins its Step', () => {
    const edits = [
      ...edit('worldOverview', overview, { ...overview, name: 'Sedge Landings', use3DModel: true }),
    ];
    expect(measureChange({ edits, merged: false })).toBe(1 + DISCRETE_UNITS);
    expect(measureChange({ edits, merged: true })).toBe(1);
  });
});
