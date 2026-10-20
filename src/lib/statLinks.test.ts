import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup } from '@/types';
import { heldReasonText } from './heldReasons';
import {
  addStatLink, applyEntityStatRows, blueprintGroupStats, detachStatLink, dropStatLinksTo, editStatLink, entityStatRows,
  holdsStatOriginal, statHeldReason, linkedStat, mergeDuplicateStatLinks, mergeStatBlueprintsGroups, playStatWorld, globalStatsOf,
  removeEntityStatGroup, removeStatBlueprints, removeStatLink, resetStatLinkFieldOn, resetStatLinkOn, resetStatLinkStatOn,
  resolvedEntityStatTree, resolvedEntityStats, statBlueprintChoices, statLinkState, statLinksTo, withEntityStatTree,
} from './statLinks';

const stat = (id: string, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over,
});
const bp: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const sub: StatGroup = { id: 'bp-social', name: 'Social', parentId: 'bp' };
const trust = stat('trust', { groupId: 'bp', value: 5, max: 50 });
const fear = stat('fear', { groupId: 'bp-social' });
const health = stat('health');
const world = { stats: [health, trust, fear], statGroups: [bp, sub] };
const bram = (over: Partial<Entity> = {}): Entity => ({ id: 'bram', name: 'Bram', ...over });

describe('globalStatsOf', () => {
  it('leaves every stat inside Blueprints out, nested ones included', () => {
    expect(globalStatsOf(world.stats, world.statGroups).map((s) => s.id)).toEqual(['health']);
  });

  it('keeps the list itself when it holds no Blueprint', () => {
    const stats = [health];
    expect(globalStatsOf(stats, world.statGroups)).toBe(stats);
  });
});

describe('blueprintGroupStats', () => {
  const calm = stat('calm', { groupId: 'bp-social' });
  const grouped = { stats: [health, trust, fear, calm], statGroups: [bp, sub] };

  it('holds the stats of the group the Blueprint stat sits in, itself included', () => {
    expect(blueprintGroupStats(grouped, fear).map((s) => s.id)).toEqual(['fear', 'calm']);
  });

  it('holds a stat directly under Blueprints alone', () => {
    expect(blueprintGroupStats(grouped, trust)).toEqual([trust]);
  });
});

describe('addStatLink', () => {
  it('links a Blueprint stat at the end of the top level', () => {
    const next = addStatLink(world, bram({ stats: [stat('mood', { groupId: null, order: 0 })] }), 'trust', 'l1')!;
    expect(next.statLinks).toEqual([{ id: 'l1', originalId: 'trust', kind: 'stat', originalName: 'trust', groupId: null, order: 1 }]);
  });

  it('refuses a second link to one Blueprint', () => {
    const once = addStatLink(world, bram(), 'trust', 'l1')!;
    expect(addStatLink(world, once, 'trust', 'l2')).toBeNull();
  });

  it('refuses a stat outside Blueprints', () => {
    expect(addStatLink(world, bram(), 'health', 'l1')).toBeNull();
  });
});

describe('a link reads its Blueprint live', () => {
  const linked = addStatLink(world, bram(), 'trust', 'l1')!;

  it('resolves to the Blueprint under its own id and name, in the link place', () => {
    const [read] = resolvedEntityStats(world, linked);
    expect(read).toMatchObject({ id: 'trust', name: 'trust', value: 5, max: 50, groupId: null });
  });

  it('follows an edit to the Blueprint', () => {
    const edited = { ...world, stats: [health, { ...trust, max: 80 }, fear] };
    expect(resolvedEntityStats(edited, linked)[0].max).toBe(80);
  });

  it('brings nothing once the original leaves Blueprints', () => {
    const moved = { ...world, stats: [health, { ...trust, groupId: null }, fear] };
    expect(resolvedEntityStats(moved, linked)).toEqual([]);
  });
});

