import { describe, expect, it } from 'vitest';
import type { Entity } from '@/types';
import { computePresence, type PresenceInput } from './presence';
import { metRosterByLocation } from './metEntities';

const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });

const LOCATIONS = [{ id: 'market' }, { id: 'keep' }, { id: 'mound-a' }, { id: 'mound-b' }].map((l) => ({ ...l, parentId: null }));

/** The Met set of a state where the player stands at the market. */
const metSet = (input: Partial<PresenceInput>) => computePresence({
  entities: [], runtime: [], positions: {}, generics: {}, followers: [], locationId: 'market', locations: LOCATIONS, connections: [],
  persona: null, met: [], strangerAliases: {}, turns: [], ...input,
}).met;

describe('metRosterByLocation', () => {
  it('lists each met entity where it stands, wherever the player is', () => {
    const cast = [entity('bram', 'Bram', { locations: ['market'] }), entity('hesk', 'Old Hesk', { locations: ['market'] })];
    const roster = metRosterByLocation(metSet({ entities: cast, positions: { hesk: 'keep' } }));
    expect(roster).toEqual({ market: ['Bram'], keep: ['Old Hesk'] });
  });

  it('lists an unpositioned entity at each place it lists', () => {
    const lights = entity('lights', 'The Cold Lights', { locations: ['mound-a', 'mound-b'] });
    expect(metRosterByLocation(metSet({ entities: [lights] }))).toEqual({ 'mound-a': ['The Cold Lights'], 'mound-b': ['The Cold Lights'] });
  });

  it('leaves out a stranger, and shows it once the story names it', () => {
    const spy = entity('spy', 'Sylvie Thornwhistle', { strangerName: 'a hooded stranger', locations: ['market'] });
    expect(metRosterByLocation(metSet({ entities: [spy] }))).toEqual({});
    expect(metRosterByLocation(metSet({ entities: [spy], met: ['spy'] }))).toEqual({ market: ['Sylvie Thornwhistle'] });
  });

  it('places a runtime character where it was met', () => {
    const fishwife = entity('fish', 'Fishwife', { locations: ['market'] });
    expect(metRosterByLocation(metSet({ runtime: [fishwife] }))).toEqual({ market: ['Fishwife'] });
  });
});
