import { describe, it, expect } from 'vitest';
import {
  buildTraitTree, isDescendantGroup, buildTraitContext,
  flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  duplicateTraitNode, ownedTraitTree, applyOwnedTraitDrop, getOwnedTraitDropProjection, linkRowId,
  linkRefusal, entityRootTraitTree, getEntityRootDropProjection, applyEntityRootDrop,
} from './traitTree';
import type { Entity, Trait, TraitGroup, TraitLink } from '@/types';

const group = (id: string, parentId: string | null, order: number): TraitGroup =>
  ({ id, name: id, parentId, order });
const trait = (id: string, groupId: string | null, order: number): Trait =>
  ({ id, name: id, statChanges: [], groupId, order });

describe('buildTraitTree', () => {
  it('nests groups and traits and orders siblings by `order`', () => {
    const groups = [group('world', null, 0), group('player', null, 1), group('clans', 'world', 0)];
    const traits = [
      trait('quick', 'player', 0),
      trait('storm', 'clans', 0),
      trait('loner', null, 2), // ungrouped, sorts after the two root groups
    ];
    const tree = buildTraitTree(groups, traits);
    expect(tree.map((n) => n.id)).toEqual(['world', 'player', 'loner']);
    const world = tree[0];
    expect(world.kind === 'group' && world.children.map((c) => c.id)).toEqual(['clans']);
    const clans = world.kind === 'group' ? world.children[0] : null;
    expect(clans && clans.kind === 'group' && clans.children.map((c) => c.id)).toEqual(['storm']);
  });

  it('falls back to array order when `order` is absent (legacy traits)', () => {
    const traits: Trait[] = [
      { id: 'a', name: 'a', statChanges: [] },
      { id: 'b', name: 'b', statChanges: [] },
    ];
    expect(buildTraitTree([], traits).map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('renders a trait whose groupId points at a missing group at the top level (never drops it)', () => {
    const tree = buildTraitTree([], [trait('orphan', 'ghost', 0)]);
    expect(tree.map((n) => n.id)).toEqual(['orphan']);
    expect(tree[0].kind).toBe('leaf');
  });
});

describe('isDescendantGroup', () => {
  const groups = [group('world', null, 0), group('clans', 'world', 0), group('player', null, 1)];
  it('detects a group nested under an ancestor (and itself)', () => {
    expect(isDescendantGroup(groups, 'world', 'clans')).toBe(true);
    expect(isDescendantGroup(groups, 'world', 'world')).toBe(true);
  });
  it('returns false for unrelated groups', () => {
    expect(isDescendantGroup(groups, 'player', 'clans')).toBe(false);
  });
});

describe('duplicateTraitNode', () => {
  it('copies a trait in place, right after the original in the same group', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0), trait('b', 'world', 1)];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode(groups, traits, 'a');
    const order = flattenTraitTree(buildTraitTree(g2, t2)).map((n) => n.id);
    expect(order).toEqual(['world', 'a', newId, 'b']);
    const copy = t2.find((t) => t.id === newId)!;
    expect(copy.groupId).toBe('world');
    expect(copy.name).toBe('a (Copy)');
  });

  it('places the copy after the original even when items have no explicit order (legacy)', () => {
    const traits: Trait[] = [
      { id: 'a', name: 'a', statChanges: [] },
      { id: 'b', name: 'b', statChanges: [] },
    ];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode([], traits, 'a');
    expect(flattenTraitTree(buildTraitTree(g2, t2)).map((n) => n.id)).toEqual(['a', newId, 'b']);
  });

  it('deep-copies a group subtree with fresh ids and remapped parents', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0)];
    const traits = [trait('storm', 'clans', 0), trait('loner', null, 1)];
    const { groups: g2, traits: t2, newId } = duplicateTraitNode(groups, traits, 'world');

    // Original tree intact + a sibling copy of `world` after it at root.
    const tree = buildTraitTree(g2, t2);
    expect(tree.map((n) => n.id)).toEqual(['world', newId, 'loner']);

    // The copied subgroup + trait are brand-new ids nested under the copied root, not the originals.
    const copyRoot = tree.find((n) => n.id === newId);
    const copySub = copyRoot?.kind === 'group' ? copyRoot.children[0] : null;
    expect(copySub && copySub.id).not.toBe('clans');
    expect(copySub?.kind === 'group' && copySub.children[0].id).not.toBe('storm');
    expect(g2.find((g) => g.id === newId)!.name).toBe('world (Copy)');
    // No id collisions: every group/trait id is unique.
    const ids = [...g2.map((g) => g.id), ...t2.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate the input arrays and no-ops on an unknown id', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0)];
    const res = duplicateTraitNode(groups, traits, 'missing');
    expect(res.groups).toBe(groups);
    expect(res.traits).toBe(traits);
    duplicateTraitNode(groups, traits, 'a');
    expect(traits).toHaveLength(1); // original untouched
    expect(groups).toHaveLength(1);
  });
});

describe('flattenTraitTree', () => {
  it('tags each node with parent and depth, depth-first', () => {
    const groups = [group('world', null, 0)];
    const traits = [trait('a', 'world', 0), trait('b', null, 1)];
    const flat = flattenTraitTree(buildTraitTree(groups, traits));
    expect(flat.map((n) => [n.id, n.depth, n.parentId])).toEqual([
      ['world', 0, null],
      ['a', 1, 'world'],
      ['b', 0, null],
    ]);
  });
});

describe('removeChildrenOf', () => {
  it('drops the descendants of a collapsed group', () => {
    const flat = flattenTraitTree(buildTraitTree([group('world', null, 0)], [trait('a', 'world', 0)]));
    expect(removeChildrenOf(flat, ['world']).map((n) => n.id)).toEqual(['world']);
  });
});

describe('getTraitDropProjection', () => {
  it('nests under the group directly above the drop slot when dragged right', () => {
    const groups = [group('world', null, 0), group('player', null, 1)];
    const traits = [trait('t', null, 2)];
    const flat = flattenTraitTree(buildTraitTree(groups, traits));
    const proj = getTraitDropProjection(flat, 't', 'player', 30, 24); // +1 depth
    expect(proj).toEqual({ depth: 1, parentId: 'world' });
  });

  it('pulls back to the root (parent null) when dragged left', () => {
    const flat = flattenTraitTree(buildTraitTree([group('world', null, 0)], [trait('a', 'world', 0)]));
    const proj = getTraitDropProjection(flat, 'a', 'world', -30, 24);
    expect(proj).toEqual({ depth: 0, parentId: null });
  });
});

describe('applyTraitDrop', () => {
  it('re-parents and reindexes from a rightward drag', () => {
    const groups = [group('world', null, 0), group('player', null, 1)];
    const traits = [trait('t', null, 2)];
    const out = applyTraitDrop(groups, traits, [], 't', 'player', 30, 24);
    expect(out.traits.find((x) => x.id === 't')?.groupId).toBe('world');
    expect(out.traits.find((x) => x.id === 't')?.order).toBe(0);
    expect(out.groups.find((g) => g.id === 'player')?.order).toBe(1);
  });

  it('pulls a trait out of its group to the root', () => {
    const out = applyTraitDrop([group('world', null, 0)], [trait('a', 'world', 0)], [], 'a', 'world', -30, 24);
    expect(out.traits.find((x) => x.id === 'a')?.groupId).toBeNull();
  });

  it('refuses to nest a group into its own descendant', () => {
    const groups = [group('world', null, 0), group('clans', 'world', 0)];
    const out = applyTraitDrop(groups, [], [], 'world', 'clans', 30, 24);
    expect(out.groups).toBe(groups); // unchanged reference = no-op
  });
});

