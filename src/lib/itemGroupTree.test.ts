import { describe, it, expect } from 'vitest';
import { blankItem } from './items';
import { duplicateItemNode, flattenItemTree } from './itemGroupTree';
import type { Item, ItemGroup } from '@/types';

const item = (id: string, groupId: string | null, order: number, extra: Partial<Item> = {}): Item =>
  ({ ...blankItem(id, id), groupId, order, ...extra });

const GROUPS: ItemGroup[] = [{ id: 'tools', name: 'Tools', parentId: null, order: 1 }];

describe('duplicateItemNode', () => {
  it('copies an item in place: next to its source in the tree and in the list', () => {
    const items = [item('lamp', 'tools', 0), item('rope', 'tools', 1), item('coin', null, 0)];
    const res = duplicateItemNode(GROUPS, items, 'lamp');
    expect(res.items.map((i) => i.name)).toEqual(['lamp', 'lamp (Copy)', 'rope', 'coin']);
    expect(flattenItemTree(res.groups, res.items).map((n) => n.leaf?.name ?? n.group?.name))
      .toEqual(['coin', 'Tools', 'lamp', 'lamp (Copy)', 'rope']);
  });

  it('copies a group with its items, each with fresh effect ids and its own placeholders', () => {
    const lamp = item('lamp', 'tools', 0, {
      name: 'Lamp of {{ph:own-color:world:pl1}}',
      placeholders: [{ id: 'own-color', name: 'Color', values: [{ id: 'v1', text: 'brass' }] }],
      statEffects: [{ id: 'fx', statId: 's', facet: 'value', timing: 'owned', amount: 1, op: 'add' }],
    });
    const res = duplicateItemNode(GROUPS, [lamp], 'tools');
    const groupCopy = res.groups.find((g) => g.id === res.newId)!;
    expect(groupCopy.name).toBe('Tools (Copy)');
    const copy = res.items.find((i) => i.groupId === res.newId)!;
    expect(copy.id).not.toBe('lamp');
    expect(copy.statEffects[0].id).not.toBe('fx');
    expect(copy.placeholders![0].id).not.toBe('own-color');
    expect(copy.name).toContain(copy.placeholders![0].id);
    expect(res.items[0].placeholders![0].id).toBe('own-color');
  });
});
