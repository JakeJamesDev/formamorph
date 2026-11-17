import { describe, expect, it } from 'vitest';
import { keepEqualMap, shallowEqualRow } from '@/lib/keepEqualMap';

describe('keepEqualMap', () => {
  const colors = new Map([['mira', 'teal'], ['wren', 'amber']]);

  it('returns the previous map for equal content', () => {
    expect(keepEqualMap(colors, new Map([['mira', 'teal'], ['wren', 'amber']]))).toBe(colors);
  });

  it('returns the new map for an added, removed or changed entry', () => {
    const added = new Map([...colors, ['ash', 'rose']]);
    const removed = new Map([['mira', 'teal']]);
    const changed = new Map([['mira', 'teal'], ['wren', 'rose']]);
    const swapped = new Map([['mira', 'teal'], ['ash', 'amber']]);
    for (const next of [added, removed, changed, swapped]) expect(keepEqualMap(colors, next)).toBe(next);
  });

  it('returns the new map with no previous one', () => {
    expect(keepEqualMap(undefined, colors)).toBe(colors);
  });

  it('compares rows shallowly, array fields element by element and image data by reference', () => {
    const image = 'data:image/webp;base64,AAAA';
    const row = { id: 'mira', name: 'Mira', image, seenAliases: ['the courier'] };
    const rows = new Map([['mira', row]]);
    const same = new Map([['mira', { ...row, seenAliases: ['the courier'] }]]);
    expect(keepEqualMap(rows, same, shallowEqualRow)).toBe(rows);
    const renamed = new Map([['mira', { ...row, name: 'Mira Vey' }]]);
    const newAlias = new Map([['mira', { ...row, seenAliases: ['the courier', 'the rider'] }]]);
    const newImage = new Map([['mira', { ...row, image: 'data:image/webp;base64,BBBB' }]]);
    const noImage = new Map([['mira', { id: 'mira', name: 'Mira', seenAliases: ['the courier'] }]]);
    for (const next of [renamed, newAlias, newImage, noImage]) expect(keepEqualMap(rows, next, shallowEqualRow)).toBe(next);
  });

  it('tells shallow row equality apart from a nested object change', () => {
    expect(shallowEqualRow({ tags: [{ a: 1 }] }, { tags: [{ a: 1 }] })).toBe(false);
  });
});