describe('buildTraitContext', () => {
  const groups = [
    { ...group('world', null, 0), name: 'World' },
    { ...group('player', null, 1), name: 'Player' },
  ];
  const traits: Trait[] = [
    { id: 'storm', name: 'Stormtouched', statChanges: [], groupId: 'world', aiDescription: 'lightning resistance', order: 0 },
    { id: 'quick', name: 'Quick', statChanges: [], groupId: 'player', aiDescription: '+2 reflexes', order: 0 },
    { id: 'loner', name: 'Loner', statChanges: [], groupId: null, order: 0 },
  ];

  it('simple: plain labels + indentation, ungrouped first (no bullets or bold)', () => {
    const withDesc = [{ ...groups[0], aiDescription: 'Born of the storm clans.' }, groups[1]];
    const out = buildTraitContext(['storm', 'quick', 'loner'], traits, withDesc);
    expect(out).toBe(
      'Loner\n' +
      'World:\n' +
      '  Born of the storm clans.\n' +
      '  Stormtouched: lightning resistance\n' +
      'Player:\n' +
      '  Quick: +2 reflexes',
    );
  });

  it('markdown: nested bold bullets, group description inlined after the group name', () => {
    const withDesc = [{ ...groups[0], aiDescription: 'Born of the storm clans.' }, groups[1]];
    const out = buildTraitContext(['storm', 'quick', 'loner'], traits, withDesc, 'markdown');
    expect(out).toBe(
      '- **Loner**\n' +
      '- **World:** Born of the storm clans.\n' +
      '  - **Stormtouched:** lightning resistance\n' +
      '- **Player:**\n' +
      '  - **Quick:** +2 reflexes',
    );
  });

  it('xml: ungrouped <trait> first, then a <group> nesting name/description and its traits', () => {
    const withDesc = [{ ...groups[0], aiDescription: 'Born of the storm clans.' }, groups[1]];
    const out = buildTraitContext(['storm', 'quick', 'loner'], traits, withDesc, 'xml');
    expect(out).toBe(
      '<trait>\n  <name>Loner</name>\n</trait>\n' +
      '<group>\n' +
      '  <name>World</name>\n' +
      '  <description>Born of the storm clans.</description>\n' +
      '  <trait>\n    <name>Stormtouched</name>\n    <description>lightning resistance</description>\n  </trait>\n' +
      '</group>\n' +
      '<group>\n' +
      '  <name>Player</name>\n' +
      '  <trait>\n    <name>Quick</name>\n    <description>+2 reflexes</description>\n  </trait>\n' +
      '</group>',
    );
  });

  it('omits a blank group AI description and groups with no selected trait', () => {
    const out = buildTraitContext(['quick'], traits, groups);
    expect(out).toBe('Player:\n  Quick: +2 reflexes');
  });

  it('returns an empty string when nothing is selected', () => {
    expect(buildTraitContext([], traits, groups)).toBe('');
  });
});

describe('ownedTraitTree', () => {
  const worldTraits = { traits: [trait('paladin', 'class', 0), trait('loner', null, 1)], traitGroups: [group('class', null, 0)] };
  const ash: Entity = {
    id: 'ash', name: 'Ash',
    traitGroups: [group('bond', null, 1)],
    traits: [trait('tamed', 'bond', 0), trait('pack', null, 0)],
  };
  const entities: Entity[] = [{ id: 'npc', name: 'Npc' }, ash, { id: 'shell', name: 'Shell', traitGroups: [group('empty', null, 0)] }];
  const rows = (ents: Entity[] = entities) =>
    flattenTraitTree(buildTraitTree(...(({ groups, traits }) => [groups, traits] as const)(ownedTraitTree(worldTraits, ents))))
      .map((n) => `${'-'.repeat(n.depth)}${n.id}`);

  it('puts a node for each entity that owns a trait or a group after the world items, holding its own tree', () => {
    expect(rows()).toEqual(['class', '-paladin', 'loner', 'ash', '-pack', '-bond', '--tamed', 'shell', '-empty']);
    expect(ownedTraitTree(worldTraits, entities).entityNodes.get('ash')?.name).toBe('Ash');
  });

  it('shows no node for an entity that owns nothing, and a node for one holding only a group', () => {
    expect(rows([{ id: 'npc', name: 'Npc' }])).toEqual(['class', '-paladin', 'loner']);
    expect(rows([entities[2]])).toEqual(['class', '-paladin', 'loner', 'shell', '-empty']);
  });

  it('keeps the node while a group is left, and drops it when the last trait and group go', () => {
    expect(rows([{ ...ash, traits: undefined }])).toEqual(['class', '-paladin', 'loner', 'ash', '-bond']);
    expect(rows([{ ...ash, traits: undefined, traitGroups: undefined }])).toEqual(['class', '-paladin', 'loner']);
  });

  it('reads an owned item whose group is gone as sitting at its entity root', () => {
    const stray = { ...ash, traits: [trait('stray', 'ghost', 0)] };
    expect(rows([stray])).toEqual(['class', '-paladin', 'loner', 'ash', '-stray', '-bond']);
  });

  it('reports which entity owns each item', () => {
    const tree = ownedTraitTree(worldTraits, entities);
    expect(tree.ownerOf.get('tamed')).toBe('ash');
    expect(tree.ownerOf.get('bond')).toBe('ash');
    expect(tree.ownerOf.has('paladin')).toBe(false);
  });

  it('places an entity node in the world group its placement names, at its order', () => {
    const placed = { ...ash, traitPlacement: { groupId: 'class', order: 0 } };
    expect(rows([placed])).toEqual(['class', '-ash', '--pack', '--bond', '---tamed', '-paladin', 'loner']);
  });

  it('places an entity node among the top-level world items by its order', () => {
    const placed = { ...ash, traitPlacement: { groupId: null, order: 1 } };
    expect(rows([placed, entities[2]])).toEqual(['class', '-paladin', 'ash', '-pack', '-bond', '--tamed', 'loner', 'shell', '-empty']);
  });

  it('reads a placement whose group is gone, or is not a world group, as the end of the top level', () => {
    const gone = { ...ash, traitPlacement: { groupId: 'deleted', order: 0 } };
    expect(rows([gone])).toEqual(['class', '-paladin', 'loner', 'ash', '-pack', '-bond', '--tamed']);
    const inOwned = { ...entities[2], traitPlacement: { groupId: 'bond', order: 0 } };
    expect(rows([ash, inOwned])).toEqual(['class', '-paladin', 'loner', 'ash', '-pack', '-bond', '--tamed', 'shell', '-empty']);
  });

  it('puts library nodes after everything at the top level, in the order added, whatever their placement', () => {
    const placed = { ...ash, traitPlacement: { groupId: null, order: 5 } };
    const wren: Entity = { id: 'wren', name: 'Wren', traits: [trait('brave', null, 0)], traitPlacement: { groupId: 'class', order: 0 } };
    const moss: Entity = { id: 'moss', name: 'Moss', traits: [trait('quiet', null, 0)] };
    const tree = ownedTraitTree(worldTraits, [placed], [moss, wren, { id: 'bare', name: 'Bare' }]);
    expect(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)).map((n) => `${'-'.repeat(n.depth)}${n.id}`))
      .toEqual(['class', '-paladin', 'loner', 'ash', '-pack', '-bond', '--tamed', 'moss', '-quiet', 'wren', '-brave']);
    expect(tree.ownerOf.get('brave')).toBe('wren');
  });
});

