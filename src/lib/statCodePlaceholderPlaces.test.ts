import { describe, expect, it } from 'vitest';
import type { Placeholder, PlaceholderGroup } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { worldPlaceholderPlaces } from './statCodePlaceholderPlaces';

const ph = (id: string, name: string, extra: Partial<Placeholder> = {}): Placeholder => ({
  id, name, values: [{ id: `${id}-v`, text: 'x' }], ...extra,
});
const groups: PlaceholderGroup[] = [
  { id: 'g1', name: 'Looks', parentId: null },
  { id: 'g2', name: 'Hair', parentId: 'g1' },
];

describe('worldPlaceholderPlaces', () => {
  const list = [
    ph('mood', 'Mood'),
    ph('hair', 'Hair Color', {
      groupId: 'g2', values: [{ id: 'hv', text: encodePlaceholderToken({ id: 'kid', mode: 'world', placementId: 'p1' }) }],
    }),
    ph('eyes', 'Eye Color', { groupId: 'g1' }),
    ph('kid', 'Tint', { ownerId: 'hair' }),
    ph('mine', 'Secret'),
  ];
  const owners = new Map([['mine', { kind: 'entity' as const, id: 'e1', name: 'Ash' }]]);

  it('lists only top-level names, each with its folder path', () => {
    const places = worldPlaceholderPlaces({ list, owners, groups });
    expect(places.map(({ name, path }) => [name, path])).toEqual([
      ['Hair Color', ['Looks', 'Hair']],
      ['Eye Color', ['Looks']],
      ['Mood', []],
    ]);
  });

  it('gives an ungrouped placeholder no path', () => {
    expect(worldPlaceholderPlaces({ list: [ph('a', 'A')] })).toEqual([{ id: 'a', name: 'A', path: [] }]);
  });
});
