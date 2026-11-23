import { describe, it, expect } from 'vitest';
import type { Entity, Opening, WeatherKind, WorldOverview, WorldWeather } from '@/types';
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
    const w = world({ allowed: ['clear', 'rain'], defaultWeather: 'rain' }, {}, { openings: [action('a', 'rain'), action('b', 'clear'), action('c')] });
    expect(flags(w)).toEqual([]);
  });

  it('flags a Default Weather left behind after the allowed list changes', () => {
    const found = flags(world({ allowed: ['clear', 'rain'], defaultWeather: 'storm' }));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('Default Weather');
    expect(found[0].message).toContain('Storm');
  });

  it('flags an Opening Weather outside the list on the world, a location and an entity, naming each owner', () => {
    const w = world({ allowed: ['clear', 'rain'] }, {
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [action('l', 'snow')] }],
      entities: [{ ...resident, openings: [action('e', 'storm')] }],
    }, { openings: [action('w', 'brightSun')] });
    const found = flags(w);
    expect(found).toHaveLength(3);
    expect(found.flatMap((f) => f.items.map((i) => i.name)).sort()).toEqual(['Harbor Steps', 'Odd Wick', 'Sedge Landing']);
  });

  it('is quiet in a one-kind world, which starts in its kind whatever the rows pick', () => {
    expect(flags(world({ allowed: [], defaultWeather: 'storm' }, {}, { openings: [action('a', 'storm')] }))).toEqual([]);
    expect(flags(world({ allowed: ['rain'], defaultWeather: 'storm' }, {}, { openings: [action('a', 'snow')] }))).toEqual([]);
  });
});

describe('the weather Condition Test Bench rule', () => {
  const COND = 'weather-condition-not-allowed';
  const flagged = (w: RuleWorld) => runRules(w).filter((f) => f.ruleId === COND);
  const rule = (...kinds: WeatherKind[]) => [{ all: [{ kind: 'weather' as const, kinds }] }];
  const withTrait = (requires: ReturnType<typeof rule>, weather: WorldWeather = { allowed: ['clear', 'rain'] }) =>
    world(weather, { traits: [{ id: 'awning', name: 'Awning', statChanges: [], requires }] });

  it('is quiet while every kind is Clear or allowed', () => {
    expect(flagged(withTrait(rule('clear', 'rain')))).toEqual([]);
  });

  it('flags a trait gate that names a kind outside the list, naming the kind and the trait', () => {
    const found = flagged(withTrait(rule('rain', 'storm')));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('Awning');
    expect(found[0].message).toContain('Storm');
    expect(found[0].message).not.toContain('Rain');
  });

  it('flags a location image rule, wherever the rule sits', () => {
    const w = world({ allowed: ['clear', 'rain'] }, {
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, images: [{ data: 'x', requires: rule('snow') }] }],
    });
    expect(flagged(w).flatMap((f) => f.items.map((i) => i.name))).toEqual(['Harbor Steps']);
  });

  it('flags a kind a Clear-only world does not allow', () => {
    expect(flagged(withTrait(rule('storm'), { allowed: [] }))).toHaveLength(1);
  });
});