describe('ownedTraitTree with links', () => {
  const world = {
    traits: [{ ...trait('paladin', 'classes', 0), name: 'Paladin' }, trait('wizard', 'classes', 1), trait('brave', null, 1)],
    traitGroups: [{ ...group('classes', null, 0), name: 'Classes' }, group('schools', 'classes', 2)],
  };
  const link = (id: string, originalId: string, kind: 'trait' | 'group', groupId: string | null, order: number): TraitLink =>
    ({ id, originalId, kind, originalName: originalId, groupId, order });
  const rows = (ents: Entity[]) => {
    const tree = ownedTraitTree(world, ents, [], { links: true });
    return flattenTraitTree(buildTraitTree(tree.groups, tree.traits)).map((n) => `${'-'.repeat(n.depth)}${n.id}`);
  };

  it('draws a trait link under its entity by the link id, reading the original live', () => {
    const ash: Entity = { id: 'ash', name: 'Ash', traits: [trait('pack', null, 0)], traitLinks: [link('l1', 'paladin', 'trait', null, 1)] };
    expect(rows([ash])).toEqual(['classes', '-paladin', '-wizard', '-schools', 'brave', 'ash', '-pack', '-l1']);
    const tree = ownedTraitTree(world, [ash], [], { links: true });
    expect(tree.traits.find((t) => t.id === 'l1')?.name).toBe('Paladin');
    expect(tree.linkRows.get('l1')).toMatchObject({ entityId: 'ash', originalId: 'paladin', root: true });
    expect(tree.ownerOf.get('l1')).toBe('ash');
  });

  it('gives an entity with links only a node, and sits a link inside an owned group', () => {
    const bob: Entity = { id: 'bob', name: 'Bob', traitGroups: [group('bond', null, 0)], traitLinks: [link('l1', 'brave', 'trait', 'bond', 0)] };
    expect(rows([bob])).toEqual(['classes', '-paladin', '-wizard', '-schools', 'brave', 'bob', '-bond', '--l1']);
    expect(rows([{ id: 'cy', name: 'Cy', traitLinks: [link('l2', 'brave', 'trait', null, 0)] }]))
      .toEqual(['classes', '-paladin', '-wizard', '-schools', 'brave', 'cy', '-l2']);
  });

  it('draws a group link with the original\'s live subtree under row ids of its own', () => {
    const ash: Entity = { id: 'ash', name: 'Ash', traitLinks: [link('l1', 'classes', 'group', null, 0)] };
    expect(rows([ash])).toEqual([
      'classes', '-paladin', '-wizard', '-schools', 'brave',
      'ash', '-l1', `--${linkRowId('l1', 'paladin')}`, `--${linkRowId('l1', 'wizard')}`, `--${linkRowId('l1', 'schools')}`,
    ]);
    const tree = ownedTraitTree(world, [ash], [], { links: true });
    expect(tree.linkRows.get(linkRowId('l1', 'wizard'))).toMatchObject({ entityId: 'ash', originalId: 'wizard', root: false });
    expect(tree.groups.find((g) => g.id === 'l1')?.name).toBe('Classes');
  });

  it('leaves links out of the tree play reads, and gives an entity with links only no node there', () => {
    const ash: Entity = { id: 'ash', name: 'Ash', traits: [trait('pack', null, 0)], traitLinks: [link('l1', 'paladin', 'trait', null, 1)] };
    const cy: Entity = { id: 'cy', name: 'Cy', traitLinks: [link('l2', 'brave', 'trait', null, 0)] };
    const tree = ownedTraitTree(world, [ash, cy]);
    expect(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)).map((n) => n.id))
      .toEqual(['classes', 'paladin', 'wizard', 'schools', 'brave', 'ash', 'pack']);
    expect(tree.linkRows.size).toBe(0);
  });

  it('draws nothing for a link whose original is gone', () => {
    expect(rows([{ id: 'ash', name: 'Ash', traits: [trait('pack', null, 0)], traitLinks: [link('l1', 'gone', 'trait', null, 1)] }]))
      .toEqual(['classes', '-paladin', '-wizard', '-schools', 'brave', 'ash', '-pack']);
  });
});

describe('applyOwnedTraitDrop', () => {
  const worldTraits = { traits: [trait('paladin', 'class', 0), trait('loner', null, 1)], traitGroups: [group('class', null, 0)] };
  const ash: Entity = {
    id: 'ash', name: 'Ash',
    traitGroups: [group('bond', null, 0)],
    traits: [trait('tamed', 'bond', 0), trait('pack', null, 1)],
  };
  const bob: Entity = { id: 'bob', name: 'Bob', traits: [trait('gruff', null, 0)] };
  const moved = (out: ReturnType<typeof applyOwnedTraitDrop>) => (out?.kind === 'moved' ? out : null);
  const entityOut = (out: ReturnType<typeof applyOwnedTraitDrop>, id: string) => moved(out)?.entities.find((e) => e.id === id);
  const rowsAfter = (out: ReturnType<typeof applyOwnedTraitDrop>, ents: Entity[]) => {
    const m = moved(out)!;
    const world = m.world ? { traits: m.world.traits, traitGroups: m.world.groups } : worldTraits;
    const next = ents.map((e) => m.entities.find((x) => x.id === e.id) ?? e);
    const { groups, traits } = ownedTraitTree(world, next, [], { links: true });
    return flattenTraitTree(buildTraitTree(groups, traits)).map((n) => `${'-'.repeat(n.depth)}${n.id}`);
  };

  it('reorders items inside one entity and writes back that entity alone', () => {
    // Rows: class, paladin, loner, ash, bond, tamed, pack. Pack moves above Bond, at Ash's root.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'pack', 'bond', 0, 24);
    expect(moved(out)?.world).toBeUndefined();
    const entity = entityOut(out, 'ash');
    expect(entity?.traits?.find((t) => t.id === 'pack')).toMatchObject({ groupId: null, order: 0 });
    expect(entity?.traitGroups?.find((g) => g.id === 'bond')).toMatchObject({ parentId: null, order: 1 });
    expect(entity?.traitPlacement).toBeUndefined();
  });

  it('still moves world items among themselves, touching no entity', () => {
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'loner', 'paladin', 0, 24);
    expect(moved(out)?.entities).toEqual([]);
    const traits = moved(out)?.world?.traits ?? [];
    expect(traits.map((t) => t.id).sort()).toEqual(['loner', 'paladin']);
    expect(traits.find((t) => t.id === 'loner')?.groupId).toBe('class');
  });

  it('moves a root trait dropped into an entity in as its own, with links on (Q2)', () => {
    // Paladin dropped below Pack lands at Ash's root.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'paladin', 'pack', 0, 24, { newLinkId: () => 'l1' });
    expect(moved(out)?.world?.traits.map((t) => t.id)).toEqual(['loner']);
    expect(entityOut(out, 'ash')).not.toHaveProperty('traitLinks');
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'paladin')).toMatchObject({ groupId: null, order: 2 });
    expect(rowsAfter(out, [ash])).toEqual(['class', 'loner', 'ash', '-bond', '--tamed', '-pack', '-paladin']);
  });

  it('moves an owned trait out to the world under the same id', () => {
    // Tamed dropped at the top level lands in the world.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'tamed', 'class', -48, 24);
    expect(moved(out)?.world?.traits.find((t) => t.id === 'tamed')).toMatchObject({ groupId: null });
    expect(entityOut(out, 'ash')?.traits?.map((t) => t.id)).toEqual(['pack']);
  });

  it('moves a trait from one entity to another', () => {
    // Rows: class, paladin, loner, ash, bond, tamed, pack, bob, gruff. Pack dropped below Gruff joins Bob.
    const out = applyOwnedTraitDrop(worldTraits, [ash, bob], [], 'pack', 'gruff', 0, 24);
    expect(moved(out)?.world).toBeUndefined();
    expect(entityOut(out, 'ash')?.traits?.map((t) => t.id)).toEqual(['tamed']);
    expect(entityOut(out, 'bob')?.traits?.map((t) => t.id).sort()).toEqual(['gruff', 'pack']);
  });

  it('moves a group across owners with its whole subtree, every id kept', () => {
    // Bond dropped at the top level above Class moves to the world with Tamed inside it.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'bond', 'class', -24, 24);
    expect(moved(out)?.world?.groups.find((g) => g.id === 'bond')).toMatchObject({ parentId: null });
    expect(moved(out)?.world?.traits.find((t) => t.id === 'tamed')).toMatchObject({ groupId: 'bond' });
    expect(entityOut(out, 'ash')).toMatchObject({ traits: [{ id: 'pack' }] });
    expect(entityOut(out, 'ash')?.traitGroups).toBeUndefined();
  });

  it('refuses a root trait with stat changes or stat toggles moving into a cast entity', () => {
    const strong = { ...trait('paladin', 'class', 0), name: 'Plate Armor', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] };
    expect(applyOwnedTraitDrop({ ...worldTraits, traits: [strong, worldTraits.traits[1]] }, [ash], [], 'paladin', 'pack', 0, 24))
      .toEqual({ kind: 'refused', refusal: { reason: 'stats', name: 'Plate Armor', kind: 'trait', offender: 'Plate Armor', owner: null } });
    const toggled = { ...trait('paladin', 'class', 0), statToggles: [{ statId: 's', enabled: true }] };
    expect(applyOwnedTraitDrop({ ...worldTraits, traits: [toggled, worldTraits.traits[1]] }, [ash], [], 'paladin', 'pack', 0, 24)?.kind)
      .toBe('refused');
  });

  it('refuses a root group with stat effects inside it moving into a cast entity', () => {
    const strong = { ...trait('paladin', 'class', 0), name: 'Plate Armor', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] };
    const world = { traits: [strong, trait('loner', null, 1)], traitGroups: [{ ...group('class', null, 0), name: 'Class' }] };
    // Class dropped below Pack, one level in, lands at Ash's root.
    expect(applyOwnedTraitDrop(world, [ash], [], 'class', 'pack', 24, 24))
      .toEqual({ kind: 'refused', refusal: { reason: 'stats', name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null } });
  });

  it('drags an entity node into a world group, storing its placement', () => {
    // Visible rows while Ash drags: class, paladin, loner, ash. Ash dropped on Paladin nests under Class.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'ash', 'paladin', 0, 24);
    expect(entityOut(out, 'ash')?.traitPlacement).toEqual({ groupId: 'class', order: 0 });
    expect(entityOut(out, 'ash')?.traits).toEqual(ash.traits);
    expect(rowsAfter(out, [ash])).toEqual(['class', '-ash', '--bond', '---tamed', '--pack', '-paladin', 'loner']);
  });

  it('pins an unplaced entity node where a world drop leaves it', () => {
    // Loner dropped below Pack at depth 0 lands at the top level after Ash.
    const out = applyOwnedTraitDrop(worldTraits, [ash], [], 'loner', 'pack', 0, 24);
    expect(entityOut(out, 'ash')?.traitPlacement).toEqual({ groupId: null, order: 1 });
    expect(rowsAfter(out, [ash])).toEqual(['class', '-paladin', 'ash', '-bond', '--tamed', '-pack', 'loner']);
  });

  it('never nests an entity node in another entity node or an owned group', () => {
    // Bob dropped on Bond at depth 1 would sit under Ash.
    expect(applyOwnedTraitDrop(worldTraits, [ash, bob], [], 'bob', 'bond', 24, 24)).toBeNull();
    // Bob kept last but pushed in would sit under Ash; it stays at the top level.
    expect(applyOwnedTraitDrop(worldTraits, [ash, bob], [], 'bob', 'bob', 48, 24)).toBeNull();
  });

  it('keeps a world group holding an entity node among the world items', () => {
    const companions = { ...worldTraits, traitGroups: [...worldTraits.traitGroups, group('companions', null, 2)] };
    const placed = { ...ash, traitPlacement: { groupId: 'companions', order: 0 } };
    // Rows: class, paladin, loner, companions, ash (collapsed), bob, gruff. Companions dropped under Gruff,
    // one level in, would sit in Bob; it lands at the top level after Bob.
    const out = applyOwnedTraitDrop(companions, [placed, bob], ['ash'], 'companions', 'gruff', 24, 24);
    expect(moved(out)?.world?.groups.find((g) => g.id === 'companions')).toMatchObject({ parentId: null });
    expect(entityOut(out, 'ash')).toBeUndefined();
    expect(entityOut(out, 'bob')?.traits).toEqual(bob.traits);
  });

  it('moves a root trait into a collapsed entity node as its first item', () => {
    // Rows: class, paladin, loner, ash (collapsed). Loner dropped on Ash, one level in.
    const out = applyOwnedTraitDrop(worldTraits, [ash], ['ash'], 'loner', 'ash', 24, 24, { newLinkId: () => 'l1' });
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'loner')).toMatchObject({ groupId: null, order: 0 });
    expect(rowsAfter(out, [ash])).toEqual(['class', '-paladin', 'ash', '-loner', '-bond', '--tamed', '-pack']);
  });

  it('names the entity a refused trait stays with', () => {
    const stray = { ...bob, traits: [{ ...trait('gruff', null, 0), name: 'Gruff', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] }] };
    // Rows: class, paladin, loner, ash, bond, tamed, pack, bob, gruff. Gruff dropped on Pack joins Ash.
    expect(applyOwnedTraitDrop(worldTraits, [ash, stray], [], 'gruff', 'pack', 0, 24))
      .toEqual({ kind: 'refused', refusal: { reason: 'stats', name: 'Gruff', kind: 'trait', offender: 'Gruff', owner: 'Bob' } });
  });
});

