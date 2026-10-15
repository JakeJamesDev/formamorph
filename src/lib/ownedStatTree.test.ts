import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup, StatLink, Trait } from '@/types';
import {
  applyOwnedStatDrop, getOwnedStatDropProjection, ownedStatRowId, ownedStatRows, ownedStatTree, type OwnedStatDrop,
} from './ownedStatTree';
import type { StatReaderWorld } from './statMoveReaders';
import { boxScripts } from '@/test/scriptFixtures';

const stat = (id: string, groupId: string | null, order: number, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], groupId, order, ...over,
});
const group = (id: string, parentId: string | null, order: number, over: Partial<StatGroup> = {}): StatGroup =>
  ({ id, name: id, parentId, order, ...over });
const trait = (id: string, over: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...over });
const link = (id: string, originalId: string, kind: 'stat' | 'group', groupId: string | null, order: number): StatLink =>
  ({ id, originalId, kind, originalName: originalId, groupId, order });

// Rows: vitals, health, bp, trust, luck, then each entity node.
const lists = {
  stats: [stat('health', 'vitals', 0), stat('trust', 'bp', 0), stat('luck', null, 2)],
  statGroups: [group('vitals', null, 0), group('bp', null, 1, { system: 'blueprints' })],
};
const ash: Entity = { id: 'ash', name: 'Ash', statGroups: [group('bond', null, 1)], stats: [stat('grit', null, 0), stat('tame', 'bond', 0)] };
const bob: Entity = { id: 'bob', name: 'Bob', stats: [stat('nerve', null, 0)] };
const world = (entities: Entity[], over: Partial<StatReaderWorld> = {}): StatReaderWorld =>
  ({ ...lists, traits: [], traitGroups: [], entities, ...over });

const rowsOf = (tree: ReturnType<typeof ownedStatTree>, collapsed: string[] = []) =>
  ownedStatRows(tree, collapsed).map((n) => `${'-'.repeat(n.depth)}${n.id}`);
const rows = (entities: Entity[], opts?: { emptySystemNodes?: boolean }) => rowsOf(ownedStatTree(lists, entities, opts));
const drop = (w: StatReaderWorld, activeId: string, overId: string, offset: number, collapsed: string[] = [], createLinks = true) =>
  applyOwnedStatDrop(w, collapsed, activeId, overId, offset, 24, { createLinks, newLinkId: () => 'new' });
const moved = (out: OwnedStatDrop | null) => (out?.kind === 'moved' ? out : null);
const entityOut = (out: OwnedStatDrop | null, id: string) => moved(out)?.entities.find((e) => e.id === id);
const refusal = (out: OwnedStatDrop | null) => (out?.kind === 'refused' ? out.refusal : null);
/** The one tree after a drop, from what it wrote. */
const rowsAfter = (out: OwnedStatDrop | null, ents: Entity[]) => {
  const m = moved(out)!;
  const next = ents.map((e) => m.entities.find((x) => x.id === e.id) ?? e);
  const w = m.world ? { stats: m.world.stats, statGroups: m.world.groups } : lists;
  return rowsOf(ownedStatTree(w, next));
};
const a = (id: string) => ownedStatRowId('ash', id);
const b = (id: string) => ownedStatRowId('bob', id);

