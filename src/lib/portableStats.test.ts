import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import {
  bindOwnedStats, comparableOwnedStats, playLibraryStats, portableOwnedStats, statLinksBoundTo, statLinksCarriedFrom,
} from './portableStats';
import { statOwnerEntities } from './entityStats';
import { resolvedEntityStats } from './statLinks';

const stat = (id: string, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over,
});
const bp: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const link = (over: Partial<StatLink> = {}): StatLink =>
  ({ id: 'l1', originalId: 'trust', kind: 'stat', originalName: 'Trust', groupId: null, ...over });
const bram = (over: Partial<Entity> = {}): Entity => ({ id: 'bram', name: 'Bram', ...over });

/** A world whose Blueprints hold Trust, and whose player owns Health. */
const origin = {
  stats: [stat('health'), stat('trust', { name: 'Trust', groupId: 'bp', value: 5 })],
  statGroups: [bp],
};
/** Another world with its own ids for the same Blueprint. */
const elsewhere = {
  stats: [stat('health'), stat('n-trust', { name: 'Trust', groupId: 'bp', value: 7 })],
  statGroups: [bp],
};

describe('portableOwnedStats', () => {
  it('carries owned stats, groups and links, and nothing when there are none', () => {
    const own = [stat('mood')];
    const groups: StatGroup[] = [{ id: 'g', name: 'Feelings', parentId: null }];
    expect(portableOwnedStats(bram({ stats: own, statGroups: groups, statLinks: [link()] }), origin))
      .toEqual({ stats: own, statGroups: groups, statLinks: [link()] });
    expect(portableOwnedStats(bram(), origin)).toEqual({});
  });

  it('names a link by the world’s current name for its Blueprint', () => {
    const renamed = { ...origin, stats: [origin.stats[0], { ...origin.stats[1], name: 'Faith' }] };
    const out = portableOwnedStats(bram({ statLinks: [link({ originalName: 'Trust' })] }), renamed);
    expect(out.statLinks![0].originalName).toBe('Faith');
  });
});

describe('bindOwnedStats', () => {
  it('keeps a link whose Blueprint id the world holds', () => {
    const out = bindOwnedStats(bram({ statLinks: [link()] }), origin);
    expect(out.statLinks).toEqual([link()]);
  });

  it('binds by the one Blueprint carrying the stored name when the id is not there, and moves the overrides', () => {
    const overrides = { trust: { value: { value: 20, blueprint: 5 } } };
    const out = bindOwnedStats(bram({ statLinks: [link({ overrides })] }), elsewhere);
    expect(out.statLinks![0]).toMatchObject({ originalId: 'n-trust', overrides: { 'n-trust': overrides.trust } });
    expect(out.statLinks![0].overrides).not.toHaveProperty('trust');
  });

  it('drops a link when no Blueprint matches, or two carry the name', () => {
    expect(bindOwnedStats(bram({ statLinks: [link()] }), { stats: [stat('health')], statGroups: [bp] })).not.toHaveProperty('statLinks');
    const twins = { stats: [stat('a', { name: 'Trust', groupId: 'bp' }), stat('b', { name: 'Trust', groupId: 'bp' })], statGroups: [bp] };
    expect(bindOwnedStats(bram({ statLinks: [link()] }), twins)).not.toHaveProperty('statLinks');
  });

  it('never binds to a stat outside Blueprints', () => {
    const named = { stats: [stat('p-trust', { name: 'Trust' })], statGroups: [bp] };
    expect(bindOwnedStats(bram({ statLinks: [link()] }), named)).not.toHaveProperty('statLinks');
  });

  it('keeps the first of two links to one Blueprint', () => {
    const twice = bram({ statLinks: [link({ id: 'l1' }), link({ id: 'l2', originalId: 'gone', originalName: 'Trust' })] });
    expect(bindOwnedStats(twice, origin).statLinks!.map((l) => l.id)).toEqual(['l1']);
  });

  it('keeps the link first in tree order when two overlap, as play does', () => {
    const late = link({ id: 'late', order: 1, overrides: { trust: { value: { value: 1, blueprint: 5 } } } });
    const early = link({ id: 'early', order: 0, overrides: { trust: { value: { value: 9, blueprint: 5 } } } });
    const entity = bram({ statLinks: [late, early] });
    expect(bindOwnedStats(entity, origin).statLinks!.map((l) => l.id)).toEqual(['early']);
    expect(resolvedEntityStats(origin, entity)).toEqual([expect.objectContaining({ id: 'trust', value: 9 })]);
    expect(playLibraryStats(entity, origin).stats).toEqual([expect.objectContaining({ id: 'trust', value: 9 })]);
  });

  it('leaves the entity as it is when the world carries no stats', () => {
    const entity = bram({ statLinks: [link()] });
    expect(bindOwnedStats(entity, {})).toBe(entity);
  });
});

