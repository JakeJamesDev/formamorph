import { describe, it, expect } from 'vitest';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { copyWithFreshRolls, duplicateAfter } from './duplicateAfter';

const chip = (placementId: string) => encodePlaceholderToken({ id: 'eye', mode: 'unique', placementId });
const placementOf = (text: string) => decodePlaceholderToken(text.match(/\{\{ph:[^}]*\}\}/)![0])!.placementId;

describe('duplicateAfter', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('puts the copy right after its source', () => {
    const { list: out, copy } = duplicateAfter(list, 'b', (s) => ({ id: `${s.id}2` }));
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'b2', 'c']);
    expect(copy).toEqual({ id: 'b2' });
  });

  it('handles the last item', () => {
    expect(duplicateAfter(list, 'c', () => ({ id: 'z' })).list.map((i) => i.id)).toEqual(['a', 'b', 'c', 'z']);
  });

  it('leaves the list alone and returns no copy for a missing id', () => {
    const out = duplicateAfter(list, 'ghost', () => ({ id: 'z' }));
    expect(out.copy).toBeNull();
    expect(out.list).toEqual(list);
  });

  it('does not change the input list', () => {
    duplicateAfter(list, 'a', () => ({ id: 'z' }));
    expect(list).toHaveLength(3);
  });
});

describe('copyWithFreshRolls', () => {
  it('gives a new id, a Copy name and re-minted chip rolls, nested ones included', () => {
    const source = { id: 'loc', name: `Den ${chip('p1')}`, notes: { lines: [chip('p2')] } };
    const copy = copyWithFreshRolls(source);
    expect(copy.id).not.toBe('loc');
    expect(copy.name.endsWith('(Copy)')).toBe(true);
    expect(placementOf(copy.name)).not.toBe('p1');
    expect(placementOf(copy.notes.lines[0])).not.toBe('p2');
    expect(source.name).toBe(`Den ${chip('p1')}`);
  });
});