describe('ownedStatTree', () => {
  it('puts a node for each entity that owns a stat or a group after the world items, holding its own tree', () => {
    expect(rows([{ id: 'npc', name: 'Npc' }, ash, bob])).toEqual([
      'vitals', '-health', 'bp', '-trust', 'luck', 'ash', `-${a('grit')}`, `-${a('bond')}`, `--${a('tame')}`, 'bob', `-${b('nerve')}`,
    ]);
    const tree = ownedStatTree(lists, [ash]);
    expect(tree.entityNodes.get('ash')?.name).toBe('Ash');
    expect(tree.owned.get(a('tame'))).toEqual({ entityId: 'ash', id: 'tame' });
    expect(tree.owned.has('health')).toBe(false);
  });

  it('gives a node to an entity holding only a group or only a link, and none to one holding nothing', () => {
    expect(rows([{ id: 'cy', name: 'Cy', statGroups: [group('g', null, 0)] }])).toEqual(['vitals', '-health', 'bp', '-trust', 'luck', 'cy', `-${ownedStatRowId('cy', 'g')}`]);
    const linked: Entity = { id: 'cy', name: 'Cy', statLinks: [link('l1', 'trust', 'stat', null, 0)] };
    expect(rows([linked])).toEqual(['vitals', '-health', 'bp', '-trust', 'luck', 'cy', `-${ownedStatRowId('cy', 'l1')}`]);
    expect(ownedStatTree(lists, [linked]).owned.get(ownedStatRowId('cy', 'l1'))?.linked).toMatchObject({ root: true, originalId: 'trust' });
    expect(rows([{ id: 'npc', name: 'Npc' }])).toEqual(['vitals', '-health', 'bp', '-trust', 'luck']);
  });

  it('draws an empty Custom Persona entity only with empty system nodes on', () => {
    const cp: Entity = { id: 'cp', name: 'You', customPersona: true };
    expect(rows([cp])).toContain('cp');
    expect(rows([cp], { emptySystemNodes: false })).not.toContain('cp');
  });

  it('keeps a stat that shares a world stat\'s id apart under its own row id', () => {
    const twin: Entity = { id: 'bob', name: 'Bob', stats: [stat('health', null, 0)] };
    expect(rows([twin])).toEqual(['vitals', '-health', 'bp', '-trust', 'luck', 'bob', `-${b('health')}`]);
  });

  it('places an entity node in the world group its placement names, and reads a gone or Blueprints group as the end', () => {
    expect(rows([{ ...ash, statPlacement: { groupId: 'vitals', order: 0 } }]).slice(0, 3)).toEqual(['vitals', '-ash', `--${a('grit')}`]);
    // Order 1 ties with Blueprints, which keeps its place; Luck, at 2, follows the node.
    expect(rows([{ ...ash, statPlacement: { groupId: null, order: 1 } }]))
      .toEqual(['vitals', '-health', 'bp', '-trust', 'ash', `-${a('grit')}`, `-${a('bond')}`, `--${a('tame')}`, 'luck']);
    for (const groupId of ['gone', 'bp']) expect(rows([{ ...ash, statPlacement: { groupId, order: 0 } }])[5]).toBe('ash');
  });

  it('keeps the Custom Persona entity\'s node at the top level whatever its placement', () => {
    const cp: Entity = { id: 'cp', name: 'You', customPersona: true, stats: [stat('x', null, 0)], statPlacement: { groupId: 'vitals', order: 0 } };
    expect(rows([cp])).toEqual(['vitals', '-health', 'bp', '-trust', 'luck', 'cp', `-${ownedStatRowId('cp', 'x')}`]);
  });

  it('draws a group link with the original\'s live subtree under row ids of its own', () => {
    const w = { stats: [...lists.stats, stat('fear', 'social', 0)], statGroups: [...lists.statGroups, group('social', 'bp', 1)] };
    const cy: Entity = { id: 'cy', name: 'Cy', statLinks: [link('l1', 'social', 'group', null, 0)] };
    const tree = ownedStatTree(w, [cy]);
    expect(rowsOf(tree).slice(-3)).toEqual(['cy', `-${ownedStatRowId('cy', 'l1')}`, `--${ownedStatRowId('cy', 'fear')}`]);
    expect(tree.owned.get(ownedStatRowId('cy', 'fear'))?.linked).toMatchObject({ root: false, originalId: 'fear' });
  });
});

