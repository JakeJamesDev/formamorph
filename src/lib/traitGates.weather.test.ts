import { rowClauses } from '@/test/ruleClauses';
import { describe, it, expect } from 'vitest';
import type { Entity, GalleryImage, ItemInstance, Trait, WeatherKind, WeatherRequirement, WorldWeather } from '@/types';
import {
  NO_ACTIVE, complementary, deadRows, flipped, gateStates, gateOf, neverUnlockable, requirementOptions, ruleStates, sameRequirement, type GateInput,
} from './traitGates';
import { shownWhileLine, gateLine } from './traitGateLine';
import { settleTraits, activeTraits, traitGateInput, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import { editorGateInput } from './owners';
import { visibleImages, visibleItemImage, visibleLocationImages } from './imageVisibility';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { experiencedWeather, ALL_WEATHER_KINDS, weatherGate } from './weather';
import { conditionsOf } from './requirementRows';
import { scoped } from './scope';

const weather = (...kinds: WeatherKind[]): WeatherRequirement => ({ kind: 'weather', kinds });
/** Every kind but `kinds`. */
const others = (...kinds: WeatherKind[]) => ALL_WEATHER_KINDS.filter((k) => !kinds.includes(k));
const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });

const input = (traits: Trait[], at?: WeatherKind): GateInput => ({
  global: { traits, groups: [] },
  owners: [],
  active: NO_ACTIVE,
  entities: [],
  persona: { source: 'none' },
  ...(at ? { weather: at } : {}),
});
const unlocked = (req: WeatherRequirement, at?: WeatherKind) =>
  gateOf(gateStates(input([T('a', { requires: [{ all: [req] }] })], at)), null, 'a')!.unlocked;

describe('a weather Condition', () => {
  it.each(ALL_WEATHER_KINDS)('holds while the World Weather is %s, and for no other kind', (kind) => {
    for (const at of ALL_WEATHER_KINDS) expect(unlocked(weather(kind), at)).toBe(at === kind);
  });

  it('holds on any kind of its set, Clear included', () => {
    expect(unlocked(weather('clear', 'rain'), 'clear')).toBe(true);
    expect(unlocked(weather('clear', 'rain'), 'rain')).toBe(true);
    expect(unlocked(weather('clear', 'rain'), 'storm')).toBe(false);
  });

  it('reads Clear when the input carries no weather', () => {
    expect(unlocked(weather('clear'))).toBe(true);
    expect(unlocked(weather('rain'))).toBe(false);
  });

  it('reads the World Weather, so a Sheltered player still holds it', () => {
    // The player feels no weather in a Sheltered place; the Condition reads the World Weather.
    expect(experiencedWeather('rain', { sheltered: true })).toBeNull();
    expect(unlocked(weather('rain'), 'rain')).toBe(true);
  });

  it('never holds with no kind, and reads as unresolved', () => {
    const states = ruleStates(input([], 'rain'), null, [{ all: [weather()] }]);
    expect(states[0].holds).toBe(false);
    expect(states[0].conditions[0]).toMatchObject({ unresolved: true });
  });

  it('reads its kinds in words, in list order', () => {
    const line = (...kinds: WeatherKind[]) => shownWhileLine(rowClauses(ruleStates(input([]), null, [{ all: [weather(...kinds)] }])));
    expect(line('storm', 'rain')).toBe('Shown while the weather is Rain or Storm.');
    expect(line('brightSun')).toBe('Shown while the weather is Bright Sun.');
  });

  it('compares by its set, whatever the stored order', () => {
    expect(sameRequirement(weather('storm', 'rain'), weather('rain', 'storm'))).toBe(true);
    expect(sameRequirement(weather('rain'), weather('rain', 'snow'))).toBe(false);
    expect(sameRequirement(weather('rain'), { kind: 'time', dayparts: ['night'] })).toBe(false);
    expect(complementary(weather('clear', 'rain'), weather(...others('clear', 'rain')))).toBe(true);
    expect(complementary(weather('clear', 'rain'), weather('snow', 'storm', 'brightSun'))).toBe(false);
    expect(flipped(weather('rain'))).toEqual({ ...weather('rain'), not: true });
    expect(flipped(flipped(weather('rain')))).toEqual(weather('rain'));
  });

  it('kills a row whose two weather Conditions share no kind', () => {
    const traits = [T('a', { requires: [{ all: [weather('rain'), weather('snow')] }] }), T('b', { requires: [{ all: [weather('rain'), weather('rain', 'snow')] }] })];
    expect(deadRows(input(traits))).toEqual([{ ownerId: null, traitId: 'a', row: 0 }]);
  });

  it('counts as reachable for the never-unlockable check, since a script or the pass can set any kind', () => {
    expect(neverUnlockable(input([T('a', { requires: [{ all: [weather('storm')] }] })]))).toEqual([]);
  });
});