describe('applyOwnedTraitDrop with links', () => {
  // Rows: blueprints, classes (in blueprints), paladin, wizard, loner, ash, pack, bond, tamed.
  const world = {
    traits: [trait('paladin', 'classes', 0), trait('wizard', 'classes', 1), { ...trait('loner', null, 1), name: 'Loner' }],
    traitGroups: [{ ...group('blueprints', null, 0), system: 'blueprints' as const }, { ...group('classes', 'blueprints', 0), name: 'Classes' }],
  };
  const ash: Entity = {
    id: 'ash', name: 'Ash',
    traits: [trait('pack', null, 0), trait('tamed', 'bond', 0)],
    traitGroups: [group('bond', null, 1)],
  };
  const drop = (ents: Entity[], activeId: string, overId: string, offset: number, collapsed: string[] = [], createLinks = true) =>
    applyOwnedTraitDrop(world, ents, collapsed, activeId, overId, offset, 24, { createLinks, newLinkId: () => 'new' });
  const entityOut = (out: ReturnType<typeof applyOwnedTraitDrop>, id: string) =>
    (out?.kind === 'moved' ? out.entities.find((e) => e.id === id) : undefined);

  it('links a Blueprints trait dropped into an entity, in the place it was dropped, and leaves the world alone', () => {
    // Wizard dropped below Pack at Ash's root.
    const out = drop([ash], 'wizard', 'pack', 0);
    expect(out?.kind === 'moved' && out.world).toBeFalsy();
    const next = entityOut(out, 'ash')!;
    expect(next.traitLinks).toEqual([{ id: 'new', originalId: 'wizard', kind: 'trait', originalName: 'wizard', groupId: null, order: 1 }]);
    expect(next.traits?.find((t) => t.id === 'pack')).toMatchObject({ order: 0 });
    expect(next.traitGroups?.find((g) => g.id === 'bond')).toMatchObject({ order: 2 });
    expect(next.traits?.some((t) => t.id === 'wizard')).toBe(false);
  });

  it('moves a root trait in with links on, since only Blueprints items link (Q1)', () => {
    const out = drop([ash], 'loner', 'pack', 0);
    expect(out?.kind === 'moved' && out.world?.traits.map((t) => t.id)).toEqual(['paladin', 'wizard']);
    expect(entityOut(out, 'ash')).not.toHaveProperty('traitLinks');
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'loner')).toMatchObject({ groupId: null, order: 1 });
  });

  it('refuses a linked Blueprint leaving Blueprints, naming every entity that links it or something in it (Q7)', () => {
    const albus: Entity = { id: 'albus', name: 'Albus', traitLinks: [{ id: 'l1', originalId: 'wizard', kind: 'trait', originalName: 'wizard', groupId: null, order: 0 }] };
    const bo: Entity = { id: 'bo', name: 'Bo', traitLinks: [{ id: 'l2', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null, order: 0 }] };
    // Rows: blueprints, classes, paladin, wizard, loner, ash, …. Wizard dropped on Loner at the top level.
    expect(drop([ash, albus], 'wizard', 'loner', -48)).toEqual({ kind: 'refused', refusal: { reason: 'blueprint-linked', name: 'wizard', bearers: ['Albus'] } });
    // Classes, holding the Wizard that Albus links, leaves Blueprints with it.
    expect(drop([ash, albus, bo], 'classes', 'loner', -24, ['classes']))
      .toEqual({ kind: 'refused', refusal: { reason: 'blueprint-linked', name: 'Classes', bearers: ['Albus', 'Bo'] } });
    // Moving within Blueprints is fine, and so is an unlinked Blueprint leaving it.
    expect(drop([ash, albus], 'wizard', 'paladin', 0)?.kind).toBe('moved');
    expect(drop([ash, albus], 'paladin', 'loner', -48)?.kind).toBe('moved');
  });

  it('links a group from under Blueprints, stat effects and all', () => {
    const strong = { ...world, traits: world.traits.map((t) => (t.id === 'paladin' ? { ...t, statChanges: [{ statId: 's', value: 1, type: 'min' as const }] } : t)) };
    // Classes dropped inside Bond, below Tamed.
    const out = applyOwnedTraitDrop(strong, [ash], [], 'classes', 'tamed', 24, 24, { newLinkId: () => 'new' });
    expect(entityOut(out, 'ash')?.traitLinks).toEqual([
      { id: 'new', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: 'bond', order: 1 },
    ]);
  });

  it('refuses a link to an original the entity already holds, directly or through a linked group', () => {
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'classes', kind: 'group' as const, originalName: 'Classes', groupId: null, order: 3 }] };
    expect(drop([linked], 'paladin', 'pack', 0)).toEqual({ kind: 'refused', refusal: { reason: 'duplicate', name: 'paladin', bearer: 'Ash' } });
    const paladin = { ...ash, traitLinks: [{ id: 'l1', originalId: 'paladin', kind: 'trait' as const, originalName: 'paladin', groupId: null, order: 3 }] };
    expect(drop([paladin], 'classes', 'pack', 0)?.kind).toBe('refused');
  });

  it('reorders a link inside its entity, into an owned group', () => {
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'loner', kind: 'trait' as const, originalName: 'Loner', groupId: null, order: 2 }] };
    // Rows: …, ash, pack, bond, tamed, l1. The link dropped on Tamed, one level in, lands in Bond.
    const out = drop([linked], 'l1', 'tamed', 24);
    expect(entityOut(out, 'ash')?.traitLinks).toEqual([{ ...linked.traitLinks[0], groupId: 'bond', order: 0 }]);
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'tamed')).toMatchObject({ groupId: 'bond', order: 1 });
  });

  it('moves a link to another entity with its own data, refused when that entity already holds the original', () => {
    const strong = { ...world, traits: world.traits.map((t) => (t.id === 'paladin' ? { ...t, statChanges: [{ statId: 's', value: 1, type: 'min' as const }] } : t)) };
    const l1 = { id: 'l1', originalId: 'classes', kind: 'group' as const, originalName: 'Classes', groupId: null, order: 2, defaults: { paladin: true } };
    const linked = { ...ash, traitLinks: [l1] };
    const bob: Entity = { id: 'bob', name: 'Bob', traits: [trait('gruff', null, 0)] };
    // Rows: …, ash, pack, bond, tamed, l1 (collapsed), bob, gruff. The link dropped on Gruff joins Bob.
    const out = applyOwnedTraitDrop(strong, [linked, bob], ['l1'], 'l1', 'gruff', 0, 24);
    expect(entityOut(out, 'bob')?.traitLinks).toEqual([{ ...l1, order: 1 }]);
    expect(entityOut(out, 'ash')).not.toHaveProperty('traitLinks');
    const holding = { ...bob, traitLinks: [{ id: 'l2', originalId: 'wizard', kind: 'trait' as const, originalName: 'wizard', groupId: null, order: 1 }] };
    expect(applyOwnedTraitDrop(strong, [linked, holding], ['l1'], 'l1', 'gruff', 0, 24))
      .toEqual({ kind: 'refused', refusal: { reason: 'duplicate', name: 'Classes', bearer: 'Bob' } });
  });

  it('keeps an owned group holding a link inside an entity, and checks the link where it lands', () => {
    const strong = { ...world, traits: world.traits.map((t) => (t.id === 'loner' ? { ...t, statChanges: [{ statId: 's', value: 1, type: 'min' as const }] } : t)) };
    const l1 = { id: 'l1', originalId: 'loner', kind: 'trait' as const, originalName: 'Loner', groupId: 'bond', order: 1 };
    const linked = { ...ash, traitLinks: [l1] };
    // Rows: …, ash, pack, bond (collapsed), bob, gruff. Bond at the top level would carry the link out of Ash.
    const bob: Entity = { id: 'bob', name: 'Bob', traits: [trait('gruff', null, 0)] };
    expect(applyOwnedTraitDrop(strong, [linked, bob], ['bond'], 'bond', 'blueprints', -24, 24)).toBeNull();
    // Bond onto Gruff joins Bob, link and all; the link's stat effects don't refuse it.
    const out = applyOwnedTraitDrop(strong, [linked, bob], ['bond'], 'bond', 'gruff', 0, 24);
    expect(entityOut(out, 'bob')?.traitLinks).toEqual([l1]);
    // Bob already links Loner, so the move is refused.
    const holding = { ...bob, traitLinks: [{ ...l1, id: 'l2', groupId: null, order: 1 }] };
    expect(applyOwnedTraitDrop(strong, [linked, holding], ['bond'], 'bond', 'gruff', 0, 24))
      .toEqual({ kind: 'refused', refusal: { reason: 'duplicate', name: 'Loner', bearer: 'Bob' } });
  });

  it('never lands a link row outside an entity', () => {
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'loner', kind: 'trait' as const, originalName: 'Loner', groupId: null, order: 2 }] };
    // The link dropped on Loner, at the world's top level.
    expect(drop([linked], 'l1', 'loner', -24)).toBeNull();
  });

  it('never drops a row inside a linked group\'s subtree', () => {
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'classes', kind: 'group' as const, originalName: 'Classes', groupId: null, order: 2 }] };
    const tree = ownedTraitTree(world, [linked], [], { links: true });
    const rows = removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), ['pack']);
    // Pack dropped on the linked Wizard, last in the list and two levels in, would sit inside the link; it
    // lands after the link instead. Between Paladin and Wizard, there is no spot outside it.
    expect(getOwnedTraitDropProjection(tree, rows, 'pack', linkRowId('l1', 'wizard'), 48, 24)).toEqual({ depth: 1, parentId: 'ash' });
    expect(getOwnedTraitDropProjection(tree, rows, 'pack', linkRowId('l1', 'paladin'), 48, 24)).toBeNull();
  });

  it('moves a world trait into the entity with links off, taking it out of the world', () => {
    // Loner dropped below Pack at Ash's root.
    const out = drop([ash], 'loner', 'pack', 0, [], false);
    expect(out?.kind === 'moved' && out.world?.traits.map((t) => t.id)).toEqual(['paladin', 'wizard']);
    const next = entityOut(out, 'ash')!;
    expect(next).not.toHaveProperty('traitLinks');
    expect(next.traits?.find((t) => t.id === 'loner')).toMatchObject({ groupId: null, order: 1 });
  });

  it('refuses a linked Blueprint moving into an entity with links off, naming who links it or something below it (Q7)', () => {
    const linked: Entity = { id: 'bob', name: 'Bob', traitLinks: [{ id: 'l1', originalId: 'wizard', kind: 'trait', originalName: 'wizard', groupId: null, order: 0 }] };
    // Wizard dropped below Pack, one level out, lands at Ash's root.
    expect(drop([ash, linked], 'wizard', 'pack', -24, [], false))
      .toEqual({ kind: 'refused', refusal: { reason: 'blueprint-linked', name: 'wizard', bearers: ['Bob'] } });
    const groupLinked: Entity = { ...linked, traitLinks: [{ id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'paladin', groupId: null, order: 0 }] };
    expect(drop([ash, groupLinked], 'classes', 'pack', 0, ['classes'], false))
      .toEqual({ kind: 'refused', refusal: { reason: 'blueprint-linked', name: 'Classes', bearers: ['Bob'] } });
  });

  it('refuses the move with links off when the world trait carries stat effects', () => {
    const strong = { ...world, traits: world.traits.map((t) => (t.id === 'loner' ? { ...t, statChanges: [{ statId: 's', value: 1, type: 'min' as const }] } : t)) };
    const out = applyOwnedTraitDrop(strong, [ash], [], 'loner', 'pack', 0, 24, { createLinks: false });
    expect(out?.kind === 'refused' && out.refusal.reason).toBe('stats');
  });
});