describe('overrides', () => {
  const linked = addStatLink(world, bram(), 'trust', 'l1')!;
  const overridden = editStatLink(world, linked, 'l1', 'trust', { ...trust, value: 20, name: 'Renamed' });
  const link = overridden.statLinks![0];

  it('writes only the fields the edit changed, never the name', () => {
    expect(Object.keys(link.overrides?.trust ?? {})).toEqual(['value']);
    expect(resolvedEntityStats(world, overridden)[0]).toMatchObject({ name: 'trust', value: 20, max: 50 });
  });

  it('marks an override stale once the Blueprint changes that field', () => {
    expect(statLinkState(trust, link).stale).toEqual([]);
    expect(statLinkState({ ...trust, value: 7 }, link).stale).toEqual(['value']);
    expect(statLinkState({ ...trust, max: 70 }, link).stale).toEqual([]);
  });

  it('resets one field, then everything', () => {
    const two = editStatLink(world, overridden, 'l1', 'trust', { ...linkedStat(trust, link), regen: 3 });
    expect(Object.keys(two.statLinks![0].overrides!.trust)).toEqual(['value', 'regen']);
    const one = resetStatLinkFieldOn(two, 'l1', 'trust', 'value');
    expect(Object.keys(one.statLinks![0].overrides!.trust)).toEqual(['regen']);
    expect(resetStatLinkFieldOn(one, 'l1', 'trust', 'regen').statLinks![0].overrides).toBeUndefined();
    expect(resetStatLinkOn(two, 'l1').statLinks![0].overrides).toBeUndefined();
  });

  it('resets the Regen unit with the Regen number, since the two are one field on screen', () => {
    const daily = editStatLink(world, overridden, 'l1', 'trust', { ...linkedStat(trust, link), regen: 1 / 24, regenUnit: 'days' });
    expect(Object.keys(daily.statLinks![0].overrides!.trust)).toEqual(['value', 'regen', 'regenUnit']);
    expect(resolvedEntityStats(world, daily)[0]).toMatchObject({ regen: 1 / 24, regenUnit: 'days' });
    const reset = resetStatLinkFieldOn(daily, 'l1', 'trust', 'regen');
    expect(Object.keys(reset.statLinks![0].overrides!.trust)).toEqual(['value']);
  });

  it('drops a stored starting value when the Base Value is overridden', () => {
    expect(linkedStat({ ...trust, starting: 3 }, link).starting).toBeUndefined();
  });
});

describe('each entity keeps its own linked stat', () => {
  it('resolves one Blueprint on two entities independently', () => {
    const a = editStatLink(world, addStatLink(world, bram(), 'trust', 'l1')!, 'l1', 'trust', { ...trust, value: 20 });
    const b = addStatLink(world, { id: 'odette', name: 'Odette' }, 'trust', 'l2')!;
    const play = playStatWorld({ ...world, entities: [a, b] });
    expect(play.entities.map((e) => e.stats?.[0].value)).toEqual([20, 5]);
    expect(play.entities.every((e) => !e.statLinks)).toBe(true);
    expect(play.stats.map((s) => s.id)).toEqual(['health']);
  });

  it('keeps every list as given with no Blueprint and no link', () => {
    const plain = { stats: [health], statGroups: [], entities: [bram({ stats: [stat('mood')] })] };
    const play = playStatWorld(plain);
    expect(play.stats).toBe(plain.stats);
    expect(play.entities).toBe(plain.entities);
  });
});

describe('the entity tree', () => {
  const g: StatGroup = { id: 'g', name: 'Bonds', parentId: null, order: 0 };
  const entity = withEntityStatTree(
    addStatLink(world, bram({ statGroups: [g] }), 'trust', 'l1')!,
    [{ id: 'l1', groupId: 'g', order: 0 }], [g], () => undefined,
  );

  it('places a link inside an own group', () => {
    expect(entity.statLinks![0]).toMatchObject({ groupId: 'g', order: 0 });
    expect(resolvedEntityStats(world, entity)[0].groupId).toBe('g');
  });

  it('moves a link up when its group is deleted', () => {
    expect(removeEntityStatGroup(entity, 'g').statLinks![0].groupId).toBeNull();
  });

  it('removes a link', () => {
    expect(removeStatLink(entity, 'l1').statLinks).toBeUndefined();
  });
});

describe('statBlueprintChoices', () => {
  it('lists the Blueprint stats under their groups, the Blueprints group itself as the top level', () => {
    const empty: StatGroup = { id: 'bp-empty', name: 'Empty', parentId: 'bp', order: 2 };
    const ordered = { stats: [health, { ...trust, order: 0 }, fear], statGroups: [bp, { ...sub, order: 1 }, empty] };
    expect(statBlueprintChoices(ordered)).toEqual([
      { kind: 'owner', id: 'trust', name: 'trust', parentId: null },
      { kind: 'group', id: 'bp-social', name: 'Social', parentId: null },
      { kind: 'owner', id: 'fear', name: 'fear', parentId: 'bp-social' },
    ]);
    expect(statBlueprintChoices({ stats: [health], statGroups: [] })).toEqual([]);
  });
});

