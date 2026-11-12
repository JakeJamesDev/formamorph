import { describe, it, expect } from 'vitest';
import type { OnMap } from '@/types';
import { DEFAULT_WORLDS, seedWorldData } from './defaultWorlds';
import { onMapOf } from './onMap';

/** Each bundled world's text, loaded on demand. */
const worldTexts = import.meta.glob<string>('/src/defaultworlds/*.json', { query: '?raw', import: 'default' });

const NEARBY: OnMap = 'whenNearby';
const NEVER: OnMap = 'never';

/** The approved On Map values by bundled world, by entity name. Every entity not listed is Always. */
const APPROVED: Record<string, Record<string, OnMap>> = {
  drone: { 'Vault Warden': NEARBY, 'Glassback Burrower': NEARBY, 'Blight Drake': NEARBY, Blightspawn: NEARBY, 'Herald Skarn': NEARBY },
  emberwatch: { 'The Shade of Maelis': NEVER, 'Cold Lights': NEARBY, 'Grave Hounds': NEARBY, 'Barrow Dead': NEARBY },
  'open-chat': {},
  rampage: { 'Captain Theo Ward': NEVER, 'Aegis-One': NEARBY, 'Rooftop Missile Team': NEARBY, 'Combat Engineers': NEARBY },
  slime: {
    'The Ward Mimic': NEVER,
    'The Signal Slime': NEARBY,
    'Amber Creeper': NEARBY,
    'The Fog Veil': NEVER,
    'The Gutter Swarm': NEARBY,
    'The Loudspeakers': NEVER,
  },
  sugarscape: {
    'Licorice Constrictor': NEVER,
    Fluffbog: NEVER,
    'Caramel Seep': NEVER,
    'Toffee Slide': NEVER,
    'Gingerbread Waypost': NEVER,
    'The Daylight Seam': NEVER,
    'Saltlick Stones': NEVER,
    'Cream Cyclone': NEARBY,
    'Sprinkle Swarmers': NEARBY,
    'Stale Moths': NEARBY,
  },
  valentines: { 'The Swarm': NEARBY, 'Ren Takeda': NEARBY, 'Coach Daizen': NEARBY },
  veilwood: {
    'Mire Leeches': NEVER,
    'Sporeburst Puffball': NEVER,
    'Shadow Raptor': NEARBY,
    'Dread Crawler': NEARBY,
    'The Drowned Bell': NEVER,
    "The Surveyor's Blazes": NEVER,
    'Lantern Moths': NEVER,
    'Bark Frogs': NEVER,
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