describe('a negated weather Condition', () => {
  const not = (...kinds: WeatherKind[]): WeatherRequirement => ({ ...weather(...kinds), not: true });

  it('holds under every kind outside its set, Clear included', () => {
    for (const at of ALL_WEATHER_KINDS) expect(unlocked(not('rain'), at)).toBe(at !== 'rain');
    expect(unlocked(not('rain', 'storm'), 'snow')).toBe(true);
    expect(unlocked(not('rain', 'storm'), 'storm')).toBe(false);
  });

  it('never holds with no kind, Not or not, and reads as unresolved', () => {
    const states = ruleStates(input([], 'rain'), null, [{ all: [not()] }]);
    expect(states[0].holds).toBe(false);
    expect(states[0].conditions[0]).toMatchObject({ unresolved: true });
  });

  it('reads the negated form in the Shown while and gate lines', () => {
    const line = (...kinds: WeatherKind[]) => shownWhileLine(rowClauses(ruleStates(input([]), null, [{ all: [not(...kinds)] }])));
    expect(line('rain', 'storm')).toBe('Shown while the weather is not Rain or Storm.');
    const gate = gateStates(input([T('a', { requires: [{ all: [not('rain')] }] })], 'rain'));
    expect(gateLine(gateOf(gate, null, 'a'))).toBe('Requires: the weather is not Rain.');
  });

  it('equals the other kinds listed plainly, and complements its plain form over every kind', () => {
    expect(sameRequirement(not('rain'), weather(...others('rain')))).toBe(true);
    expect(sameRequirement(not('rain'), weather('rain'))).toBe(false);
    expect(complementary(weather('rain'), not('rain'))).toBe(true);
    expect(complementary(weather('clear', 'rain'), weather(...others('clear', 'rain')))).toBe(true);
    expect(complementary(weather('rain'), weather('snow'))).toBe(false);
  });

  it('kills a row holding Rain and not Rain, and one holding not every kind', () => {
    const traits = [
      T('a', { requires: [{ all: [weather('rain'), not('rain')] }] }),
      T('b', { requires: [{ all: [weather('rain'), not('snow')] }] }),
      T('c', { requires: [{ all: [not(...ALL_WEATHER_KINDS)] }] }),
    ];
    expect(deadRows(input(traits))).toEqual([{ ownerId: null, traitId: 'a', row: 0 }, { ownerId: null, traitId: 'c', row: 0 }]);
  });

  it('is never unlockable only when it leaves no kind', () => {
    expect(neverUnlockable(input([T('a', { requires: [{ all: [not('rain')] }] })]))).toEqual([]);
    expect(neverUnlockable(input([T('a', { requires: [{ all: [not(...ALL_WEATHER_KINDS)] }] })]))).toHaveLength(1);
  });

  it('settles a gated trait off in the rain and back on in the clear', () => {
    const awning = T('awning', { playerToggle: true, requires: [{ all: [not('rain')] }] });
    const chosen: TraitRuntimeState = { stats: [], traits: [awning], disabledTraitIds: [], appliedValues: {} };
    const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);
    const rain = settleTraits(chosen, { traits: [awning], groups: [], weather: 'rain' }).state;
    expect(on(rain)).toEqual([]);
    expect(on(settleTraits(rain, { traits: [awning], groups: [], weather: 'clear' }).state)).toEqual(['awning']);
  });

  it('shows a Not-ruled image while it is not raining', () => {
    const hill = { id: 'hill', images: [{ data: 'dry', requires: [{ all: [not('rain')] }] }, { data: 'wet' }] as GalleryImage[] };
    const slots = (at: WeatherKind) => visibleLocationImages(hill, { ...input([], at), stats: scoped({}) }, undefined).map((v) => v.data);
    expect(slots('clear')).toEqual(['dry', 'wet']);
    expect(slots('rain')).toEqual(['wet']);
  });

  it('round-trips its Not flag on a character card', () => {
    const PIXELS = 'data:image/webp;base64,AAAA';
    const requires = [{ all: [not('rain')] }];
    const wren: Entity = { id: 'wren', name: 'Wren', traits: [T('t', { name: 'T', requires })], images: [{ data: PIXELS, requires }] };
    const back = parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(wren, [], {}, undefined, { traits: [], traitGroups: [], entities: [] }))), PIXELS);
    expect(conditionsOf(back.traits?.[0].requires)).toEqual([not('rain')]);
    expect(conditionsOf(back.images?.[0].requires)).toEqual([not('rain')]);
  });
});

