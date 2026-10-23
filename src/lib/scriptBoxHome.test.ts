import { describe, expect, it } from 'vitest';
import type { Entity, Placeholder, Stat, Trait } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { offWorldOf, ownerStatsOf, scriptHomeOf, statPanelHome, traitPanelHome, type ScriptBoxWorld } from './scriptBoxHome';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

// Health's name carries a chip, so every home reads it under its code name.
const beast: Placeholder = { id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder;
const BEAST_HEALTH = `${encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' })} Health`;

const bram: Entity = {
  id: 'bram', name: 'Bram',
  stats: [stat('mood', 'Mood')],
  traits: [trait('brave', 'Brave')],
  // The link overrides Trust's value, which the resolved stat carries under the original id.
  statLinks: [{ id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null, overrides: { 'bp-trust': { value: { value: 9, blueprint: 4 } } } }],
  traitLinks: [{ id: 'l-cursed', originalId: 'cursed', kind: 'trait', originalName: 'Cursed', groupId: null }],
} as Entity;
const world: ScriptBoxWorld = {
  stats: [stat('health', BEAST_HEALTH), stat('bp-trust', 'Trust', { groupId: 'bp-bond' }), stat('bp-fear', 'Fear', { groupId: 'bp-bond' })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }, { id: 'bp-bond', name: 'Bond', parentId: 'bp' }],
  traits: [trait('lucky', 'Lucky'), trait('cursed', 'Cursed', { groupId: 'tbp' })],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [bram],
};
const homeOf = (ref: Parameters<typeof scriptHomeOf>[0]) => scriptHomeOf(ref, world, [beast]);

describe('scriptHomeOf', () => {
  it('reads a world stat under its code name', () => {
    expect(homeOf({ kind: 'stat', statId: 'health' })).toMatchObject({ kind: 'globalStat', stat: { id: 'health', name: 'Beast Health' } });
  });

  it('reads a Blueprint stat with its group’s stats', () => {
    const home = homeOf({ kind: 'stat', statId: 'bp-trust' });
    expect(home.kind).toBe('blueprintStat');
    expect(home.kind === 'blueprintStat' && home.groupStats.map((s) => s.id)).toEqual(['bp-trust', 'bp-fear']);
  });

  it('reads an entity’s own stat on that entity', () => {
    expect(homeOf({ kind: 'entity', entityId: 'bram', statId: 'mood' })).toMatchObject({ kind: 'entityStat', entityId: 'bram', stat: { id: 'mood', name: 'Mood' } });
  });

  it('reads a linked stat as resolved, under the original id', () => {
    expect(homeOf({ kind: 'link', entityId: 'bram', linkId: 'l-trust', statId: 'bp-trust' }))
      .toMatchObject({ kind: 'entityStat', entityId: 'bram', stat: { id: 'bp-trust', name: 'Trust', value: 9 } });
  });

  it('reads a world trait globally, a Blueprint trait on no entity, and an own or linked trait on its entity', () => {
    expect(homeOf({ kind: 'trait', traitId: 'lucky' })).toEqual({ kind: 'trait', trait: { id: 'lucky', name: 'Lucky' }, entityId: null });
    expect(homeOf({ kind: 'trait', traitId: 'cursed' })).toEqual({ kind: 'blueprintTrait', trait: { id: 'cursed', name: 'Cursed' } });
    expect(homeOf({ kind: 'entityTrait', entityId: 'bram', traitId: 'brave' })).toEqual({ kind: 'trait', trait: { id: 'brave', name: 'Brave' }, entityId: 'bram' });
    expect(homeOf({ kind: 'traitLink', entityId: 'bram', linkId: 'l-cursed', traitId: 'cursed' }))
      .toEqual({ kind: 'trait', trait: { id: 'cursed', name: 'Cursed' }, entityId: 'bram' });
  });

  it('reads a world script with no self', () => {
    expect(homeOf({ kind: 'world' })).toEqual({ kind: 'world' });
  });

  it('reads a home the world no longer holds as a bare stat under the home’s id (T04-5)', () => {
    expect(homeOf({ kind: 'entity', entityId: 'gone', statId: 'mood' })).toEqual({ kind: 'entityStat', entityId: 'gone', stat: { id: 'mood', name: '' } });
    expect(homeOf({ kind: 'stat', statId: 'gone' })).toEqual({ kind: 'globalStat', stat: { id: 'gone', name: '' } });
  });
});

describe('ownerStatsOf', () => {
  it('lists an entity’s stats with its links resolved, a Blueprint group’s, and none without an owner', () => {
    expect(ownerStatsOf({ kind: 'entity', entityId: 'bram' }, world, []).map((s) => s.id)).toEqual(['mood', 'bp-trust']);
    expect(ownerStatsOf({ kind: 'blueprintStat', stats: [world.stats[1]] }, world, [])).toEqual([world.stats[1]]);
    expect(ownerStatsOf({ kind: 'blueprintTrait' }, world, [])).toEqual([]);
    expect(ownerStatsOf({ kind: 'none' }, world, [])).toEqual([]);
  });

  it('resolves a library entity’s links only over the stats it is given', () => {
    const own = { kind: 'entity', entityId: 'bram' } as const;
    expect(ownerStatsOf(own, offWorldOf(bram, world), []).map((s) => s.id)).toEqual(['mood', 'bp-trust']);
    expect(ownerStatsOf(own, offWorldOf(bram), []).map((s) => s.id)).toEqual(['mood']);
  });

  it('binds a library entity’s link stored by name to the stat it names, as the library’s Stats tab does', () => {
    const stored = { ...bram, statLinks: [{ ...bram.statLinks![0], originalId: 'lib-trust' }] };
    expect(ownerStatsOf({ kind: 'entity', entityId: 'bram' }, offWorldOf(stored, world), []).map((s) => s.id)).toEqual(['mood', 'bp-trust']);
  });
});

describe('the panels’ homes', () => {
  it('name a world, own or linked stat, the link by its original id', () => {
    expect(statPanelHome('health')).toEqual({ kind: 'stat', statId: 'health' });
    expect(statPanelHome('mood', 'bram')).toEqual({ kind: 'entity', entityId: 'bram', statId: 'mood' });
    expect(statPanelHome('l-trust', 'bram', { linkId: 'l-trust', originalId: 'bp-trust' }))
      .toEqual({ kind: 'link', entityId: 'bram', linkId: 'l-trust', statId: 'bp-trust' });
  });

  it('name a world, own or linked trait, the link on its owner', () => {
    expect(traitPanelHome('lucky')).toEqual({ kind: 'trait', traitId: 'lucky' });
    expect(traitPanelHome('brave', 'bram')).toEqual({ kind: 'entityTrait', entityId: 'bram', traitId: 'brave' });
    expect(traitPanelHome('cursed', undefined, { ownerId: 'bram', linkId: 'l-cursed' }))
      .toEqual({ kind: 'traitLink', entityId: 'bram', linkId: 'l-cursed', traitId: 'cursed' });
  });
});