describe('getOwnedTraitDropProjection', () => {
  const worldTraits = { traits: [trait('paladin', 'class', 0)], traitGroups: [group('class', null, 0)] };
  const ash: Entity = { id: 'ash', name: 'Ash', traitGroups: [group('bond', null, 0)], traits: [trait('tamed', 'bond', 0)] };
  const bob: Entity = { id: 'bob', name: 'Bob', traits: [trait('gruff', null, 0)] };
  const tree = ownedTraitTree(worldTraits, [ash, bob]);
  const visible = removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), ['bob']);

  it('stops an entity node\'s indent at the top level or a world group', () => {
    // Rows: class, paladin, ash, bond, tamed, bob. Two levels in from the top would reach Ash's Bond.
    expect(getOwnedTraitDropProjection(tree, visible, 'bob', 'bob', 48, 24)).toEqual({ depth: 0, parentId: null });
    expect(getOwnedTraitDropProjection(tree, visible, 'bob', 'paladin', 0, 24)).toEqual({ depth: 1, parentId: 'class' });
  });

  it('has no projection where the rows below would force an entity node inside another', () => {
    expect(getOwnedTraitDropProjection(tree, visible, 'bob', 'bond', 24, 24)).toBeNull();
  });

  it('stops a world group holding an entity node the same way', () => {
    const companions = { ...worldTraits, traitGroups: [...worldTraits.traitGroups, group('companions', null, 1)] };
    const withGroup = ownedTraitTree(companions, [{ ...ash, traitPlacement: { groupId: 'companions', order: 0 } }, bob]);
    const rows = removeChildrenOf(flattenTraitTree(buildTraitTree(withGroup.groups, withGroup.traits)), ['companions']);
    // Rows: class, paladin, companions, bob, gruff. Companions on Gruff, one level in, would sit in Bob.
    expect(getOwnedTraitDropProjection(withGroup, rows, 'companions', 'gruff', 24, 24)).toEqual({ depth: 0, parentId: null });
  });

  it('projects a trait across owners like any row', () => {
    expect(getOwnedTraitDropProjection(tree, visible, 'paladin', 'tamed', 24, 24)).toEqual({ depth: 2, parentId: 'bond' });
  });
});

