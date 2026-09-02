import { describe, it, expect } from 'vitest';
import {
  buildEntityTree, isDescendantGroup, flattenEntityTree, removeChildrenOf,
  getEntityDropProjection, applyEntityDrop, duplicateEntityNode, entitiesInTreeOrder,
} from './entityGroupTree';
import type { Entity, EntityGroup } from '@/types';

const group = (id: string, parentId: string | null, order: number): EntityGroup =>
  ({ id, name: id, parentId, order });
const entity = (id: string, groupId: string | null, order: number): Entity =>
  ({ id, name: id, groupId, order });

describe('buildEntityTree', () => {
  it('nests groups and entities and orders siblings by `order`', () => {
    const groups = [group('races', null, 0), group('items', null, 1), group('elves', 'races', 0)];
    const entities = [
      entity('synthia', 'elves', 0),
      entity('sting', 'items', 0),
      entity('loner', null, 2), // ungrouped, sorts after the two root groups
    ];
    const tree = buildEntityTree(groups, entities);
    expect(tree.map((n) => n.id)).toEqual(['races', 'items', 'loner']);
    const races = tree[0];
    expect(races.kind === 'group' && races.children.map((c) => c.id)).toEqual(['elves']);
    const elves = races.kind === 'group' ? races.children[0] : null;
    expect(elves && elves.kind === 'group' && elves.children.map((c) => c.id)).toEqual(['synthia']);
  });

  it('falls back to array order when `order` is absent (legacy entities)', () => {
    const entities: Entity[] = [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }];
    expect(buildEntityTree([], entities).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('renders an entity whose groupId points at a missing group at the top level (never drops it)', () => {
    // Repro: entityGroups lost but the entity still carries a groupId.
    const tree = buildEntityTree([], [entity('orphan', 'ghost', 0)]);
    expect(tree.map((n) => n.id)).toEqual(['orphan']);
    expect(tree[0].kind).toBe('leaf');
  });

  it('surfaces a group whose parentId points at a missing group at the top level', () => {
    const tree = buildEntityTree([group('elves', 'ghost', 0)], [entity('synthia', 'elves', 0)]);
    expect(tree.map((n) => n.id)).toEqual(['elves']);
    const elves = tree[0];
    expect(elves.kind === 'group' && elves.children.map((c) => c.id)).toEqual(['synthia']);
  });
});

describe('isDescendantGroup', () => {
  const groups = [group('races', null, 0), group('elves', 'races', 0), group('items', null, 1)];
  it('detects a group nested under an ancestor (and itself)', () => {
    expect(isDescendantGroup(groups, 'races', 'elves')).toBe(true);
    expect(isDescendantGroup(groups, 'races', 'races')).toBe(true);
  });
  it('returns false for unrelated groups', () => {
    expect(isDescendantGroup(groups, 'items', 'elves')).toBe(false);
  });
});

describe('duplicateEntityNode', () => {
  it('copies an entity in place, right after the original in the same group', () => {
    const groups = [group('races', null, 0)];
    const entities = [entity('a', 'races', 0), entity('b', 'races', 1)];
    const { groups: g2, entities: e2, newId } = duplicateEntityNode(groups, entities, 'a');
    expect(flattenEntityTree(buildEntityTree(g2, e2)).map((n) => n.id)).toEqual(['races', 'a', newId, 'b']);
    const copy = e2.find((e) => e.id === newId)!;
    expect(copy.groupId).toBe('races');
    expect(copy.name).toBe('a (Copy)');
  });

  it('deep-copies a group subtree with fresh ids and remapped parents', () => {
    const groups = [group('races', null, 0), group('elves', 'races', 0)];
    const entities = [entity('synthia', 'elves', 0), entity('loner', null, 1)];
    const { groups: g2, entities: e2, newId } = duplicateEntityNode(groups, entities, 'races');
    const tree = buildEntityTree(g2, e2);
    expect(tree.map((n) => n.id)).toEqual(['races', newId, 'loner']);
    const copyRoot = tree.find((n) => n.id === newId);
    const copySub = copyRoot?.kind === 'group' ? copyRoot.children[0] : null;
    expect(copySub && copySub.id).not.toBe('elves');
    expect(g2.find((g) => g.id === newId)!.name).toBe('races (Copy)');
    const ids = [...g2.map((g) => g.id), ...e2.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate inputs and no-ops on an unknown id', () => {
    const groups = [group('races', null, 0)];
    const entities = [entity('a', 'races', 0)];
    const res = duplicateEntityNode(groups, entities, 'missing');
    expect(res.groups).toBe(groups);
    expect(res.entities).toBe(entities);
  });

  it('re-mints placeholder chip placements in the copy, keeping intra-copy sharing', () => {
    const src: Entity = {
      ...entity('a', 'races', 0),
      name: 'Guard {{ph:name:unique:p1}}',
      aiDescription: 'Known as {{ph:name:unique:p1}}, eyes {{ph:eye:unique:p2}}.',
    };
    const { entities: e2, newId } = duplicateEntityNode([group('races', null, 0)], [src], 'a');
    const copy = e2.find((x) => x.id === newId)!;
    const pids = (t: string) => [...t.matchAll(/:unique:([^:}]+)\}\}/g)].map((m) => m[1]);
    const [nameP] = pids(copy.name);
    const [descNameP, descEyeP] = pids(copy.aiDescription ?? '');
    expect(nameP).not.toBe('p1'); // cut loose from the original's roll
    expect(nameP).toBe(descNameP); // one placement shared inside the source stays one inside the copy
    expect(descEyeP).not.toBe('p2');
    expect(descEyeP).not.toBe(nameP);
    expect(src.name).toContain(':p1}}'); // the original is untouched
  });
});

