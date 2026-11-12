import { describe, it, expect } from 'vitest';
import type { OnMap } from '@/types';
import { DEFAULT_WORLDS, seedWorldData } from './defaultWorlds';
import { onMapOf } from './onMap';

/** Each bundled world's text, loaded on demand. */
const worldTexts = import.meta.glob<string>('/src/defaultworlds/*.json', { query: '?raw', import: 'default' });

const N: OnMap = 'whenNearby';
const V: OnMap = 'never';

/** The approved On Map values by bundled world, by entity name. Every entity not listed is Always. */
const APPROVED: Record<string, Record<string, OnMap>> = {
  drone: { 'Vault Warden': N, 'Glassback Burrower': N, 'Blight Drake': N, Blightspawn: N, 'Herald Skarn': N },
  emberwatch: { 'The Shade of Maelis': V, 'Cold Lights': N, 'Grave Hounds': N, 'Barrow Dead': N },
  'open-chat': {},
  rampage: { 'Captain Theo Ward': V, 'Aegis-One': N, 'Rooftop Missile Team': N, 'Combat Engineers': N },
  slime: {
    'The Ward Mimic': V,
    'The Signal Slime': N,
    'Amber Creeper': N,
    'The Fog Veil': V,
    'The Gutter Swarm': N,
    'The Loudspeakers': V,
  },
  sugarscape: {
    'Licorice Constrictor': V,
    Fluffbog: V,
    'Caramel Seep': V,
    'Toffee Slide': V,
    'Gingerbread Waypost': V,
    'The Daylight Seam': V,
    'Saltlick Stones': V,
    'Cream Cyclone': N,
    'Sprinkle Swarmers': N,
    'Stale Moths': N,
  },
  valentines: { 'The Swarm': N, 'Ren Takeda': N, 'Coach Daizen': N },
  veilwood: {
    'Mire Leeches': V,
    'Sporeburst Puffball': V,
    'Shadow Raptor': N,
    'Dread Crawler': N,
    'The Drowned Bell': V,
    "The Surveyor's Blazes": V,
    'Lantern Moths': V,
    'Bark Frogs': V,
  },
};

describe('bundled worlds On Map', () => {
  it('covers every bundled world', () => {
    expect(Object.keys(APPROVED).sort()).toEqual(DEFAULT_WORLDS.map((w) => w.id).sort());
  });

  it.each(DEFAULT_WORLDS.map((w) => [w.id, w] as const))('%s seeds with its approved On Map values', async (id, seed) => {
    const text = await worldTexts[`/src/defaultworlds/${id}.json`]();
    const raw = JSON.parse(text) as Record<string, unknown>;
    const world = seedWorldData(raw, seed);
    const expected = APPROVED[id];
    const actual: Record<string, OnMap> = {};
    for (const entity of world.entities ?? []) {
      const value = onMapOf(entity);
      if (value !== 'always') actual[entity.name] = value;
    }
    expect(actual).toEqual(expected);
  });
});