describe('applyOwnedStatDrop', () => {
  it('reorders items inside one entity and writes back that entity alone', () => {
    // Grit dropped on Tame, one level in, lands in Bond.
    const out = drop(world([ash]), a('grit'), a('tame'), 24);
    expect(moved(out)?.world).toBeUndefined();
    expect(entityOut(out, 'ash')?.stats).toEqual([stat('tame', 'bond', 0), stat('grit', 'bond', 1)]);
    expect(entityOut(out, 'ash')?.statPlacement).toBeUndefined();
  });

  it('still moves world stats among themselves, touching no entity', () => {
    const out = drop(world([ash]), 'luck', 'health', 0);
    expect(moved(out)?.entities).toEqual([]);
    expect(moved(out)?.world?.stats.find((s) => s.id === 'luck')).toMatchObject({ groupId: 'vitals' });
  });

  it('moves a world stat into an entity under the same id', () => {
    // Health dropped below Grit joins Ash.
    const out = drop(world([ash]), 'health', a('grit'), 0);
    expect(moved(out)?.world?.stats.map((s) => s.id)).toEqual(['trust', 'luck']);
    expect(entityOut(out, 'ash')?.stats?.find((s) => s.id === 'health')).toMatchObject({ groupId: null, order: 1 });
    expect(moved(out)?.rowIds.get('health')).toBe(a('health'));
    expect(rowsAfter(out, [ash])).toEqual(['vitals', 'bp', '-trust', 'luck', 'ash', `-${a('grit')}`, `-${a('health')}`, `-${a('bond')}`, `--${a('tame')}`]);
  });

  it('moves an entity stat out to the world under the same id', () => {
    // Grit dropped on Luck, one level out, lands at the top level.
    const out = drop(world([ash]), a('grit'), 'luck', -24);
    expect(moved(out)?.world?.stats.find((s) => s.id === 'grit')).toMatchObject({ groupId: null });
    expect(entityOut(out, 'ash')?.stats?.map((s) => s.id)).toEqual(['tame']);
    expect(moved(out)?.rowIds.get(a('grit'))).toBe('grit');
  });

  it('moves a stat from one entity to another', () => {
    const out = drop(world([ash, bob]), b('nerve'), a('grit'), 0);
    expect(moved(out)?.world).toBeUndefined();
    expect(entityOut(out, 'ash')?.stats?.map((s) => s.id)).toEqual(['nerve', 'grit', 'tame']);
    expect(entityOut(out, 'bob')).not.toHaveProperty('stats');
  });

  it('moves a group across owners with its whole subtree, every id kept', () => {
    const out = drop(world([ash, bob]), a('bond'), b('nerve'), 0, [a('bond')]);
    expect(entityOut(out, 'bob')?.statGroups).toEqual([group('bond', null, 1)]);
    expect(entityOut(out, 'bob')?.stats?.map((s) => [s.id, s.groupId])).toEqual([['nerve', null], ['tame', 'bond']]);
    expect(entityOut(out, 'ash')).not.toHaveProperty('statGroups');
  });

  it('drags an entity node into a world group, storing its placement', () => {
    const out = drop(world([ash]), 'ash', 'health', 0, ['ash']);
    expect(entityOut(out, 'ash')?.statPlacement).toEqual({ groupId: 'vitals', order: 0 });
    expect(entityOut(out, 'ash')?.stats).toEqual(ash.stats);
  });

  it('never places an entity node in Blueprints or in another entity', () => {
    expect(drop(world([ash, bob]), 'bob', 'trust', 0, ['bob'])).toBeNull();
    expect(drop(world([ash, bob]), 'bob', a('bond'), 24, ['bob'])).toBeNull();
  });

  it('refuses the Custom Persona entity\'s node leaving the top level', () => {
    const cp: Entity = { id: 'cp', name: 'You', customPersona: true, stats: [stat('x', null, 0)] };
    expect(refusal(drop(world([cp]), 'cp', 'health', 0, ['cp']))).toEqual({ reason: 'root', name: 'You' });
  });

  it('links a Blueprint stat dropped into an entity, in the place it was dropped, and leaves the world alone', () => {
    const out = drop(world([ash]), 'trust', a('grit'), 0);
    expect(moved(out)?.world).toBeUndefined();
    const next = entityOut(out, 'ash')!;
    expect(next.statLinks).toEqual([{ id: 'new', originalId: 'trust', kind: 'stat', originalName: 'trust', groupId: null, order: 1 }]);
    expect(next.stats?.map((s) => s.id)).toEqual(['grit', 'tame']);
    expect(moved(out)?.rowIds.get('trust')).toBe(a('new'));
  });

  it('refuses a link the entity already holds, with Link Stat\'s reason, and links nothing with links off', () => {
    const holding = { ...ash, statLinks: [link('l1', 'trust', 'stat', null, 3)] };
    expect(refusal(drop(world([holding]), 'trust', a('grit'), 0))).toEqual({ reason: 'held', owner: 'Ash', held: { kind: 'links', name: 'trust' } });
    const detached = { ...ash, stats: [...ash.stats!, stat('trust', null, 3)] };
    expect(refusal(drop(world([detached]), 'trust', a('grit'), 0))).toEqual({ reason: 'held', owner: 'Ash', held: { kind: 'owns', name: 'trust' } });
    expect(drop(world([ash]), 'trust', a('grit'), 0, [], false)).toBeNull();
  });

  it('keeps Blueprints at the top level', () => {
    // Blueprints dropped above Health, which sits in Vitals, has no top-level spot there.
    expect(drop(world([]), 'bp', 'health', 24, ['bp'])).toBeNull();
  });

  it('refuses a linked Blueprint leaving Blueprints, naming every entity that links it', () => {
    const cy: Entity = { id: 'cy', name: 'Cy', statLinks: [link('l1', 'trust', 'stat', null, 0)] };
    expect(refusal(drop(world([cy]), 'trust', 'luck', -24))).toEqual({ reason: 'blueprint-linked', name: 'trust', owners: ['Cy'] });
    expect(drop(world([]), 'trust', 'luck', -24)?.kind).toBe('moved');
  });

  it('refuses a linked Blueprint group leaving Blueprints', () => {
    // Rows: vitals, health, bp, social, fear, luck, cy. Social dropped on Luck, one level out.
    const w = { ...world([]), stats: [...lists.stats.filter((s) => s.id !== 'trust'), stat('fear', 'social', 0)], statGroups: [...lists.statGroups, group('social', 'bp', 0)] };
    const cy: Entity = { id: 'cy', name: 'Cy', statLinks: [link('l1', 'social', 'group', null, 0)] };
    expect(refusal(drop({ ...w, entities: [cy] }, 'social', 'luck', -24, ['social'])))
      .toEqual({ reason: 'blueprint-linked', name: 'social', owners: ['Cy'] });
    expect(drop(w, 'social', 'luck', -24, ['social'])?.kind).toBe('moved');
  });

  it('moves a link to another entity, refused when that entity already holds the original', () => {
    const cy: Entity = { id: 'cy', name: 'Cy', statLinks: [link('l1', 'trust', 'stat', null, 0)] };
    const out = drop(world([cy, bob]), ownedStatRowId('cy', 'l1'), b('nerve'), 0);
    expect(entityOut(out, 'bob')?.statLinks).toEqual([{ ...link('l1', 'trust', 'stat', null, 1) }]);
    expect(entityOut(out, 'cy')).not.toHaveProperty('statLinks');
    const holding = { ...bob, statLinks: [link('l2', 'trust', 'stat', null, 1)] };
    expect(refusal(drop(world([cy, holding]), ownedStatRowId('cy', 'l1'), b('nerve'), 0)))
      .toEqual({ reason: 'held', owner: 'Bob', held: { kind: 'links', name: 'trust' } });
  });

  it('carries a stat\'s morph bindings and descriptor pins across owners', () => {
    const pinned = stat('health', 'vitals', 0, {
      morphBindings: ['belly'],
      descriptors: [{ id: 'd1', threshold: 0, description: 'Weak', placeholderPins: [{ placeholderId: 'p-mood', value: 'Low' }] }],
    });
    const w = world([ash], { stats: [pinned, ...lists.stats.slice(1)] });
    const carried = entityOut(drop(w, 'health', a('grit'), 0), 'ash')?.stats?.find((s) => s.id === 'health');
    expect(carried).toMatchObject({ morphBindings: pinned.morphBindings, descriptors: pinned.descriptors });
  });

  it('never lands a link row outside an entity', () => {
    const cy: Entity = { id: 'cy', name: 'Cy', stats: [stat('x', null, 0)], statLinks: [link('l1', 'trust', 'stat', null, 1)] };
    expect(drop(world([cy]), ownedStatRowId('cy', 'l1'), 'luck', -24)).toBeNull();
  });

  it('refuses a stat whose id the destination already holds, as Detach leaves one', () => {
    const detached: Entity = { id: 'bob', name: 'Bob', stats: [stat('trust', null, 0)] };
    expect(refusal(drop(world([detached]), b('trust'), 'luck', -24))).toEqual({ reason: 'duplicate', name: 'trust', owner: null });
    const twin: Entity = { id: 'odd', name: 'Odette', stats: [stat('trust', null, 0)] };
    expect(refusal(drop(world([detached, twin]), b('trust'), ownedStatRowId('odd', 'trust'), 0)))
      .toEqual({ reason: 'duplicate', name: 'trust', owner: 'Odette' });
  });
});