describe('flattenEntityTree / removeChildrenOf', () => {
  it('tags each node with parent and depth, depth-first; collapse drops descendants', () => {
    const flat = flattenEntityTree(buildEntityTree([group('races', null, 0)], [entity('a', 'races', 0), entity('b', null, 1)]));
    expect(flat.map((n) => [n.id, n.depth, n.parentId])).toEqual([
      ['races', 0, null],
      ['a', 1, 'races'],
      ['b', 0, null],
    ]);
    expect(removeChildrenOf(flat, ['races']).map((n) => n.id)).toEqual(['races', 'b']);
  });
});

describe('getEntityDropProjection / applyEntityDrop', () => {
  it('nests an entity under the group above the drop slot when dragged right', () => {
    const groups = [group('races', null, 0), group('items', null, 1)];
    const entities = [entity('e', null, 2)];
    const flat = flattenEntityTree(buildEntityTree(groups, entities));
    expect(getEntityDropProjection(flat, 'e', 'items', 30, 24)).toEqual({ depth: 1, parentId: 'races' });
    const out = applyEntityDrop(groups, entities, [], 'e', 'items', 30, 24);
    expect(out.entities.find((x) => x.id === 'e')?.groupId).toBe('races');
  });

  it('pulls an entity out to the root when dragged left', () => {
    const out = applyEntityDrop([group('races', null, 0)], [entity('a', 'races', 0)], [], 'a', 'races', -30, 24);
    expect(out.entities.find((x) => x.id === 'a')?.groupId).toBeNull();
  });

  it('refuses to nest a group into its own descendant (no-op)', () => {
    const groups = [group('races', null, 0), group('elves', 'races', 0)];
    const out = applyEntityDrop(groups, [], [], 'races', 'elves', 30, 24);
    expect(out.groups).toBe(groups);
  });
});

describe('entitiesInTreeOrder', () => {
  it('returns entities in tab order (group nesting + `order`), not raw array order', () => {
    const groups = [group('races', null, 0), group('items', null, 1)];
    const entities = [
      entity('loner', null, 2),      // created first, but sorts last
      entity('sting', 'items', 0),
      entity('synthia', 'races', 0),
    ];
    expect(entitiesInTreeOrder(groups, entities).map((e) => e.id)).toEqual(['synthia', 'sting', 'loner']);
  });

  it('keeps every entity when groups are missing', () => {
    const entities = [entity('b', 'gone', 1), entity('a', null, 0)];
    expect(entitiesInTreeOrder([], entities).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('duplicating an entity with placeholders of its own', () => {
  it('gives the copy fresh placeholders and points its chips at them, leaving the original alone', () => {
    const token = (placementId: string) => `{{ph:eyes:world:${placementId}}}`;
    const src: Entity = {
      id: 'molly', name: `Molly ${token('p1')}`, playerDescription: `Eyes of ${token('p2')}.`, order: 0,
      placeholders: [{ id: 'eyes', name: 'Eyes', values: [{ id: 'v1', text: 'amber' }] }],
    };
    const { entities: e2, newId } = duplicateEntityNode([], [src], 'molly');
    const copy = e2.find((e) => e.id === newId)!;
    const fresh = copy.placeholders![0].id;
    expect(fresh).not.toBe('eyes');
    expect(copy.name).toContain(`{{ph:${fresh}:world:`);
    expect(copy.playerDescription).toContain(`{{ph:${fresh}:world:`);
    expect(copy.name).not.toContain('{{ph:eyes:');
    const original = e2.find((e) => e.id === 'molly')!;
    expect(original.placeholders![0].id).toBe('eyes');
    expect(original.name).toContain('{{ph:eyes:');
  });
});
