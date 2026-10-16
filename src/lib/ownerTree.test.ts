import { describe, it, expect } from 'vitest';
import {
  applyOwnerTreeDrop, buildOwnerTree, linksCarried, ownerLinksInTreeOrder, ownerTreeDropProjection, ownerTreeRows,
  placeableGroupIds, rowsBelow, withEntityLists,
} from './ownerTree';
import { traitDropRules, traitTreeSource, type TraitDropRuleOptions, type TraitTreeOptions } from './traitTree';
import { statDropRules, statTreeSource } from './ownedStatTree';
import type { StatReaderWorld } from './statMoveReaders';
import type { Entity, Stat, StatGroup, StatLink, Trait, TraitGroup, TraitLink } from '@/types';

const group = (id: string, parentId: string | null, order: number): TraitGroup => ({ id, name: id, parentId, order });
const trait = (id: string, groupId: string | null, order: number): Trait => ({ id, name: id, statChanges: [], groupId, order });
const link = (id: string, originalId: string): TraitLink =>
  ({ id, originalId, kind: 'trait', originalName: originalId, groupId: null, order: 0 });

const world = { traits: [trait('paladin', 'class', 0), trait('loner', null, 1)], traitGroups: [group('class', null, 0)] };
const blueprints: TraitGroup = { ...group('bp', null, 2), name: 'Blueprints', system: 'blueprints' };
const withBlueprints = { traits: [...world.traits, trait('tmpl', 'bp', 0)], traitGroups: [...world.traitGroups, blueprints] };
const ash: Entity = { id: 'ash', name: 'Ash', traitGroups: [group('bond', null, 0)], traits: [trait('tamed', 'bond', 0), trait('pack', null, 1)] };
const bob: Entity = { id: 'bob', name: 'Bob', traits: [trait('gruff', null, 0)] };
const you: Entity = { id: 'you', name: 'You', customPersona: true, traits: [trait('me', null, 0)] };

type Lists = typeof world;
const tree = (lists: Lists, entities: Entity[], library: Entity[] = [], options: TraitTreeOptions = { links: true }) =>
  buildOwnerTree(traitTreeSource(lists, entities, library, options));
const outline = (t: ReturnType<typeof tree>) => ownerTreeRows(t, []).map((r) => `${'-'.repeat(r.depth)}${r.id}`);
const drop = (
  lists: Lists, entities: Entity[], activeId: string, overId: string, dragOffset: number,
  { emptySystemNodes = true, ...rules }: TraitDropRuleOptions & { emptySystemNodes?: boolean } = {},
) => applyOwnerTreeDrop(
  traitTreeSource(lists, entities, [], { links: true, emptySystemNodes }), traitDropRules(lists, entities, rules),
  [], activeId, overId, dragOffset, 24,
);

describe('buildOwnerTree', () => {
  it('ends the top level with unplaced nodes in entity order, then library nodes', () => {
    const moss: Entity = { id: 'moss', name: 'Moss', traits: [trait('quiet', null, 0)], traitPlacement: { groupId: 'class', order: 0 } };
    expect(outline(tree(world, [ash, bob], [moss]))).toEqual([
      'class', '-paladin', 'loner', 'ash', '-bond', '--tamed', '-pack', 'bob', '-gruff', 'moss', '-quiet',
    ]);
  });

  it('reads a placement inside Blueprints, or a Custom Persona placement in a group, as none', () => {
    const inBlueprints = { ...ash, traitPlacement: { groupId: 'bp', order: 0 } };
    const youInClass = { ...you, traitPlacement: { groupId: 'class', order: 0 } };
    expect(outline(tree(withBlueprints, [inBlueprints, youInClass]))).toEqual([
      'class', '-paladin', 'loner', 'bp', '-tmpl', 'ash', '-bond', '--tamed', '-pack', 'you', '-me',
    ]);
  });

  it('records each entity row\'s owner and each link row', () => {
    const t = tree(withBlueprints, [{ ...bob, traitLinks: [link('l1', 'tmpl')] }]);
    expect(t.ownerOf.get('gruff')).toBe('bob');
    expect(t.ownerOf.has('paladin')).toBe(false);
    expect(t.linkRows.get('l1')).toMatchObject({ entityId: 'bob', root: true });
  });
});

describe('rowsBelow and linksCarried', () => {
  it('finds a row with everything below it', () => {
    expect(rowsBelow({ groups: ash.traitGroups!, leaves: ash.traits! }, 'bond')).toEqual(new Set(['bond', 'tamed']));
  });

  it('ends at a cycle instead of looping', () => {
    expect(rowsBelow({ groups: [group('a', 'b', 0), group('b', 'a', 0)], leaves: [] }, 'a')).toEqual(new Set(['a', 'b']));
  });

  it('lists the links an entity node carries', () => {
    const t = tree(withBlueprints, [{ ...bob, traitLinks: [link('l1', 'tmpl')] }]);
    expect(linksCarried(t, 'bob').map((r) => r.link.id)).toEqual(['l1']);
    expect(linksCarried(t, 'gruff')).toEqual([]);
  });
});

