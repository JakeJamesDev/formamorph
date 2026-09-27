import { describe, it, expect } from 'vitest';
import { bearerChoices } from './bearerChoices';
import { CUSTOM_PERSONA_ID } from './traitTree';
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
const flat = (rows: ReturnType<typeof bearerChoices>) =>
  rows.map((r) => `${r.parentId ?? ''}>${r.kind === 'group' ? '#' : ''}${r.id}`);

describe('bearerChoices', () => {
  it('places entities under their entity groups in Entities tab order, and leaves out groups that hold none', () => {
    expect(flat(bearerChoices(groups, entities)))
      .toEqual(['>#heroes', 'heroes>albus', 'heroes>#guards', 'guards>mira', '>sam', '>#villains', 'villains>vex']);
  });

  it('puts Custom Persona first when it is asked for', () => {
    const rows = bearerChoices(groups, entities, { customPersona: true });
    expect(rows[0]).toEqual({ kind: 'bearer', id: CUSTOM_PERSONA_ID, name: 'Custom Persona', parentId: null, customPersona: true });
    expect(flat(rows).slice(1)).toEqual(flat(bearerChoices(groups, entities)));
  });
});