describe('system nodes in the one tree', () => {
  // Rows in the editor: blueprints, classes, paladin, wizard, loner, ash, pack, then the Custom Persona entity's node.
  const world = {
    traits: [trait('paladin', 'classes', 0), trait('wizard', 'classes', 1), { ...trait('loner', null, 1), name: 'Loner' }],
    traitGroups: [{ ...group('blueprints', null, 0), system: 'blueprints' as const }, group('classes', 'blueprints', 0)],
  };
  const ash: Entity = { id: 'ash', name: 'Ash', traits: [trait('pack', null, 0)] };
  const cpLink = (originalId: string, kind: 'trait' | 'group' = 'trait'): TraitLink =>
    ({ id: 'l-cp', originalId, kind, originalName: originalId, groupId: null });
  /** The Custom Persona entity, linking one original. */
  const cp = (originalId = 'wizard', kind: 'trait' | 'group' = 'trait'): Entity =>
    ({ id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [cpLink(originalId, kind)] });
  const rowsOf = (tree: ReturnType<typeof ownedTraitTree>, collapsed: string[] = []) =>
    removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), collapsed);
  const drop = (lists: typeof world, ents: Entity[], activeId: string, overId: string, offset: number, collapsed: string[] = []) =>
    applyOwnedTraitDrop(lists, ents, collapsed, activeId, overId, offset, 24, { newLinkId: () => 'new' });

  it('leaves Blueprints and everything in it out of the tree play reads', () => {
    const tree = ownedTraitTree(world, [ash]);
    expect(tree.groups.map((g) => g.id)).toEqual(['ash']);
    expect(tree.traits.map((t) => t.id)).toEqual(['loner', 'pack']);
  });

  it('draws the Custom Persona entity as a node like any entity, holding its links', () => {
    const tree = ownedTraitTree(world, [ash, cp()], [], { links: true });
    expect(rowsOf(tree).map((r) => r.id)).toEqual(['blueprints', 'classes', 'paladin', 'wizard', 'loner', 'ash', 'pack', 'cp', 'l-cp']);
    expect(tree.linkRows.get('l-cp')).toMatchObject({ entityId: 'cp', root: true });
    expect(tree.entityNodes.get('cp')?.customPersona).toBe(true);
    // Play draws no node for an entity with links only.
    expect(ownedTraitTree(world, [ash, cp()]).entityNodes.has('cp')).toBe(false);
  });

  it('hides an empty Blueprints group without emptySystemNodes, and shows it once it holds something', () => {
    const empty = { traits: [world.traits[2]], traitGroups: [world.traitGroups[0]] };
    const hidden = ownedTraitTree(empty, [], [], { links: true, emptySystemNodes: false });
    expect(rowsOf(hidden).map((r) => r.id)).toEqual(['loner']);
    const shown = ownedTraitTree(empty, [], [], { links: true });
    expect(rowsOf(shown).map((r) => r.id)).toEqual(['blueprints', 'loner']);
    const full = ownedTraitTree(world, [cp()], [], { links: true, emptySystemNodes: false });
    expect(rowsOf(full).map((r) => r.id)).toEqual(['blueprints', 'classes', 'paladin', 'wizard', 'loner', 'cp', 'l-cp']);
  });

  it('links a Blueprints trait dropped into the Custom Persona entity, writing that entity alone', () => {
    // Paladin dropped one level into the collapsed node lands as its first item, ahead of the Wizard link.
    const out = drop(world, [ash, cp()], 'paladin', 'cp', 24, ['cp']);
    expect(out).toEqual({
      kind: 'moved',
      entities: [{
        ...cp(),
        traitLinks: [{ ...cpLink('wizard'), order: 1 }, { id: 'new', originalId: 'paladin', kind: 'trait', originalName: 'paladin', groupId: null, order: 0 }],
      }],
    });
  });

  it('moves a root trait dropped into the Custom Persona entity in as its own (Q2)', () => {
    const out = drop(world, [ash, cp()], 'loner', 'cp', 24, ['cp']);
    expect(out?.kind === 'moved' && out.world?.traits.map((t) => t.id)).toEqual(['paladin', 'wizard']);
    const persona = out?.kind === 'moved' ? out.entities.find((e) => e.id === 'cp') : undefined;
    expect(persona?.traits).toMatchObject([{ id: 'loner', groupId: null, order: 0 }]);
    expect(persona?.traitLinks).toEqual([{ ...cpLink('wizard'), order: 1 }]);
  });

  it('moves a top-level group holding a stat trait into the Custom Persona or a Persona entity, stats kept (Q3)', () => {
    const elf = { ...trait('elf', 'race', 0), name: 'Elf', statChanges: [{ statId: 's', value: 1, type: 'max' as const }] };
    const withRace = { traits: [...world.traits, elf], traitGroups: [...world.traitGroups, { ...group('race', null, 2), name: 'Race' }] };
    // Rows: blueprints, classes, paladin, wizard, loner, race, elf, ash, pack, cp (collapsed). Race dropped on the node, one level in.
    const out = drop(withRace, [ash, cp()], 'race', 'cp', 24, ['cp', 'race']);
    const persona = out?.kind === 'moved' ? out.entities.find((e) => e.id === 'cp') : undefined;
    expect(persona?.traitGroups?.map((g) => g.id)).toEqual(['race']);
    expect(persona?.traits).toMatchObject([{ id: 'elf', groupId: 'race', statChanges: elf.statChanges }]);
    // The same group onto a Persona-marked entity moves in; onto a cast entity it stays.
    const playable = { ...ash, persona: true };
    const played = drop(withRace, [playable], 'race', 'pack', 24, ['race']);
    expect(played?.kind === 'moved' && played.entities.find((e) => e.id === 'ash')?.traitGroups?.map((g) => g.id)).toEqual(['race']);
    expect(drop(withRace, [ash], 'race', 'pack', 24, ['race']))
      .toEqual({ kind: 'refused', refusal: { reason: 'stats', name: 'Race', kind: 'group', offender: 'Elf', owner: null } });
  });

  it('refuses a persona\'s stat trait moving to a cast entity, naming the persona it stays with', () => {
    const owning: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traits: [{ ...trait('elf', null, 0), name: 'Elf', statToggles: [{ statId: 's', enabled: true }] }] };
    // Rows: blueprints, classes, paladin, wizard, loner, ash, pack, cp, elf. Elf dropped on Pack joins Ash.
    expect(drop(world, [ash, owning], 'elf', 'pack', 0))
      .toEqual({ kind: 'refused', refusal: { reason: 'stats', name: 'Elf', kind: 'trait', offender: 'Elf', owner: 'Newcomer' } });
  });

  it('refuses a second link to a Blueprints trait the Custom Persona entity already has', () => {
    // Rows: blueprints, classes, paladin, wizard, loner, ash, pack, cp, l-cp (collapsed).
    expect(drop(world, [ash, cp('classes', 'group')], 'paladin', 'l-cp', 0, ['l-cp']))
      .toEqual({ kind: 'refused', refusal: { reason: 'duplicate', name: 'paladin', bearer: 'Newcomer' } });
  });

  it('moves a link from an entity into the Custom Persona entity with its overrides', () => {
    const l1: TraitLink = {
      id: 'l1', originalId: 'wizard', kind: 'trait', originalName: 'wizard', groupId: null, order: 1,
      overrides: { wizard: { isDefault: { value: true, blueprint: false } } },
    };
    const out = drop(world, [{ ...ash, traitLinks: [l1] }, cp('paladin')], 'l1', 'cp', 24, ['cp']);
    expect(out?.kind === 'moved' && out.entities.find((e) => e.id === 'cp')?.traitLinks).toEqual([{ ...l1, order: 0 }, { ...cpLink('paladin'), order: 1 }]);
    expect(out?.kind === 'moved' && out.entities.find((e) => e.id === 'ash')).not.toHaveProperty('traitLinks');
  });

  it('lets an owned row into the Custom Persona entity like any entity', () => {
    const tree = ownedTraitTree(world, [ash, cp()], [], { links: true });
    expect(getOwnedTraitDropProjection(tree, rowsOf(tree, ['cp']), 'pack', 'cp', 24, 24)).toEqual({ depth: 1, parentId: 'cp' });
  });

  it('never lands an entity node, the Custom Persona entity or a link inside Blueprints', () => {
    const owning: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traits: [trait('yours', null, 0)] };
    const tree = ownedTraitTree(world, [ash, owning], [], { links: true });
    // Ash dropped on Loner, two levels in, would sit in Classes inside Blueprints.
    expect(getOwnedTraitDropProjection(tree, rowsOf(tree, ['ash']), 'ash', 'loner', 48, 24)).toEqual({ depth: 0, parentId: null });
    expect(getOwnedTraitDropProjection(tree, rowsOf(tree, ['cp']), 'cp', 'loner', 48, 24)).toEqual({ depth: 0, parentId: null });
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'loner', kind: 'trait' as const, originalName: 'Loner', groupId: null, order: 1 }] };
    expect(drop(world, [linked], 'l1', 'wizard', 24)).toBeNull();
  });

  it('drags an entity node that carries a link among the world items, its links riding inside it', () => {
    const tree = ownedTraitTree(world, [ash, cp()], [], { links: true });
    expect(getOwnedTraitDropProjection(tree, rowsOf(tree, ['cp']), 'cp', 'loner', 0, 24)).toEqual({ depth: 0, parentId: null });
    const linked = { ...ash, traitLinks: [cpLink('paladin')] };
    const linkedTree = ownedTraitTree(world, [linked], [], { links: true });
    expect(getOwnedTraitDropProjection(linkedTree, rowsOf(linkedTree, ['ash']), 'ash', 'loner', 0, 24)).toEqual({ depth: 0, parentId: null });
  });

  it('says why a bearer node cannot link an original, the same way a drop refuses it', () => {
    const linked = { ...ash, traitLinks: [{ id: 'l1', originalId: 'wizard', kind: 'trait' as const, originalName: 'wizard', groupId: null }] };
    const ents = [linked, cp('classes', 'group')];
    expect(linkRefusal(world, ents, 'ash', 'paladin')).toBeNull();
    expect(linkRefusal(world, ents, 'ash', 'wizard')).toEqual({ reason: 'duplicate', name: 'wizard', bearer: 'Ash' });
    // A root trait is a duplicate for an ordinary entity only once it links it; the Custom Persona entity holds it through the root.
    expect(linkRefusal(world, ents, 'ash', 'loner')).toBeNull();
    // A linked group brings its children.
    expect(linkRefusal(world, ents, 'cp', 'paladin')).toEqual({ reason: 'duplicate', name: 'paladin', bearer: 'Newcomer' });
  });

  it('keeps Blueprints at the top level (Q68)', () => {
    const withFaction = {
      ...world,
      traits: [...world.traits, trait('guard', 'faction', 0)],
      traitGroups: [...world.traitGroups, group('faction', null, 2)],
    };
    const tree = ownedTraitTree(withFaction, [ash], [], { links: true });
    // Rows: blueprints, classes, paladin, wizard, loner, faction, guard, ash, pack. One level in, just after
    // Guard, would sit in Faction.
    expect(getOwnedTraitDropProjection(tree, rowsOf(tree, ['blueprints']), 'blueprints', 'guard', 24, 24)).toEqual({ depth: 0, parentId: null });
    const out = drop(withFaction, [ash], 'blueprints', 'guard', 24);
    expect(out?.kind === 'moved' && out.world?.groups.find((g) => g.id === 'blueprints')?.parentId).toBeNull();
  });

  it('keeps a hidden empty Blueprints group through a drop in Basic', () => {
    const empty = { traits: [trait('a', null, 1), trait('b', null, 2)], traitGroups: [world.traitGroups[0]] };
    // Rows in Basic: a, b. B dropped on A swaps them.
    const out = applyOwnedTraitDrop(empty, [], [], 'b', 'a', 0, 24, { emptySystemNodes: false });
    // A and B reindex to 0 and 1, so Blueprints takes the next free place rather than sharing one.
    expect(out?.kind === 'moved' && out.world?.traits.map((t) => [t.id, t.order])).toEqual([['a', 1], ['b', 0]]);
    expect(out?.kind === 'moved' && out.world?.groups).toEqual([{ ...world.traitGroups[0], order: 2 }]);
  });
});