describe('removing Blueprint stats', () => {
  const linked = editStatLink(world, addStatLink(world, bram(), 'trust', 'l1')!, 'l1', 'trust', { ...trust, value: 20 });

  it('counts and drops the links to a deleted Blueprint', () => {
    expect(statLinksTo([linked], new Set(['trust']))).toBe(1);
    expect(dropStatLinksTo([linked], new Set(['trust']))[0].statLinks).toBeUndefined();
  });

  it('turns each link into an own stat under the original id when Blueprints goes', () => {
    const removal = removeStatBlueprints(world, [linked])!;
    expect(removal.entities[0].stats).toEqual([expect.objectContaining({ id: 'trust', value: 20 })]);
    expect(removal.entities[0].statLinks).toBeUndefined();
    expect(removal.stats.map((s) => s.id)).toEqual(['health', 'fear']);
    expect(removal.statGroups).toEqual([{ ...sub, parentId: null }]);
    expect(removal).toMatchObject({ detached: 1, movedUp: true });
  });

  it('detaches a group link and deletes the linked group with its subtree', () => {
    const grouped = addStatLink(world, bram(), 'bp-social', 'l1')!;
    const removal = removeStatBlueprints(world, [grouped])!;
    expect(removal.entities[0].stats?.map((s) => s.id)).toEqual(['fear']);
    expect(removal.entities[0].statGroups?.map((g) => g.name)).toEqual(['Social']);
    expect(removal.stats.map((s) => s.id)).toEqual(['health', 'trust']);
    expect(removal.statGroups).toEqual([]);
    expect(removal).toMatchObject({ detached: 1, movedUp: true });
  });
});

describe('a group link', () => {
  const kin: StatGroup = { id: 'bp-kin', name: 'Kin', parentId: 'bp-social', order: 1 };
  const love = stat('love', { groupId: 'bp-kin', order: 0, value: 40 });
  const groupWorld = { stats: [health, trust, { ...fear, order: 0 }, love], statGroups: [bp, sub, kin] };
  const linked = addStatLink(groupWorld, bram({ stats: [stat('mood', { groupId: null, order: 0 })] }), 'bp-social', 'l1')!;

  it('stores a group link at the end of the top level', () => {
    expect(linked.statLinks).toEqual([{ id: 'l1', originalId: 'bp-social', kind: 'group', originalName: 'Social', groupId: null, order: 1 }]);
  });

  it('resolves the group at the link place with its live subtree, each stat under its own id', () => {
    const tree = resolvedEntityStatTree(groupWorld, linked);
    expect(tree.stats.map((s) => s.id)).toEqual(['mood', 'fear', 'love']);
    expect(tree.groups).toEqual([{ ...sub, parentId: null, order: 1 }, kin]);
    expect(tree.stats.find((s) => s.id === 'love')).toMatchObject({ groupId: 'bp-kin', value: 40 });
    expect(tree.linkOf.get('love')?.id).toBe('l1');
  });

  it('overrides each stat on its own, and each owner keeps its own', () => {
    const a = editStatLink(groupWorld, linked, 'l1', 'love', { ...love, value: 90 });
    const b = addStatLink(groupWorld, { id: 'odette', name: 'Odette' }, 'bp-social', 'l2')!;
    expect(Object.keys(a.statLinks![0].overrides!)).toEqual(['love']);
    const play = playStatWorld({ ...groupWorld, entities: [a, b] });
    expect(play.entities.map((e) => e.stats?.find((s) => s.id === 'love')?.value)).toEqual([90, 40]);
    expect(play.entities[0].statGroups?.map((g) => g.id)).toEqual(['bp-social', 'bp-kin']);
    expect(resetStatLinkStatOn(a, 'l1', 'love').statLinks![0].overrides).toBeUndefined();
  });

  it('brings a stat added to the group, and drops one removed from it', () => {
    const added = { ...groupWorld, stats: [...groupWorld.stats, stat('awe', { groupId: 'bp-kin', order: 1 })] };
    expect(resolvedEntityStats(added, linked).map((s) => s.id)).toEqual(['mood', 'fear', 'love', 'awe']);
    const removed = { ...groupWorld, stats: groupWorld.stats.filter((s) => s.id !== 'love') };
    expect(resolvedEntityStats(removed, linked).map((s) => s.id)).toEqual(['mood', 'fear']);
  });

  it('refuses a link to anything the entity already holds', () => {
    expect(holdsStatOriginal(groupWorld, linked, 'love')).toBe(true);
    expect(holdsStatOriginal(groupWorld, linked, 'bp-kin')).toBe(true);
    expect(addStatLink(groupWorld, linked, 'love', 'l2')).toBeNull();
    const inner = addStatLink(groupWorld, bram(), 'fear', 'l1')!;
    expect(addStatLink(groupWorld, inner, 'bp-social', 'l2')).toBeNull();
    expect(addStatLink(groupWorld, bram({ stats: [{ ...trust, groupId: null }] }), 'trust', 'l1')).toBeNull();
    expect(addStatLink(groupWorld, inner, 'trust', 'l2')).not.toBeNull();
  });

  it('brings a stat the entity already owns only once, as its own', () => {
    const owns = { ...linked, stats: [...linked.stats!, { ...love, groupId: null, value: 1 }] };
    const read = resolvedEntityStats(groupWorld, owns);
    expect(read.filter((s) => s.id === 'love')).toEqual([expect.objectContaining({ value: 1, groupId: null })]);
  });

  it('refuses the Blueprints group itself', () => {
    expect(addStatLink(groupWorld, bram(), 'bp', 'l1')).toBeNull();
  });

  it('drops the links to a deleted group', () => {
    expect(dropStatLinksTo([linked], new Set(['bp-social']))[0].statLinks).toBeUndefined();
  });
});

