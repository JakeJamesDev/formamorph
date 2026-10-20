import { describe, expect, it } from 'vitest';
import { dropRelationshipsTo } from './entityRelationships';
import type { Entity } from '@/types';

const kate: Entity = { id: 'kate', name: 'Kate' };
const rowan: Entity = { id: 'rowan', name: 'Rowan' };
const tera: Entity = {
  id: 'tera', name: 'Tera',
  relationships: [{ targetId: 'kate', label: 'mother' }, { targetId: 'rowan', label: 'friend' }],
};
const ash: Entity = { id: 'ash', name: 'Ash', relationships: [{ targetId: 'kate', label: 'employer' }] };

describe('dropRelationshipsTo', () => {
  it('drops every relationship that targets the entity and keeps the rest in order', () => {
    const [nextTera, nextAsh, nextRowan] = dropRelationshipsTo('kate', [tera, ash, rowan]);
    expect(nextTera.relationships).toEqual([{ targetId: 'rowan', label: 'friend' }]);
    // A list left empty is stored as no field.
    expect(nextAsh).toEqual({ id: 'ash', name: 'Ash' });
    expect(nextRowan).toBe(rowan);
  });

  it('returns the same array when nobody targets the entity', () => {
    const cast = [kate, tera, rowan];
    expect(dropRelationshipsTo('ash', cast)).toBe(cast);
  });
});
