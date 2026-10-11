/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { Entity, PlayerStat, Stat, StatGroup } from '@/types';
import { bindLibraryEntity } from './blueprintTravel';
import { entityStatOwners, seedEntityStats, statOwnerEntities, statRequestOwners } from './entityStats';
import { buildEntityCardData, parseEntityCardData } from './entityFile';

const stat = (id: string, over: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over,
});
const bp: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const noTraits = () => [];

// A character card made in one world, carrying an own stat and a link to that world's Trust Blueprint.
const authoring = { stats: [stat('trust', { name: 'Trust', groupId: 'bp', value: 5 })], statGroups: [bp] };
const author: Entity = {
  id: 'ash', name: 'Ash',
  stats: [stat('grit', { name: 'Grit', value: 4, regen: 2 })],
  statLinks: [{ id: 'l1', originalId: 'trust', kind: 'stat', originalName: 'Trust', groupId: null, overrides: { trust: { value: { value: 9, blueprint: 5 } } } }],
};
const card = parseEntityCardData(JSON.parse(JSON.stringify(
  buildEntityCardData(author, undefined, {}, undefined, { traits: [], traitGroups: [], entities: [author], ...authoring }),
)));

// The world the character joins names the same Blueprint with ids of its own.
const receiving = {
  traits: [], traitGroups: [], entities: [] as Entity[], placeholders: [], blueprints: [],
  stats: [stat('w-trust', { name: 'Trust', groupId: 'bp', value: 7 })], statGroups: [bp],
};

describe('a library character in play', () => {
  const ash = bindLibraryEntity({ ...card, id: 'copy' }, receiving);
  const values = seedEntityStats(statOwnerEntities({ world: [], library: [ash] }));

  it('plays with its own stat and the linked Blueprint stat, the link’s override over the Blueprint', () => {
    const byId = Object.fromEntries(values.copy.map((s: PlayerStat) => [s.id, s.value]));
    expect(byId).toEqual({ grit: 4, 'w-trust': 9 });
  });

  it('runs regen and code each turn with the world’s entities, present or not', () => {
    const owners = entityStatOwners(values, statOwnerEntities({ world: [], library: [ash] }), { source: 'none' }, noTraits);
    expect(owners.map((o) => o.id)).toEqual(['copy']);
  });

  it('joins the stat request when present, nested under its own heading', () => {
    const owners = statRequestOwners(
      [ash], values, { source: 'none' }, (stats) => stats, noTraits, (groups) => groups,
    );
    expect(owners.map((o) => [o.id, o.name, o.stats.map((s) => s.id)])).toEqual([['copy', 'Ash', ['grit', 'w-trust']]]);
  });
});