describe('the shared owner-tree helpers', () => {
  it('places entity nodes only in world groups outside Blueprints, for traits and stats alike', () => {
    const statGroups: StatGroup[] = [
      { id: 'core', name: 'core', parentId: null }, { id: 'sbp', name: 'Blueprints', parentId: null, system: 'blueprints' },
      { id: 'kit', name: 'kit', parentId: 'sbp' },
    ];
    expect([...placeableGroupIds(withBlueprints.traitGroups)]).toEqual(['class']);
    expect([...placeableGroupIds(statGroups)]).toEqual(['core']);
  });

  it('orders links by their place among the entity groups, not by array order', () => {
    const at = (id: string, groupId: string | null, order: number) => ({ ...link(id, id), groupId, order });
    const groups = [group('outer', null, 0), group('inner', 'outer', 1)];
    const links = [at('last', null, 1), at('deep', 'inner', 0), at('top', 'outer', 0)];
    expect(ownerLinksInTreeOrder(groups, links).map((l) => l.id)).toEqual(['top', 'deep', 'last']);
  });

  it('lists each link once even when a group shares its id', () => {
    const shared = { ...link('twin', 'twin'), groupId: null, order: 1 };
    expect(ownerLinksInTreeOrder([group('twin', null, 0)], [shared])).toEqual([shared]);
  });

  it('replaces only the given lists, stores an empty list as absent, and keeps every other field', () => {
    const out = withEntityLists({ ...ash, statLinks: [] }, { traits: [trait('new', null, 0)], traitGroups: [], statLinks: [] });
    expect(out).toEqual({ id: 'ash', name: 'Ash', traits: [trait('new', null, 0)] });
    // Untouched fields keep their place; replaced lists follow in the order given.
    expect(Object.keys(withEntityLists(ash, { traits: [], traitGroups: ash.traitGroups }))).toEqual(['id', 'name', 'traitGroups']);
    expect(Object.keys(withEntityLists(ash, { traitGroups: ash.traitGroups, traits: ash.traits }))).toEqual(['id', 'name', 'traitGroups', 'traits']);
    expect(withEntityLists(bob, {})).toEqual(bob);
  });
});

describe('ownerTreeDropProjection', () => {
  const project = (lists: Lists, entities: Entity[], activeId: string, overId: string, dragOffset: number) => {
    const t = tree(lists, entities);
    return ownerTreeDropProjection(t, ownerTreeRows(t, [activeId]), activeId, overId, dragOffset, 24);
  };

  it('keeps Blueprints at the top level', () => {
    // Unblocked, the pointer would nest it in Class after Paladin.
    expect(project(withBlueprints, [], 'bp', 'loner', 48)).toEqual({ depth: 0, parentId: null });
  });

  it('walks an entity node out of Blueprints and out of another entity', () => {
    expect(project(withBlueprints, [ash], 'ash', 'ash', 24)).toEqual({ depth: 0, parentId: null });
    expect(project(world, [ash, bob], 'bob', 'bob', 24)).toEqual({ depth: 0, parentId: null });
  });

  it('lets an entity node into a world group outside Blueprints', () => {
    expect(project(world, [ash], 'ash', 'loner', 24)).toEqual({ depth: 1, parentId: 'class' });
  });

  it('refuses a drop whose rows below would hold the row inside a group it can\'t enter', () => {
    expect(project(withBlueprints, [], 'bp', 'paladin', 48)).toBeNull();
  });

  it('refuses a link leaving the entities', () => {
    const linked = { ...bob, traitLinks: [link('l1', 'tmpl')] };
    expect(project(withBlueprints, [linked], 'l1', 'loner', 0)).toBeNull();
  });
});