describe('statHeldReason', () => {
  const love = stat('love', { groupId: 'bp-kin', order: 0 });
  const kin: StatGroup = { id: 'bp-kin', name: 'Kin', parentId: 'bp-social' };
  const w = { stats: [health, trust, fear, love], statGroups: [bp, sub, kin] };

  it('says the entity already links the Blueprint', () => {
    const linked = addStatLink(w, bram(), 'trust', 'l1')!;
    expect(statHeldReason(w, linked, 'trust')).toEqual({ kind: 'links', name: 'trust' });
  });

  it('says the entity owns the stat under the Blueprint id after Detach', () => {
    const linked = addStatLink(w, bram(), 'trust', 'l1')!;
    const detached = detachStatLink(w, linked, 'l1')!.entity;
    expect(detached.statLinks).toBeUndefined();
    expect(statHeldReason(w, detached, 'trust')).toEqual({ kind: 'owns', name: 'trust' });
  });

  it('says the entity links a group that holds the Blueprint', () => {
    const linked = addStatLink(w, bram(), 'bp-social', 'l1')!;
    expect(statHeldReason(w, linked, 'love')).toEqual({ kind: 'group', name: 'love', group: 'Social' });
  });

  it('says the entity already links something the group would bring', () => {
    const linked = addStatLink(w, bram(), 'fear', 'l1')!;
    expect(statHeldReason(w, linked, 'bp-social')).toEqual({ kind: 'inside', name: 'fear', group: 'Social' });
  });

  it('names an own stat a group would bring', () => {
    expect(statHeldReason(w, bram({ stats: [{ ...love, groupId: null }] }), 'bp-social')).toEqual({ kind: 'owns', name: 'love' });
  });

  it('gives no reason for a Blueprint the entity holds nothing of', () => {
    const linked = addStatLink(w, bram(), 'fear', 'l1')!;
    expect(statHeldReason(w, linked, 'trust')).toBeNull();
    expect(statHeldReason(w, bram(), 'trust')).toBeNull();
  });

  it('refuses a link exactly when it gives a reason', () => {
    const linked = addStatLink(w, bram(), 'bp-social', 'l1')!;
    for (const id of ['trust', 'fear', 'love', 'bp-social', 'bp-kin']) {
      expect(addStatLink(w, linked, id, 'l2') === null).toBe(statHeldReason(w, linked, id) !== null);
    }
  });
});