describe('a group link off-world', () => {
  const social = (id: string): StatGroup => ({ id, name: 'Social', parentId: 'bp' });
  const here = { stats: [stat('fear', { name: 'Fear', groupId: 'social' })], statGroups: [bp, social('social')] };
  const there = { stats: [stat('n-fear', { name: 'Fear', groupId: 'n-social' })], statGroups: [bp, social('n-social')] };
  const grouped = link({ originalId: 'social', kind: 'group', originalName: 'Social', overrides: { fear: { max: { value: 9, blueprint: 100 } } } });

  it('carries the names of the stats its overrides key, then binds the group and its keys by name', () => {
    const carried = portableOwnedStats(bram({ statLinks: [grouped] }), here).statLinks!;
    expect(carried[0].keyNames).toEqual({ fear: 'Fear' });
    const bound = bindOwnedStats(bram({ statLinks: carried }), there).statLinks!;
    expect(bound).toEqual([{ ...grouped, originalId: 'n-social', overrides: { 'n-fear': grouped.overrides!.fear } }]);
  });

  it('plays the group’s stats with the link’s overrides', () => {
    const carried = portableOwnedStats(bram({ statLinks: [grouped] }), here).statLinks!;
    const played = playLibraryStats(bram({ statLinks: carried }), there);
    expect(played.stats).toEqual([expect.objectContaining({ id: 'n-fear', max: 9 })]);
    expect(played.statGroups?.map((g) => g.id)).toEqual(['n-social']);
  });

  it('never binds a group link to a stat of the same name', () => {
    const named = { stats: [stat('s', { name: 'Social', groupId: 'bp' })], statGroups: [bp] };
    expect(bindOwnedStats(bram({ statLinks: [grouped] }), named)).not.toHaveProperty('statLinks');
  });

  it('compares the same in two worlds', () => {
    const carried = portableOwnedStats(bram({ statLinks: [grouped] }), here).statLinks!;
    const bound = bindOwnedStats(bram({ statLinks: carried }), there);
    expect(comparableOwnedStats(bram({ statLinks: carried }))).toEqual(comparableOwnedStats(bram({ statLinks: [{ ...bound.statLinks![0], keyNames: { 'n-fear': 'Fear' } }] })));
  });
});

describe('playLibraryStats', () => {
  it('resolves a bound link into a stat under the Blueprint’s id, with the link’s overrides', () => {
    const overrides = { 'n-trust': { value: { value: 20, blueprint: 7 } } };
    const played = playLibraryStats(bram({ statLinks: [link({ originalId: 'n-trust', overrides })] }), elsewhere);
    expect(played.statLinks).toBeUndefined();
    expect(played.stats).toEqual([expect.objectContaining({ id: 'n-trust', name: 'Trust', value: 20 })]);
  });

  it('keeps an entity’s own stats beside the linked one', () => {
    const played = playLibraryStats(bram({ stats: [stat('mood')], statLinks: [link()] }), origin);
    expect(played.stats!.map((s) => s.id).sort()).toEqual(['mood', 'trust']);
  });

  it('gives back the same entity when it has no links', () => {
    const entity = bram({ stats: [stat('mood')] });
    expect(playLibraryStats(entity, origin)).toBe(entity);
  });
});

describe('comparableOwnedStats', () => {
  it('reads one link the same in two worlds that name the Blueprint differently by id', () => {
    const here = bram({ statLinks: [link({ overrides: { trust: { value: { value: 20, blueprint: 5 } } } })] });
    const there = bindOwnedStats(here, elsewhere);
    expect(comparableOwnedStats(there)).toEqual(comparableOwnedStats(here));
  });

  it('tells a changed override apart', () => {
    const base = bram({ statLinks: [link({ overrides: { trust: { value: { value: 20, blueprint: 5 } } } })] });
    const edited = bram({ statLinks: [link({ overrides: { trust: { value: { value: 30, blueprint: 5 } } } })] });
    expect(comparableOwnedStats(edited)).not.toEqual(comparableOwnedStats(base));
  });
});

describe('a library entity’s links in the world its editor opens from', () => {
  const gone = link({ id: 'l2', originalId: 'bond', originalName: 'Bond' });

  it('binds each link that finds its Blueprint and keeps the rest as stored', () => {
    const entity = bram({ statLinks: [link(), gone] });
    const out = statLinksBoundTo(entity, elsewhere);
    expect(out.statLinks).toEqual([link({ originalId: 'n-trust' }), gone]);
  });

  it('is the entity as it is when the world carries no stats', () => {
    const entity = bram({ statLinks: [link()] });
    expect(statLinksBoundTo(entity, {})).toBe(entity);
  });

  it('names each bound link from the world’s current name, leaving an unfound one alone', () => {
    const bound = statLinksBoundTo(bram({ statLinks: [link(), gone] }), elsewhere);
    const renamed = { ...elsewhere, stats: [elsewhere.stats[0], { ...elsewhere.stats[1], name: 'Faith' }] };
    expect(statLinksCarriedFrom(bound, renamed).statLinks!.map((l) => l.originalName)).toEqual(['Faith', 'Bond']);
  });
});

describe('statOwnerEntities', () => {
  it('lists the world’s entities, then the library’s', () => {
    const world = [bram()];
    const library = [bram({ id: 'ash', name: 'Ash' })];
    expect(statOwnerEntities({ world, library }).map((e) => e.id)).toEqual(['bram', 'ash']);
  });
});