describe('applyOwnedStatDrop: what reads a stat', () => {
  const read = (out: OwnedStatDrop | null) => {
    const r = refusal(out);
    return r?.reason === 'read' ? r : null;
  };

  it('refuses a world stat a world trait changes or switches', () => {
    const brave = trait('brave', { statChanges: [{ statId: 'health', value: 1, type: 'max' }] });
    expect(read(drop(world([ash], { traits: [brave] }), 'health', a('grit'), 0)))
      .toEqual({ reason: 'read', name: 'health', owner: null, reader: { kind: 'change', trait: 'brave' } });
    const lit = trait('lit', { statToggles: [{ statId: 'health', enabled: true }] });
    expect(read(drop(world([ash], { traits: [lit] }), 'health', a('grit'), 0))?.reader).toEqual({ kind: 'toggle', trait: 'lit' });
    const other = trait('other', { statChanges: [{ statId: 'luck', value: 1 }] });
    expect(drop(world([ash], { traits: [other] }), 'health', a('grit'), 0)?.kind).toBe('moved');
  });

  it('refuses an entity stat its own trait changes', () => {
    const gruff = { ...ash, traits: [trait('gruff', { statChanges: [{ statId: 'grit', value: 1 }] })] };
    expect(read(drop(world([gruff]), a('grit'), 'luck', -24)))
      .toEqual({ reason: 'read', name: 'grit', owner: 'Ash', reader: { kind: 'change', trait: 'gruff' } });
  });

  it('refuses a world stat any entity\'s trait reaches as a global stat, played or not (Q30)', () => {
    const bold = { ...bob, persona: true, traits: [trait('bold', { statChanges: [{ statId: 'luck', value: 1 }] })] };
    expect(read(drop(world([ash, bold]), 'luck', a('grit'), 0))?.reader).toEqual({ kind: 'change', trait: 'bold' });
    expect(read(drop(world([ash, { ...bold, persona: undefined }]), 'luck', a('grit'), 0))?.reader)
      .toEqual({ kind: 'change', trait: 'bold' });
  });

  it('refuses a group when a trait reads a stat inside it', () => {
    const tamer = { ...ash, traits: [trait('tamer', { statChanges: [{ statId: 'tame', value: 1 }] })] };
    expect(read(drop(world([tamer, bob]), a('bond'), b('nerve'), 0, [a('bond')]))?.name).toBe('tame');
  });

  it('refuses a stat that staying code reads by name, and one whose own owner.stats reads a stat left behind', () => {
    const luckReads = { ...lists, stats: lists.stats.map((s) => (s.id === 'luck' ? { ...s, scripts: boxScripts({ after: 'return stats.health + 1;' }) } : s)) };
    expect(read(drop(world([ash], luckReads), 'health', a('grit'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'luck' });
    const gritReads = { ...ash, stats: ash.stats!.map((s) => (s.id === 'grit' ? { ...s, scripts: boxScripts({ before: "return owner.stats['tame'];" }) } : s)) };
    expect(read(drop(world([gritReads, bob]), a('grit'), b('nerve'), 0)))
      .toEqual({ reason: 'read', name: 'grit', owner: 'Ash', reader: { kind: 'reads', stat: 'tame' } });
  });

  it('refuses entity stats moving to the world together when one reads another through owner.stats', () => {
    const bonded = { ...ash, stats: [stat('grit', 'bond', 1), stat('tame', 'bond', 0, { scripts: boxScripts({ after: 'return owner.stats.grit;' }) })] };
    expect(read(drop(world([bonded, bob]), a('bond'), 'luck', -24, [a('bond')])))
      .toEqual({ reason: 'read', name: 'tame', owner: 'Ash', reader: { kind: 'reads', stat: 'grit' } });
    // Another entity owns both afterwards, so the read still lands.
    expect(drop(world([bonded, bob]), a('bond'), b('nerve'), 0, [a('bond')])?.kind).toBe('moved');
  });

  it('reads stats as the world stats in every box', () => {
    // An entity stat's `stats.health` is the world's Health, so moving Health off the world breaks it.
    const tameReads = { ...ash, stats: ash.stats!.map((s) => (s.id === 'tame' ? { ...s, scripts: boxScripts({ after: 'return stats.health;' }) } : s)) };
    expect(read(drop(world([tameReads]), 'health', a('grit'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'tame' });
    // And its `stats.grit` never named its own Grit, so moving Grit away breaks nothing.
    const gritByStats = { ...ash, stats: ash.stats!.map((s) => (s.id === 'tame' ? { ...s, scripts: boxScripts({ after: 'return stats.grit;' }) } : s)) };
    expect(drop(world([gritByStats, bob]), a('grit'), b('nerve'), 0)?.kind).toBe('moved');
    // A moved world stat's own `stats.luck` still reads the world's Luck from its new owner.
    const healthReads = { ...lists, stats: lists.stats.map((s) => (s.id === 'health' ? { ...s, scripts: boxScripts({ before: "return stats['luck'];" }) } : s)) };
    expect(drop(world([ash], healthReads), 'health', a('grit'), 0)?.kind).toBe('moved');
  });

  it('refuses an entity stat that a staying stat of its entity reads through owner.stats', () => {
    const tameReads = { ...ash, stats: ash.stats!.map((s) => (s.id === 'tame' ? { ...s, scripts: boxScripts({ after: 'return owner.stats.grit;' }) } : s)) };
    expect(read(drop(world([tameReads, bob]), a('grit'), b('nerve'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'tame' });
  });

  it('refuses an entity stat that a Blueprint reads through owner.stats for that owner, or a link override reads', () => {
    const bpReads = { ...lists, stats: lists.stats.map((s) => (s.id === 'trust' ? { ...s, scripts: boxScripts({ after: 'return owner.stats.grit;' }) } : s)) };
    const owner = { ...ash, statLinks: [link('l1', 'trust', 'stat', null, 2)] };
    expect(read(drop(world([owner, bob], bpReads), a('grit'), b('nerve'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'trust' });
    // Bob has it too but holds no Grit, so moving his Nerve reads nothing.
    expect(drop(world([owner, { ...bob, statLinks: [link('l2', 'trust', 'stat', null, 1)] }], bpReads), b('nerve'), a('grit'), 0)?.kind).toBe('moved');
    const overriding = { ...owner, statLinks: [{ ...link('l1', 'trust', 'stat', null, 2), overrides: { trust: { scripts: { value: boxScripts({ after: 'return owner.stats.grit;' }), blueprint: [] } } } }] };
    expect(read(drop(world([overriding, bob]), a('grit'), b('nerve'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'trust' });
  });

  it('refuses an entity stat that code reads through entities, or through persona while it can be played', () => {
    const viaEntities = { ...lists, stats: lists.stats.map((s) => (s.id === 'luck' ? { ...s, scripts: boxScripts({ after: 'return entities.Ash.stats.grit;' }) } : s)) };
    expect(read(drop(world([ash], viaEntities), a('grit'), 'luck', -24))?.reader).toEqual({ kind: 'readBy', stat: 'luck' });
    const viaPersona = { ...lists, stats: lists.stats.map((s) => (s.id === 'luck' ? { ...s, scripts: boxScripts({ after: 'return persona.stats.nerve;' }) } : s)) };
    expect(read(drop(world([ash, { ...bob, persona: true }], viaPersona), b('nerve'), a('grit'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'luck' });
    expect(drop(world([ash, bob], viaPersona), b('nerve'), a('grit'), 0)?.kind).toBe('moved');
  });

  it('reads a Blueprint\'s stats as the world\'s, and never reaches a Blueprint through stats', () => {
    const bpReads = { ...lists, stats: lists.stats.map((s) => (s.id === 'trust' ? { ...s, scripts: boxScripts({ after: 'return stats.health + 1;' }) } : s)) };
    const owner = { ...ash, statLinks: [link('l1', 'trust', 'stat', null, 2)] };
    expect(read(drop(world([owner, bob], bpReads), 'health', b('nerve'), 0))?.reader).toEqual({ kind: 'readBy', stat: 'trust' });
    const healthReads = { ...lists, stats: lists.stats.map((s) => (s.id === 'health' ? { ...s, scripts: boxScripts({ after: 'return stats.trust;' }) } : s)) };
    expect(drop(world([ash], healthReads), 'health', a('grit'), 0)?.kind).toBe('moved');
  });

  it('lets a stat go when a staying stat still answers its name', () => {
    const twins = { ...lists, stats: [...lists.stats.map((s) => (s.id === 'luck' ? { ...s, scripts: boxScripts({ after: 'return stats.health;' }) } : s)), stat('health2', null, 3, { name: 'health' })] };
    expect(drop(world([ash], twins), 'health', a('grit'), 0)?.kind).toBe('moved');
    // The twin the name reads now goes, and the one left answers instead.
    expect(drop(world([ash], twins), 'health2', a('grit'), 0)?.kind).toBe('moved');
  });

  it('lets an entity stat go when another entity that can be played still answers persona', () => {
    const viaPersona = { ...lists, stats: lists.stats.map((s) => (s.id === 'luck' ? { ...s, scripts: boxScripts({ after: 'return persona.stats.nerve;' }) } : s)) };
    const nervy = { ...ash, persona: true, stats: [...ash.stats!, stat('ash-nerve', null, 2, { name: 'nerve' })] };
    expect(drop(world([nervy, { ...bob, persona: true }], viaPersona), b('nerve'), a('grit'), 0)?.kind).toBe('moved');
  });
});

describe('applyOwnedStatDrop: what a world or trait script reads', () => {
  const read = (out: OwnedStatDrop | null) => {
    const r = refusal(out);
    return r?.reason === 'read' ? r : null;
  };
  const worldScript = (code: string) => ({ scripts: [{ id: 'ws', timing: 'after' as const, code }] });

  it('refuses a world stat that a world script reads', () => {
    expect(read(drop(world([ash], worldScript('return stats.health;')), 'health', a('grit'), 0)))
      .toEqual({ reason: 'read', name: 'health', owner: null, reader: { kind: 'readByWorld' } });
  });

  it('refuses a world stat that a world trait script reads', () => {
    const watcher = trait('watcher', { scripts: boxScripts({ after: 'return stats.health;' }) });
    expect(read(drop(world([ash], { traits: [watcher] }), 'health', a('grit'), 0)))
      .toEqual({ reason: 'read', name: 'health', owner: null, reader: { kind: 'readByTrait', trait: 'watcher' } });
  });

  it('refuses an entity stat that its own trait script reads through owner', () => {
    const gruff = { ...ash, traits: [trait('gruff', { scripts: boxScripts({ after: 'return owner.stats.grit;' }) })] };
    expect(read(drop(world([gruff, bob]), a('grit'), b('nerve'), 0))?.reader).toEqual({ kind: 'readByTrait', trait: 'gruff' });
  });

  it('moves a stat that every script still reaches', () => {
    const other = { ...worldScript('return stats.luck;'), traits: [trait('watcher', { scripts: boxScripts({ after: 'return stats.luck;' }) })] };
    expect(drop(world([ash], other), 'health', a('grit'), 0)?.kind).toBe('moved');
    // A trait script that reads another owner's stat is no reader of this one.
    const gruff = { ...ash, traits: [trait('gruff', { scripts: boxScripts({ after: 'return owner.stats.tame;' }) })] };
    expect(drop(world([gruff, bob]), a('grit'), b('nerve'), 0)?.kind).toBe('moved');
  });

  it('refuses a world stat moving into Blueprints that a world script reads', () => {
    const out = drop(world([], worldScript('return stats.luck;')), 'luck', 'trust', 24);
    const r = refusal(out);
    expect(r).toEqual({ reason: 'into-blueprints', name: 'luck', reader: { kind: 'readByWorld' } });
  });
});

describe('applyOwnedStatDrop: what reads a stat moving into Blueprints', () => {
  const intoBlueprints = (out: OwnedStatDrop | null) => {
    const r = refusal(out);
    return r?.reason === 'into-blueprints' ? r : null;
  };
  // Luck dropped on Trust, one level in, joins Blueprints.
  const luckIn = (over: Partial<StatReaderWorld>) => drop(world([], over), 'luck', 'trust', 24);
  const coded = (id: string, code: string) => ({ stats: lists.stats.map((s) => (s.id === id ? { ...s, scripts: boxScripts({ after: code }) } : s)) });

  it('moves a world stat that nothing reads into Blueprints', () => {
    expect(moved(luckIn({}))?.world?.stats.find((s) => s.id === 'luck')).toMatchObject({ groupId: 'bp' });
  });

  it('refuses a world stat a trait row reaches, naming the trait', () => {
    const brave = trait('brave', { statChanges: [{ statId: 'luck', value: 1 }] });
    expect(intoBlueprints(luckIn({ traits: [brave] })))
      .toEqual({ reason: 'into-blueprints', name: 'luck', reader: { kind: 'change', trait: 'brave' } });
    const lit = trait('lit', { statToggles: [{ statId: 'luck', enabled: false }] });
    expect(intoBlueprints(luckIn({ traits: [lit] }))?.reader).toEqual({ kind: 'toggle', trait: 'lit' });
  });

  it('refuses a world stat that another stat\'s code reads, naming that stat', () => {
    expect(intoBlueprints(luckIn(coded('health', 'return stats.luck;')))?.reader).toEqual({ kind: 'readBy', stat: 'health' });
  });

  it('lets a stat in whose own code reads a stat that stays, since a Blueprint reads its linkers\' stats', () => {
    expect(luckIn(coded('luck', 'return stats.health;'))?.kind).toBe('moved');
  });

  it('refuses a group when anything inside it is read, naming the first hit', () => {
    const brave = trait('brave', { statChanges: [{ statId: 'health', value: 1 }] });
    // Vitals dropped on Trust, one level in, joins Blueprints with Health.
    expect(intoBlueprints(drop(world([], { traits: [brave] }), 'vitals', 'trust', 24, ['vitals'])))
      .toEqual({ reason: 'into-blueprints', name: 'health', reader: { kind: 'change', trait: 'brave' } });
    expect(drop(world([]), 'vitals', 'trust', 24, ['vitals'])?.kind).toBe('moved');
  });

  it('still moves a stat within Blueprints and out of it unread', () => {
    const brave = trait('brave', { statChanges: [{ statId: 'luck', value: 1 }] });
    expect(drop(world([], { traits: [brave] }), 'trust', 'luck', -24)?.kind).toBe('moved');
  });
});

describe('getOwnedStatDropProjection', () => {
  it('projects a stat across owners like any row', () => {
    const tree = ownedStatTree(lists, [ash]);
    const visible = ownedStatRows(tree, ['health']);
    expect(getOwnedStatDropProjection(tree, visible, 'health', a('tame'), 24, 24)).toEqual({ depth: 2, parentId: a('bond') });
  });

  it('never drops a row inside a linked group\'s subtree', () => {
    const w = { stats: [...lists.stats, stat('fear', 'social', 0), stat('dread', 'social', 1)], statGroups: [...lists.statGroups, group('social', 'bp', 1)] };
    const cy: Entity = { id: 'cy', name: 'Cy', stats: [stat('x', null, 0)], statLinks: [link('l1', 'social', 'group', null, 1)] };
    const tree = ownedStatTree(w, [cy]);
    const visible = ownedStatRows(tree, [ownedStatRowId('cy', 'x')]);
    // X dropped between Fear and Dread has no spot outside the link.
    expect(getOwnedStatDropProjection(tree, visible, ownedStatRowId('cy', 'x'), ownedStatRowId('cy', 'fear'), 48, 24)).toBeNull();
  });
});