describe('a weather Condition outside play', () => {
  const on = (over: Partial<WorldWeather> = {}): WorldWeather => ({ allowed: ['clear', 'rain', 'snow'], ...over });
  const editor = (w?: WorldWeather) => editorGateInput({ traits: [T('a', { requires: [{ all: [weather('snow')] }] })], traitGroups: [], entities: [], weather: w });
  const holds = (w?: WorldWeather) => gateOf(gateStates(editor(w)), null, 'a')!.unlocked;

  it('reads the Default Weather', () => {
    expect(holds(on({ defaultWeather: 'snow' }))).toBe(true);
    expect(holds(on({ defaultWeather: 'rain' }))).toBe(false);
  });

  it('reads Clear when the Default Weather is unset, and a one-kind world reads its kind', () => {
    expect(holds(on())).toBe(false);
    expect(weatherGate(undefined)).toEqual({ weather: 'clear' });
    expect(weatherGate({ allowed: ['rain'], defaultWeather: 'snow' })).toEqual({ weather: 'rain' });
    expect(gateOf(gateStates(editorGateInput({ traits: [T('a', { requires: [{ all: [weather('clear')] }] })], traitGroups: [], entities: [] })), null, 'a')!.unlocked).toBe(true);
  });

  it('is offered, with the allowed kinds, only while the weather can change', () => {
    const offered = requirementOptions(editor(on()));
    expect(offered.weatherKinds).toEqual(['clear', 'rain', 'snow']);
    expect(offered.weather?.[0].requirement).toEqual(weather());
    expect(requirementOptions(editor()).weather).toBeUndefined();
    expect(requirementOptions(editor({ allowed: ['rain'] })).weather).toBeUndefined();
  });
});

describe('the per-turn settle with a weather gate', () => {
  const awning = T('awning', { playerToggle: true, requires: [{ all: [weather('rain', 'storm')] }] });
  const world = (at: WeatherKind): TraitWorld => ({ traits: [awning], groups: [], weather: at });
  const chosen: TraitRuntimeState = { stats: [], traits: [awning], disabledTraitIds: [], appliedValues: {} };
  const on = (s: TraitRuntimeState) => activeTraits(s.traits, s.disabledTraitIds).map((t) => t.id);

  it('turns the trait off in the clear and back on at the commit that reads rain', () => {
    const clear = settleTraits(chosen, world('clear')).state;
    expect(on(clear)).toEqual([]);
    const rain = settleTraits(clear, world('rain'));
    expect(on(rain.state)).toEqual(['awning']);
    expect(rain.log).toEqual(['Trait switched on: awning']);
  });

  it('reads Clear when the world carries no weather', () => {
    expect(gateOf(gateStates(traitGateInput(chosen, { traits: [awning], groups: [] })), null, 'awning')!.unlocked).toBe(false);
    expect(gateOf(gateStates(traitGateInput(chosen, world('storm'))), null, 'awning')!.unlocked).toBe(true);
  });
});

