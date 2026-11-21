import { describe, it, expect } from 'vitest';
import type { Entity, Opening, WorldOverview, WorldWeather } from '@/types';
import { runRules, type RuleWorld } from './rules';

const RULE = 'weather-not-allowed';
const action = (id: string, weather?: Opening['weather']): Opening => ({ id, text: `Opening ${id}.`, kind: 'action', ...(weather ? { weather } : {}) });
const resident: Entity = {
  id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor'],
};
const world = (weather: WorldWeather | undefined, extra: Partial<RuleWorld> = {}, overview: Partial<WorldOverview> = {}): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate.', readme: 'Primer.', ...(weather ? { weather } : {}), ...overview } as WorldOverview,
  stats: [], locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }], entities: [resident],
  traits: [], statUpdates: [], dictionaries: [], placeholders: [], ...extra,
});
const flags = (w: RuleWorld) => runRules(w).filter((f) => f.ruleId === RULE);

describe('the Weather Test Bench rule', () => {
  it('is quiet when every start weather is on the allowed list', () => {
    const w = world({ on: true, allowed: ['rain'], defaultWeather: 'rain' }, {}, { openings: [action('a', 'rain'), action('b', 'clear'), action('c')] });
    expect(flags(w)).toEqual([]);
  });

  it('flags a Default Weather left behind after the allowed list changes', () => {
    const found = flags(world({ on: true, allowed: ['rain'], defaultWeather: 'storm' }));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('Default Weather');
    expect(found[0].message).toContain('Storm');
  });

  it('flags an Opening Weather outside the list on the world, a location and an entity, naming each owner', () => {
    const w = world({ on: true, allowed: ['rain'] }, {
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [action('l', 'snow')] }],
      entities: [{ ...resident, openings: [action('e', 'storm')] }],
    }, { openings: [action('w', 'brightSun')] });
    const found = flags(w);
    expect(found).toHaveLength(3);
    expect(found.flatMap((f) => f.items.map((i) => i.name)).sort()).toEqual(['Harbor Steps', 'Odd Wick', 'Sedge Landing']);
  });

  it('is quiet while Weather is off, however stale the values', () => {
    expect(flags(world({ on: false, allowed: [], defaultWeather: 'storm' }, {}, { openings: [action('a', 'storm')] }))).toEqual([]);
  });
});
