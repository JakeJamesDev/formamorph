import { describe, it, expect } from 'vitest';
import { ownerChoices } from './ownerChoices';
import type { Entity, EntityGroup } from '@/types';

const entity = (id: string, groupId: string | null, order: number, extra: Partial<Entity> = {}): Entity =>
  ({ id, name: id, groupId, order, ...extra });
const group = (id: string, parentId: string | null, order: number): EntityGroup => ({ id, name: id, parentId, order });

// Entities tab: heroes (albus, guards (mira)), empty, sam, villains (vex).
const groups = [group('heroes', null, 0), group('guards', 'heroes', 1), group('empty', null, 1), group('villains', null, 3)];
const entities = [
  entity('vex', 'villains', 0), entity('sam', null, 2), entity('mira', 'guards', 0),
  entity('albus', 'heroes', 0),
];
const flat = (rows: ReturnType<typeof ownerChoices>) =>
  rows.map((r) => `${r.parentId ?? ''}>${r.kind === 'group' ? '#' : ''}${r.id}`);

describe('ownerChoices', () => {
  it('places entities under their entity groups in Entities tab order, and leaves out groups that hold none', () => {
    expect(flat(ownerChoices(groups, entities)))
      .toEqual(['>#heroes', 'heroes>albus', 'heroes>#guards', 'guards>mira', '>sam', '>#villains', 'villains>vex']);
  });

  it("marks the Custom Persona entity's row in its Entities tab place, and no other row", () => {
    const rows = ownerChoices(groups, [...entities, entity('you', null, 4, { customPersona: true })]);
    expect(rows.at(-1)).toEqual({ kind: 'owner', id: 'you', name: 'you', parentId: null, customPersona: true });
    expect(rows.slice(0, -1)).toEqual(ownerChoices(groups, entities));
    expect(rows.slice(0, -1).some((r) => 'customPersona' in r)).toBe(false);
  });
});