describe('a one-entity tree\'s drops', () => {
  // The world Ash's links read: Classes holds Paladin and Wizard; Brave sits at the root.
  const world = {
    traits: [{ ...trait('paladin', 'classes', 0), name: 'Paladin' }, trait('wizard', 'classes', 1), trait('brave', null, 1)],
    traitGroups: [{ ...group('classes', null, 0), name: 'Classes' }],
  };
  const link = (id: string, originalId: string, kind: 'trait' | 'group', groupId: string | null, order: number): TraitLink =>
    ({ id, originalId, kind, originalName: originalId, groupId, order });
  // Ash's rows: bond, -tamed, -wild, l-brave, pack, l-classes, -l-classes/paladin, -l-classes/wizard.
  const ash: Entity = {
    id: 'ash', name: 'Ash',
    traitGroups: [group('bond', null, 0)],
    traits: [trait('tamed', 'bond', 0), trait('wild', 'bond', 1), trait('pack', null, 2)],
    traitLinks: [link('l-brave', 'brave', 'trait', null, 1), link('l-classes', 'classes', 'group', null, 3)],
  };
  const tree = entityRootTraitTree(ash, world);
  const rows = (collapsed: string[] = []) => removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), collapsed);
  const drop = (activeId: string, overId: string, offset: number, collapsed: string[] = []) =>
    applyEntityRootDrop(ash, world, collapsed, activeId, overId, offset, 24);
  const order = (entity: Entity) => [
    ...(entity.traitGroups ?? []).map((g) => [g.id, g.parentId, g.order] as const),
    ...(entity.traits ?? []).map((t) => [t.id, t.groupId, t.order] as const),
    ...(entity.traitLinks ?? []).map((l) => [l.id, l.groupId, l.order] as const),
  ].sort((a, b) => (a[1] ?? '').localeCompare(b[1] ?? '') || a[2]! - b[2]!);

  it('draws the links among the own items in order', () => {
    expect(rows().map((r) => `${'-'.repeat(r.depth)}${r.id}`)).toEqual([
      'bond', '-tamed', '-wild', 'l-brave', 'pack', 'l-classes', `-${linkRowId('l-classes', 'paladin')}`, `-${linkRowId('l-classes', 'wizard')}`,
    ]);
  });

  it('never projects a drop inside a linked group, whose rows are the original\'s', () => {
    // Pack dragged one indent right past the linked group's last row would nest in Classes: it stays at the root.
    expect(getEntityRootDropProjection(tree, rows(['bond']), 'pack', linkRowId('l-classes', 'wizard'), 24, 24))
      .toEqual({ depth: 0, parentId: null });
    // Onto a row inside the linked group, or onto its own row with rows below: those rows hold it inside, so no projection.
    expect(getEntityRootDropProjection(tree, rows(['bond']), 'pack', linkRowId('l-classes', 'paladin'), 24, 24)).toBeNull();
    expect(getEntityRootDropProjection(tree, rows(), 'pack', 'l-classes', 24, 24)).toBeNull();
    // Into an own group is fine.
    expect(getEntityRootDropProjection(tree, rows(), 'pack', 'wild', 24, 24)).toEqual({ depth: 1, parentId: 'bond' });
  });

  it('reorders own items around a link, counting the link in the order', () => {
    // Pack dragged above the Brave link: pack, l-brave, l-classes at the root after Bond.
    const next = drop('pack', 'l-brave', 0)!;
    expect(order(next)).toEqual([
      ['bond', null, 0], ['pack', null, 1], ['l-brave', null, 2], ['l-classes', null, 3],
      ['tamed', 'bond', 0], ['wild', 'bond', 1],
    ]);
    expect(next.traitLinks!.map((l) => l.originalName)).toEqual(['brave', 'classes']);
  });

  it('moves an own group past a link, keeping the group\'s own rows and the link\'s data', () => {
    const next = drop('bond', 'l-brave', 0, ['bond'])!;
    expect(order(next).filter(([, parent]) => parent === null)).toEqual([
      ['l-brave', null, 0], ['bond', null, 1], ['pack', null, 2], ['l-classes', null, 3],
    ]);
    expect(next.traits!.filter((t) => t.groupId === 'bond').map((t) => t.id)).toEqual(['tamed', 'wild']);
    // A linked group's inner rows are never written to the entity.
    expect(next.traits!.map((t) => t.id)).toEqual(['tamed', 'wild', 'pack']);
    expect(next.traitGroups!.map((g) => g.id)).toEqual(['bond']);
    expect(next.traitLinks![1]).toMatchObject({ id: 'l-classes', originalId: 'classes', groupId: null, order: 3 });
  });

  it('nests an own trait in an own group, and pulls one out to the root', () => {
    // Pack onto Wild's slot, one indent right, lands in Bond between Tamed and Wild.
    const nested = drop('pack', 'wild', 24)!;
    expect(nested.traits!.filter((t) => t.groupId === 'bond').sort((a, b) => a.order! - b.order!).map((t) => t.id)).toEqual(['tamed', 'pack', 'wild']);
    const out = drop('wild', 'l-brave', 0)!;
    expect(out.traits!.find((t) => t.id === 'wild')).toMatchObject({ groupId: null });
    expect(out.traits!.filter((t) => t.groupId === 'bond').map((t) => t.id)).toEqual(['tamed']);
  });

  it('keeps the order on a drop onto itself, and writes nothing onto a hidden row', () => {
    expect(order(drop('tamed', 'tamed', 0)!)).toEqual(order(ash));
    expect(drop('pack', 'tamed', 0, ['bond'])).toBeNull();
  });

  it("moves a link's own row among the entity's items, into an own group and back out", () => {
    // The Brave link onto Wild's slot, one indent right: it lands in Bond between Tamed and Wild.
    const inBond = drop('l-brave', 'wild', 24)!;
    expect(inBond.traitLinks![0]).toMatchObject({ id: 'l-brave', groupId: 'bond', order: 1 });
    expect(order(inBond).filter(([, parent]) => parent === 'bond')).toEqual([['tamed', 'bond', 0], ['l-brave', 'bond', 1], ['wild', 'bond', 2]]);
    expect(inBond.traits!.map((t) => t.id)).toEqual(['tamed', 'wild', 'pack']);
    // A linked group moves with its inner rows, which are never written.
    const first = drop('l-classes', 'bond', 0, ['bond', 'l-classes'])!;
    expect(order(first).filter(([, parent]) => parent === null)).toEqual([
      ['l-classes', null, 0], ['bond', null, 1], ['l-brave', null, 2], ['pack', null, 3],
    ]);
    expect(first.traitGroups!.map((g) => g.id)).toEqual(['bond']);
  });

  it('draws an unbound link as one row and reorders around it standalone', () => {
    const alone: Entity = { ...ash, traitLinks: [link('l-brave', 'brave', 'trait', null, 1)] };
    const next = applyEntityRootDrop(alone, null, [], 'pack', 'l-brave', 0, 24)!;
    expect(order(next).filter(([, parent]) => parent === null)).toEqual([['bond', null, 0], ['pack', null, 1], ['l-brave', null, 2]]);
  });
});