describe('heldReasonText', () => {
  it.each([
    [{ kind: 'links', name: 'Trust' }, undefined, 'Already links Trust'],
    [{ kind: 'owns', name: 'Trust' }, undefined, 'Already owns Trust'],
    [{ kind: 'group', name: 'Trust', group: 'Social' }, undefined, 'Already links Social, which holds Trust'],
    [{ kind: 'inside', name: 'Fear', group: 'Social' }, undefined, 'Already links Fear, which Social holds'],
    [{ kind: 'links', name: 'Trust' }, 'Bram', 'Bram already links Trust'],
    [{ kind: 'owns', name: 'Trust' }, 'Bram', 'Bram already owns Trust'],
  ] as const)('%j with subject %s reads "%s"', (reason, subject, text) => {
    expect(heldReasonText(reason, subject)).toBe(text);
  });
});

describe('detachStatLink', () => {
  it('turns a stat link into an own stat under the Blueprint id, with its current values in the link place', () => {
    const g: StatGroup = { id: 'g', name: 'Bonds', parentId: null, order: 0 };
    const placed = withEntityStatTree(addStatLink(world, bram({ statGroups: [g] }), 'trust', 'l1')!, [{ id: 'l1', groupId: 'g', order: 0 }], [g], () => undefined);
    const linked = editStatLink(world, placed, 'l1', 'trust', { ...trust, value: 20 });
    const res = detachStatLink(world, linked, 'l1')!;
    expect(res.newId).toBe('trust');
    expect(res.entity.statLinks).toBeUndefined();
    expect(res.entity.stats).toEqual([{ ...linkedStat(trust, linked.statLinks![0]), groupId: 'g', order: 0 }]);
    expect(res.entity.stats![0]).toMatchObject({ id: 'trust', value: 20, max: 50 });
  });

  it('copies a group link under fresh group ids, each stat under its Blueprint id', () => {
    const kin: StatGroup = { id: 'bp-kin', name: 'Kin', parentId: 'bp-social' };
    const love = stat('love', { groupId: 'bp-kin' });
    const groupWorld = { stats: [trust, fear, love], statGroups: [bp, sub, kin] };
    const linked = editStatLink(groupWorld, addStatLink(groupWorld, bram(), 'bp-social', 'l1')!, 'l1', 'love', { ...love, max: 5 });
    let n = 0;
    const res = detachStatLink(groupWorld, linked, 'l1', () => `n${++n}`)!;
    expect(res.newId).toBe('n1');
    expect(res.entity.statGroups).toEqual([
      { ...sub, id: 'n1', parentId: null, order: 0 },
      { ...kin, id: 'n2', parentId: 'n1' },
    ]);
    expect(res.entity.stats?.map((s) => [s.id, s.groupId, s.max])).toEqual([['fear', 'n1', 100], ['love', 'n2', 5]]);
    expect(res.entity.statLinks).toBeUndefined();
  });

  it('returns null for a link whose original is gone', () => {
    const linked = addStatLink(world, bram(), 'trust', 'l1')!;
    expect(detachStatLink({ ...world, stats: [health] }, linked, 'l1')).toBeNull();
  });
});

describe('a stored starting value', () => {
  const seeded = { ...trust, starting: 10, value: 5 };
  const startWorld = { ...world, stats: [health, seeded, fear] };
  const linked = addStatLink(startWorld, bram(), 'trust', 'l1')!;

  // Q8: the Base Value copies the Original's start value, not `starting`.
  it('is not the Base Value a link reads', () => {
    expect(statLinkState(seeded, linked.statLinks![0]).record.value).toBe(5);
    const [resolved] = resolvedEntityStats(startWorld, linked);
    expect(resolved).toMatchObject({ value: 5 });
    expect(resolved.starting).toBeUndefined();
  });

  it('stays behind when the Base Value is overridden', () => {
    const edited = editStatLink(startWorld, linked, 'l1', 'trust', { ...resolvedEntityStats(startWorld, linked)[0], value: 10 });
    expect(edited.statLinks![0].overrides?.trust?.value).toBeDefined();
    const [resolved] = resolvedEntityStats(startWorld, edited);
    expect(resolved).toMatchObject({ value: 10 });
    expect(resolved.starting).toBeUndefined();
  });
});