describe('applyOwnerTreeDrop', () => {
  const moved = (out: ReturnType<typeof drop>) => (out?.kind === 'moved' ? out : null);

  it('refuses the Custom Persona node leaving the top level', () => {
    expect(drop(world, [you], 'you', 'paladin', 24)).toEqual({ kind: 'refused', refusal: { reason: 'root', name: 'You' } });
  });

  it('moves an owned trait to another entity under its id, writing both and not the world', () => {
    const out = moved(drop(world, [ash, bob], 'gruff', 'pack', 0));
    expect(out?.world).toBeUndefined();
    expect(out?.entities.find((e) => e.id === 'ash')?.traits?.map((t) => [t.id, t.groupId, t.order]))
      .toEqual([['tamed', 'bond', 0], ['pack', null, 2], ['gruff', null, 1]]);
    expect(out?.entities.find((e) => e.id === 'bob')).toEqual({ id: 'bob', name: 'Bob' });
  });

  it('moves a world trait into an entity with links off, taking it out of the world', () => {
    const out = moved(drop(world, [bob], 'loner', 'gruff', 24, { createLinks: false }));
    expect(out?.world?.leaves.map((t) => t.id)).toEqual(['paladin']);
    expect(out?.entities[0].traits?.map((t) => [t.id, t.groupId, t.order])).toEqual([['loner', null, 1], ['gruff', null, 0]]);
  });

  it('writes an entity\'s link rows back as links, not as its own items', () => {
    const linked = { ...bob, traitLinks: [link('l1', 'tmpl')] };
    const out = moved(drop(withBlueprints, [linked], 'gruff', 'l1', 0));
    expect(out?.entities[0].traits?.map((t) => [t.id, t.order])).toEqual([['gruff', 1]]);
    expect(out?.entities[0].traitLinks?.map((l) => [l.id, l.order])).toEqual([['l1', 0]]);
  });

  it('pins a dragged unplaced node where it lands and leaves the rest unplaced', () => {
    const out = moved(drop(world, [ash, bob], 'ash', 'loner', 0));
    expect(out?.entities.map((e) => [e.id, e.traitPlacement])).toEqual([['ash', { groupId: null, order: 1 }]]);
    expect(out?.world?.leaves.find((t) => t.id === 'loner')?.order).toBe(2);
  });

  it('writes nothing when the row lands where it was', () => {
    expect(drop(world, [ash], 'paladin', 'paladin', 0)).toBeNull();
  });

  it('links a Blueprint dropped into an entity, leaving the original', () => {
    const out = moved(drop(withBlueprints, [bob], 'tmpl', 'gruff', 0, { newLinkId: () => 'new' }));
    expect(out?.world).toBeUndefined();
    expect(out?.entities[0].traitLinks).toEqual([{ ...link('new', 'tmpl'), groupId: null, order: 1 }]);
  });

  it('reports the dragged row\'s id after the drop', () => {
    expect(moved(drop(world, [ash, bob], 'gruff', 'pack', 0))?.rowId).toBe('gruff');
    expect(moved(drop(withBlueprints, [bob], 'tmpl', 'gruff', 0, { newLinkId: () => 'new' }))?.rowId).toBe('new');
  });

  it('keeps a hidden empty Blueprints group after its reindexed siblings', () => {
    const lists = { ...world, traitGroups: [...world.traitGroups, { ...blueprints, order: 0 }] };
    const out = moved(drop(lists, [], 'loner', 'class', 0, { emptySystemNodes: false }));
    expect(out?.world?.groups.map((g) => [g.id, g.order])).toEqual([['class', 1], ['bp', 2]]);
  });
});

describe('the owner-tree engine with the stat adapter', () => {
  const stat = (id: string, groupId: string | null, order: number): Stat => ({
    id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], groupId, order,
  });
  const statBlueprints: StatGroup = { id: 'sbp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' };
  const lists = { stats: [stat('luck', null, 0), stat('trust', 'sbp', 0)], statGroups: [statBlueprints] };
  const statLink: StatLink = { id: 'l1', originalId: 'trust', kind: 'stat', originalName: 'trust', groupId: null, order: 1 };
  const cy: Entity = { id: 'cy', name: 'Cy', stats: [stat('grit', null, 0)], statLinks: [statLink] };
  const dee: Entity = { id: 'dee', name: 'Dee', stats: [stat('nerve', null, 0)] };
  const statDrop = (entities: Entity[], activeId: string, overId: string, dragOffset: number, createLinks = true) => {
    const w: StatReaderWorld = { ...lists, traits: [], traitGroups: [], entities };
    return applyOwnerTreeDrop(
      statTreeSource(w, entities), statDropRules(w, { createLinks, newLinkId: () => 'new' }), [], activeId, overId, dragOffset, 24,
    );
  };
  const moved = (out: ReturnType<typeof statDrop>) => (out?.kind === 'moved' ? out : null);

  it('names an entity\'s rows by entity and records each owner and link row', () => {
    const t = buildOwnerTree(statTreeSource(lists, [cy]));
    expect(ownerTreeRows(t, []).map((r) => r.id)).toEqual(['luck', 'sbp', 'trust', 'cy', 'cy/grit', 'cy/l1']);
    expect(t.ownerOf.get('cy/grit')).toBe('cy');
    expect(t.linkRows.get('cy/l1')).toMatchObject({ entityId: 'cy', root: true, originalId: 'trust' });
  });

  it('writes an entity row that joins the world under its own id, in tree order', () => {
    const out = moved(statDrop([cy], 'cy/grit', 'luck', 0));
    expect(out?.world?.leaves.map((s) => [s.id, s.groupId, s.order])).toEqual([['grit', null, 0], ['luck', null, 1], ['trust', 'sbp', 0]]);
    expect(out?.rowId).toBe('grit');
  });

  it('writes a world row that joins an entity under its own id, and names its new row by entity', () => {
    const out = moved(statDrop([dee], 'luck', 'dee/nerve', 24));
    expect(out?.entities[0].stats?.map((s) => [s.id, s.groupId])).toEqual([['nerve', null], ['luck', null]]);
    expect(out?.rowId).toBe('dee/luck');
  });

  it('names a new link\'s row by entity, and writes nothing with link creation off', () => {
    expect(moved(statDrop([dee], 'trust', 'dee/nerve', 24))?.rowId).toBe('dee/new');
    expect(statDrop([dee], 'trust', 'dee/nerve', 24, false)).toBeNull();
  });
});
