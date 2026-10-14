import { describe, it, expect } from 'vitest';
import { statBoxLookups, type CodeCardWorld } from './codeWorldLookup';
import { allPlaceholders, placeholderOwners } from './placeholderHomes';
import { cardWorldNames, statBoxAnalysisOptions } from './statCodeBoxOptions';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeNames, type StatCodeWorld } from './statCodeTestRun';
import type { Stat, Trait } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, groupId?: string): Trait => ({ id, name, statChanges: [], ...(groupId ? { groupId } : {}) });

const health = stat('health', 'Health');
const rage = stat('rage', 'Rage', { groupId: 'bp' });
const world: StatCodeWorld = {
  stats: [health, rage],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  // The Traits tab lists Brave's group before the loose Calm, against the authored order.
  traits: [trait('calm', 'Calm'), trait('brave', 'Brave', 'virtues')],
  traitGroups: [{ id: 'virtues', name: 'Virtues', parentId: null }],
  entities: [{ id: 'mara', name: 'Mara', statLinks: [{ id: 'mara-rage', originalId: 'rage', kind: 'stat', originalName: 'Rage', groupId: null }] }],
  entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
};
/** The world as the stat editor hands it to its boxes. */
const cardWorld: CodeCardWorld = { ...world, traitGroups: world.traitGroups ?? [], placeholders: allPlaceholders(world), placeholderOwners: placeholderOwners(world) };

describe('a stat code box’s names', () => {
  it('reads the same names from a card world as Test Code reads from the world', () => {
    expect(cardWorldNames(cardWorld)).toEqual(statCodeNames(world));
  });

  it('reads an entity’s linked stats and the world’s play stats, as play does', () => {
    const names = cardWorldNames(cardWorld);
    expect(names.statNames).toEqual(['Health']);
    expect(names.entities.find((entity) => entity.id === 'mara')?.stats).toEqual(['Rage']);
    expect(names.traitNames).toEqual(['Brave', 'Calm']);
  });
});

describe('a stat code box’s analysis options', () => {
  const names = cardWorldNames(cardWorld);

  it('reads a world stat’s box with an empty `owner`', () => {
    const options = statBoxAnalysisOptions(names, { selfName: 'Health' });
    expect(options).toMatchObject({ surface: STAT_CODE_SURFACE, statNames: ['Health'], traits: ['Brave', 'Calm'], selfName: 'Health', ownerStatNames: [] });
    expect(options).not.toHaveProperty('owner');
  });

  it('reads an owned box with its owner’s stats and the box’s lookup', () => {
    const lookup = statBoxLookups(cardWorld)({ owner: { kind: 'entity', entityId: 'mara' }, timing: 'after', self: rage });
    const options = statBoxAnalysisOptions(names, { selfName: 'Rage', owner: { kind: 'entity', statNames: ['Rage'] }, lookup });
    expect(options).toMatchObject({ owner: 'entity', ownerStatNames: ['Rage'], lookup });
    expect(lookup.self().owners).toEqual(['Mara']);
  });
});
