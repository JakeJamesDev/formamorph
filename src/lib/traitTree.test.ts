import { describe, it, expect } from 'vitest';
import {
  buildTraitTree, isDescendantGroup, buildTraitContext,
  flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  duplicateTraitNode, ownedTraitTree, applyOwnedTraitDrop, getOwnedTraitDropProjection,
} from './traitTree';
import type { Entity, Trait, TraitGroup } from '@/types';

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
    const { groups, traits } = ownedTraitTree(world, next);
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

  it('moves a world trait into an entity under the same id, keeping its requirements', () => {
    const gated = { ...trait('paladin', 'class', 0), requires: [{ kind: 'trait' as const, id: 'loner' }] };
    // Paladin dropped below Pack lands at Ash's root.
    const out = applyOwnedTraitDrop({ ...worldTraits, traits: [gated, worldTraits.traits[1]] }, [ash], [], 'paladin', 'pack', 0, 24);
    expect(moved(out)?.world?.traits.map((t) => t.id)).toEqual(['loner']);
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'paladin')).toMatchObject({ groupId: null, requires: gated.requires });
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

  it('refuses to move a trait with stat changes or stat toggles into an entity, naming it', () => {
    const strong = { ...trait('paladin', 'class', 0), name: 'Plate Armor', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] };
    const out = applyOwnedTraitDrop({ ...worldTraits, traits: [strong, worldTraits.traits[1]] }, [ash], [], 'paladin', 'pack', 0, 24);
    expect(out).toEqual({ kind: 'refused', refusal: { name: 'Plate Armor', kind: 'trait', offender: 'Plate Armor', owner: null } });
    const toggled = { ...trait('paladin', 'class', 0), statToggles: [{ statId: 's', enabled: true }] };
    expect(applyOwnedTraitDrop({ ...worldTraits, traits: [toggled, worldTraits.traits[1]] }, [ash], [], 'paladin', 'pack', 0, 24)?.kind)
      .toBe('refused');
  });

  it('refuses to move a group into an entity when a trait inside it has stat effects, naming that trait', () => {
    const strong = { ...trait('paladin', 'class', 0), name: 'Plate Armor', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] };
    const world = { traits: [strong, trait('loner', null, 1)], traitGroups: [{ ...group('class', null, 0), name: 'Class' }] };
    // Class dropped below Pack, one level in, lands at Ash's root with Plate Armor inside it.
    const out = applyOwnedTraitDrop(world, [ash], [], 'class', 'pack', 24, 24);
    expect(out).toEqual({ kind: 'refused', refusal: { name: 'Class', kind: 'group', offender: 'Plate Armor', owner: null } });
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

  it('drops into a collapsed entity node as its first item', () => {
    // Rows: class, paladin, loner, ash (collapsed). Loner dropped on Ash, one level in.
    const out = applyOwnedTraitDrop(worldTraits, [ash], ['ash'], 'loner', 'ash', 24, 24);
    expect(entityOut(out, 'ash')?.traits?.find((t) => t.id === 'loner')).toMatchObject({ groupId: null, order: 0 });
    expect(rowsAfter(out, [ash])).toEqual(['class', '-paladin', 'ash', '-loner', '-bond', '--tamed', '-pack']);
  });

  it('names the entity a refused trait stays with', () => {
    const stray = { ...bob, traits: [{ ...trait('gruff', null, 0), name: 'Gruff', statChanges: [{ statId: 's', value: 1, type: 'min' as const }] }] };
    // Rows: class, paladin, loner, ash, bond, tamed, pack, bob, gruff. Gruff dropped on Pack joins Ash.
    expect(applyOwnedTraitDrop(worldTraits, [ash, stray], [], 'gruff', 'pack', 0, 24))
      .toEqual({ kind: 'refused', refusal: { name: 'Gruff', kind: 'trait', offender: 'Gruff', owner: 'Bob' } });
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