describe('an image ruled on Rain', () => {
  const rule = [{ all: [weather('rain')] }];
  const ash = { id: 'ash', images: [{ data: 'rain', requires: rule }, { data: 'dry' }] as GalleryImage[] };
  const hill = { id: 'hill', images: [{ data: 'rain', requires: rule }, { data: 'dry' }] as GalleryImage[] };
  const gate = (at?: WeatherKind): GateInput => ({ ...input([], at), entities: [{ id: 'ash', name: 'Ash' }], stats: scoped({}) });

  it('shows on a location only while it rains', () => {
    const slots = (at?: WeatherKind) => visibleLocationImages(hill, gate(at), undefined).map((v) => v.data);
    expect(slots('rain')).toEqual(['rain', 'dry']);
    expect(slots('clear')).toEqual(['dry']);
    expect(slots('snow')).toEqual(['dry']);
    expect(slots()).toEqual(['dry']);
  });

  it('shows on an entity only while it rains', () => {
    const slots = (at: WeatherKind) => visibleImages(ash, gate(at), undefined).map((v) => v.data);
    expect(slots('rain')).toEqual(['rain', 'dry']);
    expect(slots('storm')).toEqual(['dry']);
  });
});

describe('an item image ruled on Rain', () => {
  const lantern = { images: [{ data: 'rain', requires: [{ all: [weather('rain')] }] }, { data: 'dry' }] as GalleryImage[] };
  const shown = (where: ItemInstance['where'], at: WeatherKind) => visibleItemImage(lantern, { where }, input([], at), undefined);

  it('reads the World Weather for a held item and for one lying at a location', () => {
    // An owner-less Condition never holds for an item at a location; a weather Condition names no owner.
    expect(shown({ kind: 'you' }, 'rain')).toBe('rain');
    expect(shown({ kind: 'location', id: 'hill' } as ItemInstance['where'], 'rain')).toBe('rain');
    expect(shown({ kind: 'location', id: 'hill' } as ItemInstance['where'], 'clear')).toBe('dry');
  });
});

describe('a weather Condition on a character card', () => {
  const PIXELS = 'data:image/webp;base64,AAAA';
  const wren = (requires = [{ all: [weather('storm', 'rain')] }]): Entity => ({
    id: 'wren', name: 'Wren',
    traits: [T('t-sleepy', { name: 'Sleepy', requires })],
    images: [{ data: PIXELS, requires }],
  });
  const throughCard = (entity: Entity): Entity =>
    parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, { traits: [], traitGroups: [], entities: [] }))), PIXELS);

  it('round-trips on a trait gate and an image rule, in list order', () => {
    const back = throughCard(wren());
    expect(conditionsOf(back.traits?.[0].requires)).toEqual([weather('rain', 'storm')]);
    expect(conditionsOf(back.images?.[0].requires)).toEqual([weather('rain', 'storm')]);
  });

  it('keeps known kinds and drops a Condition left with none', () => {
    const odd = { kind: 'weather', kinds: ['snow', 'sleet', 'snow'] } as unknown as WeatherRequirement;
    expect(conditionsOf(throughCard(wren([{ all: [odd] }])).traits?.[0].requires)).toEqual([weather('snow')]);
    const none = { kind: 'weather', kinds: ['sleet'] } as unknown as WeatherRequirement;
    expect(throughCard(wren([{ all: [none] }])).traits?.[0].requires).toBeUndefined();
  });
});