describe('the entity Stats tab tree', () => {
  const kin: StatGroup = { id: 'bp-kin', name: 'Kin', parentId: 'bp-social' };
  const love = stat('love', { groupId: 'bp-kin' });
  const groupWorld = { stats: [trust, fear, love], statGroups: [bp, sub, kin] };
  const own: StatGroup = { id: 'g', name: 'Bonds', parentId: null, order: 0 };
  const entity = addStatLink(groupWorld, bram({ statGroups: [own], stats: [stat('mood', { groupId: null, order: 1 })] }), 'bp-social', 'l1')!;
  const rows = entityStatRows(groupWorld, entity);

  it('draws a group link as a group under the link id, its subtree under the original ids', () => {
    expect(rows.groups.map((g) => [g.id, g.parentId])).toEqual([['g', null], ['l1', null], ['bp-kin', 'l1']]);
    expect(rows.stats.map((s) => [s.id, s.groupId])).toEqual([['mood', null], ['fear', 'l1'], ['love', 'bp-kin']]);
    expect(rows.linked.get('l1')).toMatchObject({ root: true, originalId: 'bp-social' });
    expect(rows.linked.get('love')).toMatchObject({ root: false, originalId: 'love' });
  });

  it('draws a link with no original by its stored name', () => {
    const lost = entityStatRows({ stats: [], statGroups: [] }, entity);
    expect(lost.stats.find((s) => s.id === 'l1')?.name).toBe('Social');
    expect(lost.linked.get('l1')).toMatchObject({ root: true, unbound: true });
  });

  it('moves a group link into an own group', () => {
    const groups = rows.groups.map((g) => (g.id === 'l1' ? { ...g, parentId: 'g', order: 0 } : g));
    const next = applyEntityStatRows(entity, rows, { groups, stats: rows.stats })!;
    expect(next.statLinks![0]).toMatchObject({ groupId: 'g', order: 0 });
    expect(next.statGroups).toEqual([own]);
    expect(next.stats?.map((s) => s.id)).toEqual(['mood']);
  });

  it('refuses a drop inside a linked group, and a linked row moved out', () => {
    const into = rows.stats.map((s) => (s.id === 'mood' ? { ...s, groupId: 'bp-kin' } : s));
    expect(applyEntityStatRows(entity, rows, { groups: rows.groups, stats: into })).toBeNull();
    const out = rows.stats.map((s) => (s.id === 'love' ? { ...s, groupId: null } : s));
    expect(applyEntityStatRows(entity, rows, { groups: rows.groups, stats: out })).toBeNull();
    const ownIn = rows.groups.map((g) => (g.id === 'g' ? { ...g, parentId: 'l1' } : g));
    expect(applyEntityStatRows(entity, rows, { groups: ownIn, stats: rows.stats })).toBeNull();
  });
});

describe('migration merges', () => {
  it('keeps one Blueprints group, nesting the others under it', () => {
    const second: StatGroup = { id: 'bp2', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const merged = mergeStatBlueprintsGroups({ stats: world.stats, statGroups: [bp, sub, second] });
    expect(merged.filter((g) => g.system === 'blueprints').map((g) => g.id)).toEqual(['bp']);
    expect(merged.find((g) => g.id === 'bp2')).toEqual({ id: 'bp2', name: 'Blueprints', parentId: 'bp', order: 2 });
  });

  it('keeps one link per original, folding overrides the kept link leaves live', () => {
    const a = { id: 'a', originalId: 'trust', kind: 'stat' as const, originalName: 'trust', groupId: null, overrides: { trust: { value: { value: 1, blueprint: 5 } } } };
    const b = { ...a, id: 'b', overrides: { trust: { value: { value: 9, blueprint: 5 }, max: { value: 70, blueprint: 50 } } } };
    expect(mergeDuplicateStatLinks(world, [a, b])).toEqual([{ ...a, overrides: { trust: { value: a.overrides.trust.value, max: b.overrides.trust.max } } }]);
  });

  it('folds a link to a stat inside a linked group into the group link', () => {
    const inner = { id: 'a', originalId: 'fear', kind: 'stat' as const, originalName: 'fear', groupId: null, overrides: { fear: { max: { value: 9, blueprint: 100 } } } };
    const group = { id: 'b', originalId: 'bp-social', kind: 'group' as const, originalName: 'Social', groupId: null };
    expect(mergeDuplicateStatLinks(world, [inner, group])).toEqual([{ ...group, overrides: inner.overrides }]);
  });

  it('keeps distinct links as given', () => {
    const a = { id: 'a', originalId: 'trust', kind: 'stat' as const, originalName: 'trust', groupId: null };
    const b = { id: 'b', originalId: 'fear', kind: 'stat' as const, originalName: 'fear', groupId: null };
    expect(mergeDuplicateStatLinks(world, [a, b])).toEqual([a, b]);
  });
});