describe('the Custom Persona entity in the one tree', () => {
  const lists = { traits: [trait('paladin', 'class', 0), trait('loner', null, 1)], traitGroups: [group('class', null, 0)] };
  const cp: Entity = { id: 'cp', name: 'Newcomer', customPersona: true };
  const rows = (ents: Entity[], opts: { links: boolean; emptySystemNodes?: boolean } = { links: true }) => {
    const tree = ownedTraitTree(lists, ents, [], opts);
    return flattenTraitTree(buildTraitTree(tree.groups, tree.traits)).map((n) => `${'-'.repeat(n.depth)}${n.id}`);
  };

  it('draws the marked entity as a node in the editor while it holds nothing, Basic and play excepted', () => {
    expect(rows([cp, { id: 'bob', name: 'Bob' }])).toEqual(['class', '-paladin', 'loner', 'cp']);
    expect(rows([cp], { links: true, emptySystemNodes: false })).toEqual(['class', '-paladin', 'loner']);
    expect(rows([cp], { links: false })).toEqual(['class', '-paladin', 'loner']);
  });

  it('refuses the marked node dropped into a world group, naming the entity', () => {
    // Rows while it drags: class, paladin, loner, cp. Dropped on Paladin it would nest under Class.
    expect(applyOwnedTraitDrop(lists, [cp], [], 'cp', 'paladin', 0, 24)).toEqual({ kind: 'refused', refusal: { reason: 'root', name: 'Newcomer' } });
  });

  it('moves the marked node among the top-level items, keeping the order the author gives it', () => {
    const out = applyOwnedTraitDrop(lists, [cp], [], 'cp', 'class', 0, 24);
    expect(out?.kind === 'moved' && out.entities).toEqual([{ ...cp, traitPlacement: { groupId: null, order: 0 } }]);
  });

  it('reads a group placement on the marked entity as the top level', () => {
    const stored = { ...cp, traitPlacement: { groupId: 'class', order: 0 } };
    expect(rows([stored])).toEqual(['class', '-paladin', 'loner', 'cp']);
    expect(rows([{ ...stored, customPersona: undefined, traits: [trait('pack', null, 0)] }])).toEqual(['class', '-cp', '--pack', '-paladin', 'loner']);
  });
});
