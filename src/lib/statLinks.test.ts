import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup } from '@/types';
import {
  addStatLink, copyStatBlueprint, dropKeepsBlueprints, dropStatLinksTo, editStatLink, linkedStat, playStatWorld, playerStatsOf,
  removeEntityStatGroup, removeStatBlueprints, removeStatLink, resetStatLinkFieldOn, resetStatLinkOn,
  resolvedEntityStats, statBlueprintChoices, statLinkState, statLinksTo, withEntityStatTree,
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

describe('playerStatsOf', () => {
  it('leaves every stat inside Blueprints out, nested ones included', () => {
    expect(playerStatsOf(world.stats, world.statGroups).map((s) => s.id)).toEqual(['health']);
  });

  it('keeps the list itself when it holds no Blueprint', () => {
    const stats = [health];
    expect(playerStatsOf(stats, world.statGroups)).toBe(stats);
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
  const overridden = editStatLink(world, linked, 'l1', { ...trust, value: 20, name: 'Renamed' });
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
    const two = editStatLink(world, overridden, 'l1', { ...linkedStat(trust, link), regen: 3 });
    expect(Object.keys(two.statLinks![0].overrides!.trust)).toEqual(['value', 'regen']);
    const one = resetStatLinkFieldOn(two, 'l1', 'trust', 'value');
    expect(Object.keys(one.statLinks![0].overrides!.trust)).toEqual(['regen']);
    expect(resetStatLinkFieldOn(one, 'l1', 'trust', 'regen').statLinks![0].overrides).toBeUndefined();
    expect(resetStatLinkOn(two, 'l1').statLinks![0].overrides).toBeUndefined();
  });

  it('drops a stored starting value when the Initial Value is overridden', () => {
    expect(linkedStat({ ...trust, starting: 3 }, link).starting).toBeUndefined();
  });
});

describe('each entity keeps its own linked stat', () => {
  it('resolves one Blueprint on two entities independently', () => {
    const a = editStatLink(world, addStatLink(world, bram(), 'trust', 'l1')!, 'l1', { ...trust, value: 20 });
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

describe('copyStatBlueprint', () => {
  it('adds an owned stat with the Blueprint fields and a fresh id', () => {
    const next = copyStatBlueprint(world, bram(), 'trust', 'c1')!;
    expect(next.stats).toEqual([{ ...trust, id: 'c1', groupId: null, order: 0 }]);
    expect(next.statLinks).toBeUndefined();
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
      { kind: 'bearer', id: 'trust', name: 'trust', parentId: null },
      { kind: 'group', id: 'bp-social', name: 'Social', parentId: null },
      { kind: 'bearer', id: 'fear', name: 'fear', parentId: 'bp-social' },
    ]);
    expect(statBlueprintChoices({ stats: [health], statGroups: [] })).toEqual([]);
  });
});

describe('dropKeepsBlueprints', () => {
  const linked = [addStatLink(world, bram(), 'trust', 'l1')!];

  it('refuses a drop that takes a linked Blueprint out of Blueprints, and allows an unlinked one', () => {
    const out = (id: string) => world.stats.map((s) => (s.id === id ? { ...s, groupId: null } : s));
    expect(dropKeepsBlueprints({ ...world, stats: out('trust') }, linked)).toBe(false);
    expect(dropKeepsBlueprints({ ...world, stats: out('fear') }, linked)).toBe(true);
  });

  it('refuses a drop that nests the Blueprints group', () => {
    const nested = [{ ...bp, parentId: 'g' }, sub, { id: 'g', name: 'G', parentId: null }];
    expect(dropKeepsBlueprints({ ...world, statGroups: nested }, [])).toBe(false);
  });
});

describe('removing Blueprint stats', () => {
  const linked = editStatLink(world, addStatLink(world, bram(), 'trust', 'l1')!, 'l1', { ...trust, value: 20 });

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
});
