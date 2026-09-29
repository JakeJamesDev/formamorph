import { describe, it, expect, vi } from 'vitest';
import type { Entity, GameLocation, PersonaRef, Placeholder, PlaceholderPin, Trait, TraitLink } from '@/types';
import { phValueId, phValues } from '@/test/placeholderValues';
import { readerFor } from './blueprints';
import { decodePlaceholderToken } from './placeholders';
import {
  activePlaceholderPins, addPinAt, allPinTexts, bindBlueprintPins, canCommitPinSource, collectPinLayers, collectPins, commitPinSource, pinConflict,
  pinKindsFor, pinSourceKey, pinSourcesOfKind, pinsTargeting, pinTarget, pinTargetFilter, removePinAt, sameSource, updatePinAt,
  valuePinRollChips, withPinnedValue, type PinnableStat,
} from './placeholderPins';

const P = (id: string, values: string[]): Placeholder => ({ id, name: id, values: phValues(values) });
const pin = (placeholderId: string, value: string, valueId?: string): PlaceholderPin =>
  ({ placeholderId, value, ...(valueId ? { valueId } : {}) });
const trait = (id: string, pins: PlaceholderPin[], extra: Partial<Trait> = {}): Trait =>
  ({ id, name: id, statChanges: [], placeholderPins: pins, ...extra });
const location = (id: string, pins: PlaceholderPin[]): GameLocation => ({ id, name: id, placeholderPins: pins });
/** A stat at `value`, banded by `threshold` with the pins each band lays. */
const stat = (
  id: string, value: number, bands: Array<{ threshold: number; pins: PlaceholderPin[] }>, extra: Partial<PinnableStat> = {},
): PinnableStat => ({
  id, value, min: 0, max: 100,
  descriptors: bands.map((b, i) => ({ id: `${id}-b${i}`, threshold: b.threshold, description: `band ${i}`, placeholderPins: b.pins })),
  ...extra,
});
/** A placeholder whose values each pin something: `[text, pins]` per value. */
const pinner = (id: string, values: Array<[string, PlaceholderPin[]]>): Placeholder => ({
  id, name: id, values: values.map(([text, pins]) => ({ id: `v:${text}`, text, ...(pins.length ? { pins } : {}) })),
});

describe('collectPins — precedence across the four sources', () => {
  const town = P('town', ['Sedge', 'Marrow', 'Fen', 'Ash', 'Moor']);
  const region = pinner('region', [['Northern', [pin('town', 'Moor')]]]);
  const placeholders = [town, region];
  const rolls = { world: { region: 'Northern' }, unique: {} };
  const sworn = trait('sworn', [pin('town', 'Marrow')]);
  const fen = location('fen', [pin('town', 'Fen')]);
  const hunger = (value: number) => stat('hunger', value, [{ threshold: 30, pins: [pin('town', 'Ash')] }]);

  it('lets a descriptor pin win over location, trait and value pins', () => {
    expect(collectPins({ traits: [sworn], location: fen, stats: [hunger(20)], placeholders, rolls }))
      .toEqual({ town: 'Ash' });
  });

  it('lets a location pin win over trait and value pins once the stat leaves its band', () => {
    expect(collectPins({ traits: [sworn], location: fen, stats: [hunger(80)], placeholders, rolls }))
      .toEqual({ town: 'Fen' });
  });

  it('lets a trait pin win over a value pin with no location', () => {
    expect(collectPins({ traits: [sworn], location: null, stats: [hunger(80)], placeholders, rolls }))
      .toEqual({ town: 'Marrow' });
  });

  it('falls through to the value pin when nothing above it claims the placeholder', () => {
    expect(collectPins({ traits: [], location: null, stats: [], placeholders, rolls })).toEqual({ town: 'Moor' });
  });

  it('keeps the later trait winning among traits', () => {
    const native = trait('native', [pin('town', 'Sedge')]);
    expect(collectPins({ traits: [native, sworn], placeholders })).toEqual({ town: 'Marrow' });
    expect(collectPins({ traits: [sworn, native], placeholders })).toEqual({ town: 'Sedge' });
  });

  it('drops a disabled trait’s pins', () => {
    expect(collectPins({ traits: [sworn], disabledTraitIds: ['sworn'], placeholders: [town] })).toEqual({});
    expect(collectPins({ traits: [sworn], disabledTraitIds: [], placeholders: [town] })).toEqual({ town: 'Marrow' });
  });
});

describe('collectPins — Code Pins', () => {
  const town = P('town', ['Sedge', 'Marrow', 'Fen', 'Ash', 'Moor']);
  const region = pinner('region', [['Northern', [pin('town', 'Moor')]], ['Southern', [pin('town', 'Sedge')]]]);
  const placeholders = [town, region];
  const hunger = stat('hunger', 20, [{ threshold: 30, pins: [pin('town', 'Ash')] }]);
  const all = { traits: [trait('sworn', [pin('town', 'Marrow')])], location: location('fen', [pin('town', 'Fen')]), stats: [hunger] };

  it('outranks every other source, a stat band pin included', () => {
    const rolls = { world: { region: 'Northern' }, unique: {} };
    expect(collectPins({ ...all, placeholders, rolls, codePins: { town: 'Anywhere' } })).toEqual({ town: 'Anywhere' });
  });

  it('masks the Roll, which returns once the Code Pin is gone', () => {
    const rolls = { world: { town: 'Moor' }, unique: {} };
    expect(collectPins({ traits: [], placeholders: [town], rolls, codePins: { town: 'Fen' } })).toEqual({ town: 'Fen' });
    expect(rolls.world).toEqual({ town: 'Moor' });
    expect(collectPins({ traits: [], placeholders: [town], rolls, codePins: {} })).toEqual({});
  });

  it('decides which value pin fires, like any pin on the source', () => {
    const rolls = { world: { region: 'Northern' }, unique: {} };
    expect(collectPins({ traits: [], placeholders, rolls, codePins: { region: 'Southern' } }))
      .toEqual({ region: 'Southern', town: 'Sedge' });
  });

  it('leaves the band pin it masks marked as not in force, even at the same text', () => {
    const { layers } = collectPinLayers({ traits: [], stats: [hunger], placeholders: [town], codePins: { town: 'Ash' } });
    expect(layers.map((l) => [l.source.kind, l.wins])).toEqual([['descriptor', false]]);
  });

  // An Object's Code Pin is stored as a list. Every reader that needs one string joins it the way the
  // prompt joins an Object's values, so a list pin ranks and reads exactly as a text one does.
  it('joins a list Code Pin with ", " where a collection needs text', () => {
    expect(collectPins({ traits: [], placeholders: [town], codePins: { town: ['Fen', 'Moor'] } }))
      .toEqual({ town: 'Fen, Moor' });
  });

  it('joins a one-item list to that item alone', () => {
    expect(collectPins({ traits: [], placeholders: [town], codePins: { town: ['Fen'] } })).toEqual({ town: 'Fen' });
  });

  it('outranks every other source with a list pin, as a text pin does', () => {
    expect(collectPins({ ...all, placeholders, codePins: { town: ['Ash', 'Moor'] } })).toEqual({ town: 'Ash, Moor' });
  });

  it('fires the value pins of the joined text a list Code Pin lands on', () => {
    const rolls = { world: { region: 'Northern' }, unique: {} };
    expect(collectPins({ traits: [], placeholders, rolls, codePins: { region: ['Southern'] } }))
      .toEqual({ region: 'Southern', town: 'Sedge' });
  });
});

describe('collectPinLayers — every pin laid, and the one in force marked', () => {
  const town = P('town', ['Sedge', 'Marrow', 'Fen', 'Ash', 'Moor']);
  const region = pinner('region', [['Northern', [pin('town', 'Moor')]]]);
  const placeholders = [town, region];
  const rolls = { world: { region: 'Northern' }, unique: {} };
  const sworn = trait('sworn', [pin('town', 'Marrow')]);
  const fen = location('fen', [pin('town', 'Fen')]);
  const hunger = stat('hunger', 20, [{ threshold: 30, pins: [pin('town', 'Ash')] }]);

  it('lays every source in play’s order and marks only the descriptor’s pin as in force', () => {
    const { pins, layers } = collectPinLayers({ traits: [sworn], location: fen, stats: [hunger], placeholders, rolls });
    expect(pins).toEqual({ town: 'Ash' });
    expect(layers.map((l) => [l.source, l.value, l.wins])).toEqual([
      [{ kind: 'trait', id: 'sworn' }, 'Marrow', false],
      [{ kind: 'location', id: 'fen' }, 'Fen', false],
      [{ kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' }, 'Ash', true],
      [{ kind: 'value', placeholderId: 'region', valueId: 'v:Northern' }, 'Moor', false],
    ]);
  });

  it('hands the win to the value pin once nothing above it claims the placeholder', () => {
    const { layers } = collectPinLayers({ traits: [], placeholders, rolls });
    expect(layers).toEqual([{
      source: { kind: 'value', placeholderId: 'region', valueId: 'v:Northern' },
      pin: region.values[0].pins![0], placeholderId: 'town', value: 'Moor', wins: true,
    }]);
  });

  it('marks the later of two traits, matching what collectPins returns', () => {
    const native = trait('native', [pin('town', 'Sedge')]);
    const { pins, layers } = collectPinLayers({ traits: [native, sworn], placeholders: [town] });
    expect(pins).toEqual(collectPins({ traits: [native, sworn], placeholders: [town] }));
    expect(layers.map((l) => [l.source.kind === 'trait' && l.source.id, l.wins])).toEqual([['native', false], ['sworn', true]]);
  });

  it('carries the pin as stored, so a broken pin is a layer too', () => {
    const broken = pin('gone', 'red');
    const { layers } = collectPinLayers({ traits: [trait('t', [broken])], placeholders: [town] });
    expect(layers).toEqual([{ source: { kind: 'trait', id: 't' }, pin: broken, placeholderId: 'gone', value: 'red', wins: true }]);
  });
});

describe('collectPins — what each source contributes', () => {
  const town = P('town', ['Sedge', 'Marrow']);

  it('reads only the band the stat value falls in', () => {
    const at = (value: number) => collectPins({
      traits: [],
      stats: [stat('hunger', value, [
        { threshold: 30, pins: [pin('town', 'Marrow')] },
        { threshold: 60, pins: [pin('town', 'Sedge')] },
      ])],
      placeholders: [town],
    });
    expect(at(20)).toEqual({ town: 'Marrow' });
    expect(at(50)).toEqual({ town: 'Sedge' });
    expect(at(90)).toEqual({});
  });

  it('gives a disabled stat nothing to say, whether the author or a trait switched it off', () => {
    const hunger = stat('hunger', 20, [{ threshold: 30, pins: [pin('town', 'Marrow')] }]);
    const authoredOff = { ...hunger, enabled: false };
    expect(collectPins({ traits: [], stats: [authoredOff], placeholders: [town] })).toEqual({});
    const mute = trait('mute', [], { statToggles: [{ statId: 'hunger', enabled: false }] });
    expect(collectPins({ traits: [mute], stats: [hunger], placeholders: [town] })).toEqual({});
    expect(collectPins({ traits: [], stats: [hunger], placeholders: [town] })).toEqual({ town: 'Marrow' });
  });

  it('skips an empty pin from any source', () => {
    const blankTrait = trait('t', [pin('town', ''), pin('', 'Marrow')]);
    const blankLocation = location('l', [pin('town', '')]);
    const blankStat = stat('s', 10, [{ threshold: 50, pins: [pin('town', '')] }]);
    const blankValue = pinner('region', [['Northern', [pin('town', '')]]]);
    expect(collectPins({
      traits: [blankTrait], location: blankLocation, stats: [blankStat],
      placeholders: [town, blankValue], rolls: { world: { region: 'Northern' }, unique: {} },
    })).toEqual({});
  });

  it('reads a pin naming its value by id at that value’s current text, from every source', () => {
    const renamed = P('town', ['Sedge', 'Crimson Marrow']);
    const byId = pin('town', 'Marrow', 'v:Crimson Marrow');
    const region = pinner('region', [['Northern', [byId]]]);
    const rolls = { world: { region: 'Northern' }, unique: {} };
    expect(collectPins({ traits: [trait('t', [byId])], placeholders: [renamed] })).toEqual({ town: 'Crimson Marrow' });
    expect(collectPins({ traits: [], location: location('l', [byId]), placeholders: [renamed] })).toEqual({ town: 'Crimson Marrow' });
    expect(collectPins({ traits: [], stats: [stat('s', 10, [{ threshold: 50, pins: [byId] }])], placeholders: [renamed] }))
      .toEqual({ town: 'Crimson Marrow' });
    expect(collectPins({ traits: [], placeholders: [renamed, region], rolls })).toEqual({ town: 'Crimson Marrow' });
  });

  it('applies every value’s pins for an Object, which holds all of them at once', () => {
    const kit = { ...pinner('kit', [['rope', [pin('town', 'Sedge')]], ['lamp', [pin('mood', 'Bright')]]]), roll: false };
    const mood = P('mood', ['Dim', 'Bright']);
    expect(collectPins({ traits: [], placeholders: [town, mood, kit] })).toEqual({ town: 'Sedge', mood: 'Bright' });
  });

  it('contributes nothing from a value-pinning Wildcard that has no roll yet', () => {
    const region = pinner('region', [['Northern', [pin('town', 'Sedge')]], ['Southern', []]]);
    expect(collectPins({ traits: [], placeholders: [town, region], rolls: { world: {}, unique: {} } })).toEqual({});
  });

  it('reads a Variable as its sole value, roll or no roll', () => {
    const region = pinner('region', [['Northern', [pin('town', 'Sedge')]]]);
    expect(collectPins({ traits: [], placeholders: [town, region] })).toEqual({ town: 'Sedge' });
  });
});

describe('collectPins — value pins to a fixed point', () => {
  it('reads the effective value, so a trait pin on the source decides which value pin fires', () => {
    const weather = P('weather', ['Sun', 'Snow']);
    const region = pinner('region', [
      ['Northern', [pin('weather', 'Sun')]],
      ['Southern', [pin('weather', 'Snow')]],
    ]);
    const rolls = { world: { region: 'Northern' }, unique: {} };
    const placeholders = [weather, region];
    expect(collectPins({ traits: [], placeholders, rolls })).toEqual({ weather: 'Sun' });
    expect(collectPins({ traits: [trait('t', [pin('region', 'Southern')])], placeholders, rolls }))
      .toEqual({ region: 'Southern', weather: 'Snow' });
  });

  it('follows a two-step chain through the value a pin selected, not the roll under it', () => {
    const a = pinner('a', [['a1', [pin('b', 'b2')]]]);
    const b = pinner('b', [['b1', [pin('c', 'c1')]], ['b2', [pin('c', 'c3')]]]);
    const c = P('c', ['c1', 'c2', 'c3']);
    const rolls = { world: { a: 'a1', b: 'b1' }, unique: {} };
    expect(collectPins({ traits: [], placeholders: [c, b, a], rolls })).toEqual({ b: 'b2', c: 'c3' });
  });

  it('never lets a value pin overrule a source above it, even downstream of a chain', () => {
    const a = pinner('a', [['a1', [pin('b', 'b2')]]]);
    const b = pinner('b', [['b2', [pin('c', 'c3')]]]);
    const c = P('c', ['c1', 'c3']);
    const rolls = { world: { a: 'a1', b: 'b1' }, unique: {} };
    expect(collectPins({ traits: [trait('t', [pin('c', 'c1')])], placeholders: [a, b, c], rolls }))
      .toEqual({ b: 'b2', c: 'c1' });
  });

  // Each rolled value pins the other away from its roll. Applying one and re-reading settles it: whichever
  // placeholder is listed first has its say, and the other, now pinned, pins nothing. Not a cycle.
  it('settles two values that exclude each other on the first-listed one, and reports no cycle', () => {
    const a = pinner('a', [['a1', [pin('b', 'b2')]], ['a2', []]]);
    const b = pinner('b', [['b1', [pin('a', 'a2')]], ['b2', []]]);
    const rolls = { world: { a: 'a1', b: 'b1' }, unique: {} };
    const onFinding = vi.fn();
    expect(collectPins({ traits: [], placeholders: [a, b], rolls, onFinding })).toEqual({ b: 'b2' });
    expect(collectPins({ traits: [], placeholders: [b, a], rolls, onFinding })).toEqual({ a: 'a2' });
    expect(onFinding).not.toHaveBeenCalled();
  });

  it('stops a cycle at the first repeated state and reports it once', () => {
    // a1 → b2 → a2 → b1 → a1: every step flips the other, so no state holds.
    const a = pinner('a', [['a1', [pin('b', 'b2')]], ['a2', [pin('b', 'b1')]]]);
    const b = pinner('b', [['b1', [pin('a', 'a1')]], ['b2', [pin('a', 'a2')]]]);
    const rolls = { world: { a: 'a1', b: 'b1' }, unique: {} };
    const onFinding = vi.fn();
    const out = collectPins({ traits: [], placeholders: [a, b], rolls, onFinding });
    expect(onFinding).toHaveBeenCalledTimes(1);
    // The loop as the Bench reports it: the two states the walk flips between, each as what a and b read as.
    expect(onFinding.mock.calls[0][0]).toEqual({
      kind: 'value-pin-cycle', placeholderIds: ['a', 'b'], loop: [{ a: 'a2', b: 'b2' }, { a: 'a1', b: 'b1' }],
    });
    // Stopped on the state the walk stood on when it saw the repeat — the second pass's, not the first's.
    expect(out).toEqual({ b: 'b1', a: 'a1' });
  });

  it('reports nothing for a chain that settles', () => {
    const a = pinner('a', [['a1', [pin('b', 'b2')]]]);
    const b = pinner('b', [['b2', [pin('a', 'a1')]]]);
    const onFinding = vi.fn();
    collectPins({ traits: [], placeholders: [a, b], rolls: { world: { a: 'a1', b: 'b1' }, unique: {} }, onFinding });
    expect(onFinding).not.toHaveBeenCalled();
  });
});

describe('allPinTexts — every text any source could pin', () => {
  it('walks trait, location, descriptor and value pins, de-duplicating texts per placeholder', () => {
    const town = P('town', ['Sedge', 'Marrow']);
    const region = pinner('region', [['Northern', [pin('town', 'Ash')]]]);
    const out = allPinTexts({
      traits: [trait('t', [pin('town', 'Marrow')])],
      locations: [location('l', [pin('town', 'Fen'), pin('town', 'Marrow')])],
      stats: [stat('s', 0, [{ threshold: 50, pins: [pin('town', 'Moor')] }])],
      placeholders: [town, region],
    });
    expect(out).toEqual({ town: ['Marrow', 'Fen', 'Moor', 'Ash'] });
  });

  it('walks an entity’s owned trait pins too', () => {
    const out = allPinTexts({ entities: [{ traits: [trait('t', [pin('town', 'Tame')])] }], placeholders: [P('town', ['Sedge'])] });
    expect(out).toEqual({ town: ['Tame'] });
  });
});

describe('valuePinRollChips — a World chip per placeholder whose values pin', () => {
  it('names each pinning placeholder once, in World mode, and nothing else', () => {
    const plain = P('town', ['Sedge']);
    const region = pinner('region', [['Northern', [pin('town', 'Sedge')]], ['Southern', [pin('town', 'Sedge')]]]);
    const chips = valuePinRollChips([plain, region]).map((c) => decodePlaceholderToken(c));
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: 'region', mode: 'world' });
  });
});

describe('activePlaceholderPins — the trait-only collector still reads the same', () => {
  it('collects pins, last active trait winning', () => {
    const early = trait('early', [pin('hair', 'brown')]);
    const late = trait('late', [pin('hair', 'red')]);
    expect(activePlaceholderPins([early, late])).toEqual({ hair: 'red' });
  });
});

type EditorWorld = Parameters<typeof pinsTargeting>[0];

describe('pinsTargeting — every pin on one placeholder, from any source', () => {
  const world = {
    traits: [trait('sworn', [pin('town', 'Marrow')]), trait('kin', [pin('hair', 'ash')])],
    traitGroups: [],
    locations: [location('fen', [pin('town', 'Fen Town')])],
    stats: [{ ...stat('hunger', 50, [{ threshold: 20, pins: [pin('town', 'Hollow')] }]), name: 'Hunger', type: 'number' }],
    placeholders: [
      P('town', ['Marrow', 'Fen Town']),
      pinner('region', [['Northern', [pin('town', 'Snowfall')]], ['Southern', []]]),
      P('hair', ['ash']),
    ],
  } as unknown as EditorWorld;

  it('walks trait, location, band and value pins, in precedence order, each labeled by its source', () => {
    const rows = pinsTargeting(world, 'town');
    expect(rows.map((r) => r.label)).toEqual(['Hunger ≤ 20', 'Location: fen', 'Trait: sworn', 'region = Northern']);
    expect(rows.map((r) => r.source)).toEqual([
      { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' },
      { kind: 'location', id: 'fen' },
      { kind: 'trait', id: 'sworn' },
      { kind: 'value', placeholderId: 'region', valueId: 'v:Northern' },
    ]);
    expect(rows.map((r) => r.pin.value)).toEqual(['Hollow', 'Fen Town', 'Marrow', 'Snowfall']);
  });

  it('leaves out pins aimed elsewhere', () => {
    expect(pinsTargeting(world, 'hair').map((r) => r.label)).toEqual(['Trait: kin']);
  });

  it('marks a percent threshold as one', () => {
    const percent = { ...world, stats: [{ ...world.stats![0], thresholdUnit: 'percent' }] } as EditorWorld;
    expect(pinsTargeting(percent, 'town')[0].label).toBe('Hunger ≤ 20%');
  });
});

describe('pinConflict — who else pins it, and who wins', () => {
  const T = (id: string, extra: Partial<Trait> = {}) => trait(id, [pin('town', id)], extra);
  const base = {
    traits: [T('above'), T('below')],
    traitGroups: [],
    locations: [location('fen', [pin('town', 'Fen')]), location('moor', [pin('town', 'Moor')])],
    stats: [
      { ...stat('thirst', 50, [{ threshold: 20, pins: [pin('town', 'T1')] }]), name: 'Thirst' },
      { ...stat('hunger', 50, [{ threshold: 20, pins: [pin('town', 'H1')] }, { threshold: 60, pins: [pin('town', 'H2')] }]), name: 'Hunger' },
    ],
    placeholders: [
      P('town', ['Marrow']),
      pinner('region', [['North', [pin('town', 'N')]], ['South', [pin('town', 'S')]]]),
      pinner('season', [['Snow', [pin('town', 'Sn')]]]),
    ],
  } as unknown as EditorWorld;

  it('returns null when nothing else pins the placeholder', () => {
    const lone = { ...base, traits: [T('only')], locations: [], stats: [], placeholders: [P('town', ['Marrow'])] };
    expect(pinConflict(lone, 'town', { kind: 'trait', id: 'only' })).toBeNull();
  });

  it('ranks a band over a location, a location over a trait, and a trait over a value pin', () => {
    const fromTrait = pinConflict(base, 'town', { kind: 'trait', id: 'below' })!;
    expect(fromTrait.winner?.label).toBe('Hunger ≤ 60');
    expect(fromTrait.rule).toBe('kind');
    const fromLocation = pinConflict(base, 'town', { kind: 'location', id: 'fen' })!;
    expect(fromLocation.winner?.label).toBe('Hunger ≤ 60');
    const fromValue = pinConflict(base, 'town', { kind: 'value', placeholderId: 'region', valueId: 'v:North' })!;
    expect(fromValue.winner?.label).toBe('Hunger ≤ 60');
    // Nothing outranks a band, and Hunger sits below Thirst in the stat list, so Hunger's band wins.
    const fromBand = pinConflict(base, 'town', { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b1' })!;
    expect(fromBand.winner).toBeNull();
    // Its nearest rival is Thirst's band, so what decided it was the order of the stat list.
    expect(fromBand.rule).toBe('order');
    expect(fromBand.rivals.map((r) => r.label)).toEqual(['Thirst ≤ 20', 'Location: fen', 'Location: moor', 'Trait: above', 'Trait: below', 'region = North', 'region = South', 'season = Snow']);
    const fromThirst = pinConflict(base, 'town', { kind: 'descriptor', statId: 'thirst', descriptorId: 'thirst-b0' })!;
    expect(fromThirst.winner?.label).toBe('Hunger ≤ 60');
    expect(fromThirst.rule).toBe('order');
  });

  it('lets the trait lowest in the list win among traits, and says the rule was order', () => {
    const traitsOnly = { ...base, locations: [], stats: [], placeholders: [P('town', ['Marrow'])] };
    const above = pinConflict(traitsOnly, 'town', { kind: 'trait', id: 'above' })!;
    expect(above.rivals.map((r) => r.label)).toEqual(['Trait: below']);
    expect(above.winner?.label).toBe('Trait: below');
    expect(above.rule).toBe('order');
    expect(pinConflict(traitsOnly, 'town', { kind: 'trait', id: 'below' })!.winner).toBeNull();
  });

  it('never pits a source against one it can never share a turn with', () => {
    // Two locations, two bands of one stat, two values of one Wildcard: only one of each is ever in force.
    const fen = pinConflict(base, 'town', { kind: 'location', id: 'fen' })!;
    expect(fen.rivals.map((r) => r.label)).not.toContain('Location: moor');
    const band = pinConflict(base, 'town', { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' })!;
    expect(band.rivals.map((r) => r.label)).not.toContain('Hunger ≤ 60');
    expect(band.rivals.map((r) => r.label)).toContain('Thirst ≤ 20');
    const north = pinConflict(base, 'town', { kind: 'value', placeholderId: 'region', valueId: 'v:North' })!;
    expect(north.rivals.map((r) => r.label)).not.toContain('region = South');
    expect(north.rivals.map((r) => r.label)).toContain('season = Snow');
    // Exclusive trait siblings likewise.
    const exclusive = {
      ...base, locations: [], stats: [], placeholders: [P('town', ['Marrow'])],
      traits: [T('above', { groupId: 'g' }), T('below', { groupId: 'g' })],
      traitGroups: [{ id: 'g', name: 'Hair', parentId: null, maxPicks: 1 }],
    } as unknown as EditorWorld;
    expect(pinConflict(exclusive, 'town', { kind: 'trait', id: 'above' })).toBeNull();
  });

  it('pits every value of an Object against its siblings, the later one winning', () => {
    const object = {
      ...base, traits: [], locations: [], stats: [],
      placeholders: [P('town', ['Marrow']), { ...pinner('kit', [['Boots', [pin('town', 'B')]], ['Cloak', [pin('town', 'C')]]]), roll: false }],
    } as unknown as EditorWorld;
    const boots = pinConflict(object, 'town', { kind: 'value', placeholderId: 'kit', valueId: 'v:Boots' })!;
    expect(boots.rivals.map((r) => r.label)).toEqual(['kit = Cloak']);
    expect(boots.winner?.label).toBe('kit = Cloak');
    expect(pinConflict(object, 'town', { kind: 'value', placeholderId: 'kit', valueId: 'v:Cloak' })!.winner).toBeNull();
  });
});

describe('pin write-back — add, update and remove on the source a row names', () => {
  const world = {
    traits: [trait('sworn', [pin('town', 'Marrow'), pin('town', 'Hollow')]), trait('kin', [])],
    traitGroups: [],
    locations: [location('fen', [pin('town', 'Fen Town')]), location('moor', [])],
    stats: [{ ...stat('hunger', 50, [{ threshold: 20, pins: [pin('town', 'Hollow')] }, { threshold: 60, pins: [] }]), name: 'Hunger', type: 'number' }],
    placeholders: [
      P('town', ['Marrow', 'Fen Town']),
      pinner('region', [['Northern', [pin('town', 'Snowfall')]], ['Southern', []]]),
    ],
  } as unknown as EditorWorld;
  const marrow = pin('town', 'Marrow');

  it('appends a pin to a trait, a location, a band and a value, touching nothing else', () => {
    const next = addPinAt(
      addPinAt(
        addPinAt(
          addPinAt(world, { kind: 'trait', id: 'kin' }, marrow),
          { kind: 'location', id: 'moor' }, marrow,
        ),
        { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b1' }, marrow,
      ),
      { kind: 'value', placeholderId: 'region', valueId: 'v:Southern' }, marrow,
    );
    expect(next.traits![1].placeholderPins).toEqual([marrow]);
    expect(next.locations![1].placeholderPins).toEqual([marrow]);
    expect(next.stats![0].descriptors[1].placeholderPins).toEqual([marrow]);
    expect(next.placeholders[1].values[1].pins).toEqual([marrow]);
    // The untouched records keep their identity, so a write costs one re-render per source and no more.
    expect(next.traits![0]).toBe(world.traits![0]);
    expect(next.locations![0]).toBe(world.locations![0]);
    expect(next.stats![0].descriptors[0]).toBe(world.stats![0].descriptors[0]);
    expect(next.placeholders[0]).toBe(world.placeholders[0]);
    expect(world.traits![1].placeholderPins).toEqual([]);
  });

  it('replaces the one row the pin picks, on a source carrying several pins for one placeholder', () => {
    const next = updatePinAt(world, { kind: 'trait', id: 'sworn' }, pin('town', 'Hollow'), pin('town', 'Snowfall'));
    expect(next.traits![0].placeholderPins).toEqual([marrow, pin('town', 'Snowfall')]);
  });

  it('removes the row the pin picks, and drops the list with its last pin', () => {
    const one = removePinAt(world, { kind: 'trait', id: 'sworn' }, marrow);
    expect(one.traits![0].placeholderPins).toEqual([pin('town', 'Hollow')]);
    const none = removePinAt(one, { kind: 'trait', id: 'sworn' }, pin('town', 'Hollow'));
    expect(none.traits![0].placeholderPins).toBeUndefined();
    expect(removePinAt(world, { kind: 'location', id: 'fen' }, pin('town', 'Fen Town')).locations![0].placeholderPins).toBeUndefined();
    expect(removePinAt(world, { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' }, pin('town', 'Hollow'))
      .stats![0].descriptors[0].placeholderPins).toBeUndefined();
    expect(removePinAt(world, { kind: 'value', placeholderId: 'region', valueId: 'v:Northern' }, pin('town', 'Snowfall'))
      .placeholders[1].values[0].pins).toBeUndefined();
  });

  it('tells pins apart by value id, so two rows spelling one text stay distinct', () => {
    const byId = pin('town', 'Marrow', 'v:Marrow');
    const both = addPinAt(world, { kind: 'trait', id: 'kin' }, byId);
    const next = removePinAt(addPinAt(both, { kind: 'trait', id: 'kin' }, marrow), { kind: 'trait', id: 'kin' }, marrow);
    expect(next.traits![1].placeholderPins).toEqual([byId]);
  });

  it('returns the world itself when the source or the row is not there', () => {
    expect(removePinAt(world, { kind: 'trait', id: 'nobody' }, marrow)).toBe(world);
    expect(removePinAt(world, { kind: 'trait', id: 'kin' }, marrow)).toBe(world);
    expect(updatePinAt(world, { kind: 'location', id: 'nowhere' }, marrow, marrow)).toBe(world);
    expect(addPinAt(world, { kind: 'descriptor', statId: 'hunger', descriptorId: 'no-band' }, marrow)).toBe(world);
  });

  it('writes back through every row pinsTargeting lists, landing on that row’s source', () => {
    const rows = pinsTargeting(world, 'town');
    expect(rows.map((r) => r.source.kind)).toEqual(['descriptor', 'location', 'trait', 'trait', 'value']);
    let next = world;
    for (const row of rows) next = updatePinAt(next, row.source, row.pin, pin('town', `via ${row.source.kind}`));
    expect(pinsTargeting(next, 'town').map((r) => [r.source.kind, r.pin.value])).toEqual([
      ['descriptor', 'via descriptor'], ['location', 'via location'], ['trait', 'via trait'], ['trait', 'via trait'], ['value', 'via value'],
    ]);
    for (const row of pinsTargeting(next, 'town')) next = removePinAt(next, row.source, row.pin);
    expect(pinsTargeting(next, 'town')).toEqual([]);
  });

  it('keeps two identical rows apart when handed the stored pin, as a row is', () => {
    const twice = addPinAt(addPinAt(world, { kind: 'location', id: 'moor' }, pin('town', '')), { kind: 'location', id: 'moor' }, pin('town', ''));
    const rows = pinsTargeting(twice, 'town').filter((r) => r.source.kind === 'location' && r.source.id === 'moor');
    expect(rows).toHaveLength(2);
    const next = updatePinAt(twice, rows[1].source, rows[1].pin, pin('town', 'Moorside'));
    expect(next.locations![1].placeholderPins).toEqual([pin('town', ''), pin('town', 'Moorside')]);
    expect(removePinAt(next, rows[0].source, rows[0].pin).locations![1].placeholderPins).toEqual([pin('town', 'Moorside')]);
  });
});

describe('owned traits as pin sources — the world’s traits, then each cast entity’s', () => {
  const ash = {
    id: 'ash', name: 'Ash',
    traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 1 }],
    traits: [
      trait('tamed', [pin('town', 'Tame')], { name: 'Tamed', groupId: 'g-bond' }),
      trait('wild', [pin('town', 'Wild')], { name: 'Wild', groupId: 'g-bond' }),
    ],
  };
  const world = {
    traits: [trait('sworn', [pin('town', 'Marrow')], { name: 'Sworn' })],
    traitGroups: [],
    entities: [ash],
    placeholders: [P('town', ['Marrow'])],
  } as unknown as EditorWorld;

  it('lists an owned trait’s pin under its owner’s name, after the world’s traits', () => {
    expect(pinsTargeting(world, 'town').map((r) => r.label)).toEqual(['Trait: Sworn', "Trait: Ash's Tamed", "Trait: Ash's Wild"]);
    expect(pinSourcesOfKind(world, 'trait', 'town').map((o) => o.label)).toEqual(['Sworn', "Ash's Tamed", "Ash's Wild"]);
  });

  it('lets a cast entity’s owned trait beat the player’s world trait, since it lays last in its own text', () => {
    const fromSworn = pinConflict(world, 'town', { kind: 'trait', id: 'sworn' })!;
    expect(fromSworn.winner?.label).toBe("Trait: Ash's Wild");
    expect(fromSworn.rule).toBe('order');
    expect(pinConflict(world, 'town', { kind: 'trait', id: 'tamed' })!.winner).toBeNull();
  });

  it('never pits two cast entities’ traits against each other', () => {
    const bo = { id: 'bo', name: 'Bo', traits: [trait('feral', [pin('town', 'Feral')], { name: 'Feral' })] };
    const both = { ...world, entities: [ash, bo] } as unknown as EditorWorld;
    expect(pinConflict(both, 'town', { kind: 'trait', id: 'feral' })!.rivals.map((r) => r.label)).toEqual(['Trait: Sworn']);
  });

  it('pits a Persona’s trait against a cast entity’s, which wins in its own text', () => {
    // Mira is listed after Bo, so order alone would hand her the win.
    const bo = { id: 'bo', name: 'Bo', traits: [trait('feral', [pin('town', 'Feral')], { name: 'Feral' })] };
    const mira = { id: 'mira', name: 'Mira', persona: true, traits: [trait('sworn-m', [pin('town', 'Oath')], { name: 'Oath' })] };
    const both = { ...world, traits: [], entities: [bo, mira] } as unknown as EditorWorld;
    const fromMira = pinConflict(both, 'town', { kind: 'trait', id: 'sworn-m' })!;
    expect(fromMira.rivals.map((r) => r.label)).toEqual(["Trait: Bo's Feral"]);
    expect(fromMira.winner?.label).toBe("Trait: Bo's Feral");
  });

  it('never pits two Personas’ traits against each other: only one is played, and each wins in its own text', () => {
    const mira = { id: 'mira', name: 'Mira', persona: true, traits: [trait('oath', [pin('town', 'Oath')], { name: 'Oath' })] };
    const nell = { id: 'nell', name: 'Nell', persona: true, traits: [trait('vow', [pin('town', 'Vow')], { name: 'Vow' })] };
    const both = { ...world, traits: [], entities: [mira, nell] } as unknown as EditorWorld;
    expect(pinConflict(both, 'town', { kind: 'trait', id: 'oath' })).toBeNull();
    const withWorld = { ...world, entities: [mira, nell] } as unknown as EditorWorld;
    expect(pinConflict(withWorld, 'town', { kind: 'trait', id: 'oath' })!.rivals.map((r) => r.label)).toEqual(['Trait: Sworn']);
  });

  it('never pits an owned trait against its exclusive sibling', () => {
    const fromTamed = pinConflict(world, 'town', { kind: 'trait', id: 'tamed' })!;
    expect(fromTamed.rivals.map((r) => r.label)).toEqual(['Trait: Sworn']);
  });

  it('writes an owned trait’s pin back to its entity and hands the entity to its writer', () => {
    const next = updatePinAt(world, { kind: 'trait', id: 'wild' }, pin('town', 'Wild'), pin('town', 'Feral'));
    expect(next.entities![0].traits![1].placeholderPins).toEqual([pin('town', 'Feral')]);
    expect(next.traits).toBe(world.traits);
    const updateTrait = vi.fn();
    const updateEntity = vi.fn();
    commitPinSource(next, { kind: 'trait', id: 'wild' }, { updateTrait, updateEntity });
    expect(updateEntity).toHaveBeenCalledWith(next.entities![0]);
    expect(updateTrait).not.toHaveBeenCalled();
    const onlyEntity = vi.fn();
    expect(canCommitPinSource({ kind: 'trait', id: 'wild' }, { updateEntity: onlyEntity })).toBe(true);
    commitPinSource(next, { kind: 'trait', id: 'wild' }, { updateEntity: onlyEntity });
    expect(onlyEntity).toHaveBeenCalledWith(next.entities![0]);
  });
});

describe('link pin lists as pin sources — a link’s overridden pins, listed per bearer', () => {
  const worldGarb: Placeholder = { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate']) };
  const plate = pin('garb', 'Plate', phValueId('Plate'));
  const paladin = trait('paladin', [plate], { name: 'Paladin', groupId: 'blueprints' });
  /** A link to Paladin; with `pins` it overrides the original's list, else it reads the list live. */
  const link = (id: string, pins?: PlaceholderPin[]): TraitLink => ({
    id, originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0,
    ...(pins ? { overrides: { paladin: { placeholderPins: { value: pins, blueprint: paladin.placeholderPins! } } } } : {}),
  });
  const world = {
    traits: [paladin],
    traitGroups: [{ id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    entities: [
      { id: 'albus', name: 'Albus', traitLinks: [link('l-albus', [pin('garb', 'Gilded plate')])] },
      { id: 'mira', name: 'Mira', traitLinks: [link('l-mira', [pin('garb', 'Robe', phValueId('Robe'))])] },
      { id: 'bo', name: 'Bo', traitLinks: [link('l-bo')] },
      { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [link('l-you', [pin('garb', 'Robe')])] },
    ],
    placeholders: [worldGarb],
  } as unknown as EditorWorld;
  const mira = { kind: 'trait' as const, id: 'paladin', link: { bearerId: 'mira', linkId: 'l-mira' } };
  const newcomer = { kind: 'trait' as const, id: 'paladin', link: { bearerId: 'cp', linkId: 'l-you' } };

  it('lists each link’s own list under its bearer, the Custom Persona entity’s before the cast’s, and leaves a link reading the original live out', () => {
    const rows = pinsTargeting(world, 'garb');
    expect(rows.map((r) => [r.label, r.pin.value])).toEqual([
      ['Trait: Paladin', 'Plate'], ["Trait: Newcomer's Paladin", 'Robe'], ["Trait: Albus's Paladin", 'Gilded plate'], ["Trait: Mira's Paladin", 'Robe'],
    ]);
    expect(rows[3].source).toEqual(mira);
  });

  it('keeps link rows out of the add and re-aim pickers', () => {
    expect(pinSourcesOfKind(world, 'trait', 'garb').map((o) => o.label)).toEqual(['Paladin']);
  });

  it('writes a pin edit to the link’s list, snapshot kept, and hands the bearer to its writer', () => {
    const [row] = pinsTargeting(world, 'garb').filter((r) => sameSource(r.source, mira));
    const next = updatePinAt(world, row.source, row.pin, plate);
    expect(next.entities![1].traitLinks![0].overrides).toEqual({ paladin: { placeholderPins: { value: [plate], blueprint: [plate] } } });
    expect(next.traits).toBe(world.traits);
    const updateEntity = vi.fn();
    commitPinSource(next, row.source, { updateTrait: vi.fn(), updateEntity });
    expect(updateEntity).toHaveBeenCalledWith(next.entities![1]);
  });

  it('starts a link’s list from the original’s when the link still reads it live', () => {
    const bo = { kind: 'trait' as const, id: 'paladin', link: { bearerId: 'bo', linkId: 'l-bo' } };
    const next = addPinAt(world, bo, pin('garb', 'Chain'));
    expect(next.entities![2].traitLinks![0].overrides).toEqual({
      paladin: { placeholderPins: { value: [plate, pin('garb', 'Chain')], blueprint: [plate] } },
    });
  });

  it('empties the link’s list on removing its last pin, which then lays nothing', () => {
    const [row] = pinsTargeting(world, 'garb').filter((r) => sameSource(r.source, mira));
    const next = removePinAt(world, row.source, row.pin);
    expect(next.entities![1].traitLinks![0].overrides).toEqual({ paladin: { placeholderPins: { value: [], blueprint: [plate] } } });
    expect(pinsTargeting(next, 'garb').map((r) => r.label)).toEqual(['Trait: Paladin', "Trait: Newcomer's Paladin", "Trait: Albus's Paladin"]);
  });

  it('writes the Custom Persona entity’s link list back through the entity writer', () => {
    const [row] = pinsTargeting(world, 'garb').filter((r) => sameSource(r.source, newcomer));
    const next = addPinAt(world, row.source, pin('town', 'Marrow'));
    expect(next.entities![3].traitLinks![0].overrides!.paladin.placeholderPins!.value).toEqual([pin('garb', 'Robe'), pin('town', 'Marrow')]);
    const updateEntity = vi.fn();
    commitPinSource(next, row.source, { updateTrait: vi.fn(), updateEntity });
    expect(updateEntity).toHaveBeenCalledWith(next.entities![3]);
  });

  it('pits a cast entity’s link list against the player’s, never against another cast entity’s', () => {
    const conflict = pinConflict(world, 'garb', mira)!;
    // The original's own row reads as the player's, as every world trait row does.
    expect(conflict.rivals.map((r) => r.label)).toEqual(['Trait: Paladin', "Trait: Newcomer's Paladin"]);
    expect(conflict.winner).toBeNull();
  });
});

describe('bindBlueprintPins — a blueprint pin traced to the placeholder its bearer reads', () => {
  const garb: Placeholder = { id: 'garb', name: 'Garb', values: [{ id: 'v-white', text: 'white tabard' }, { id: 'v-mail', text: 'mail' }] };
  const copy = (id: string, overrides: Placeholder['valueOverrides']): Placeholder =>
    ({ id, name: 'Garb', values: [], blueprintId: 'garb', valueOverrides: overrides });
  const reworded = (id: string, text: string) => copy(id, { 'v-white': { text: { value: text, blueprint: 'white tabard' } } });
  const albus: Entity = { id: 'albus', name: 'Albus', placeholders: [reworded('albus-garb', 'sun-disc tabard')] };
  const bree: Entity = { id: 'bree', name: 'Bree' };
  const mira: Entity = { id: 'mira', name: 'Mira', placeholders: [copy('mira-garb', { 'v-white': { removed: true } })] };
  const newcomer: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, placeholders: [reworded('cp-garb', 'plain tabard')] };
  const world = { placeholders: [garb, P('town', ['Marrow'])], entities: [albus, bree, mira, newcomer] };
  const white = pin('garb', 'white tabard', 'v-white');
  const town = pin('town', 'Marrow');
  const paladin = trait('paladin', [white, town]);
  const as = (entity: Entity | null, isPlayer = false, persona?: PersonaRef) => readerFor(persona, entity, isPlayer);

  it('aims the pin at the bearer’s copy, valued as the copy rewords it, and leaves every other pin as stored', () => {
    expect(bindBlueprintPins(paladin, world, as(albus)).placeholderPins).toEqual([pin('albus-garb', 'sun-disc tabard', 'v-white'), town]);
  });

  it('reads the blueprint for a bearer without a copy, so the trait comes back as is', () => {
    expect(bindBlueprintPins(paladin, world, as(bree))).toBe(paladin);
  });

  it('drops a pin naming a value the copy removed, so it lays nothing', () => {
    expect(bindBlueprintPins(paladin, world, as(mira)).placeholderPins).toEqual([town]);
  });

  it('carries a free-text pin to the copy with its text', () => {
    const gilt = trait('gilt', [pin('garb', 'gilt thread')]);
    expect(bindBlueprintPins(gilt, world, as(albus)).placeholderPins).toEqual([pin('albus-garb', 'gilt thread')]);
  });

  it('reads the Custom Persona entity’s copy for the player under None and under a library persona without its own', () => {
    const plain = pin('cp-garb', 'plain tabard', 'v-white');
    expect(bindBlueprintPins(paladin, world, as(null, true, { source: 'none' })).placeholderPins).toEqual([plain, town]);
    const lib: Entity = { id: 'lib', name: 'Lib' };
    expect(bindBlueprintPins(paladin, world, as(lib, true, { source: 'library', entityId: 'lib' })).placeholderPins).toEqual([plain, town]);
    // A library persona's own copy wins over the Custom Persona entity's.
    const own = { ...lib, placeholders: [reworded('lib-garb', 'sea-green tabard')] };
    expect(bindBlueprintPins(paladin, world, as(own, true, { source: 'library', entityId: 'lib' })).placeholderPins)
      .toEqual([pin('lib-garb', 'sea-green tabard', 'v-white'), town]);
  });

  it('reads a world persona’s own copy only, and never the Custom Persona entity’s for a cast entity', () => {
    expect(bindBlueprintPins(paladin, world, as(bree, true, { source: 'world', entityId: 'bree' }))).toBe(paladin);
    expect(bindBlueprintPins(paladin, world, as(bree, false, { source: 'none' }))).toBe(paladin);
  });

  it('returns the trait itself when nothing it pins is a blueprint', () => {
    const plain = trait('plain', [town]);
    expect(bindBlueprintPins(plain, world, as(albus))).toBe(plain);
    const none = trait('none', []);
    expect(bindBlueprintPins(none, world, as(albus))).toBe(none);
  });

  it('finds a pin’s editor target by id alone', () => {
    expect(pinTarget(white, world.placeholders)).toBe(garb);
    expect(pinTarget(pin('albus-garb', 'sun-disc tabard', 'v-white'), world.placeholders)).toBeUndefined();
  });
});

describe('pinSourcesOfKind — what the add and re-aim pickers offer', () => {
  const world = {
    traits: [trait('kin', []), trait('sworn', [])],
    traitGroups: [],
    locations: [location('fen', []), location('moor', [])],
    stats: [{
      ...stat('hunger', 50, [{ threshold: 20, pins: [] }, { threshold: 60, pins: [] }]),
      name: 'Hunger', type: 'number',
    }],
    placeholders: [P('town', ['Marrow']), pinner('region', [['Northern', []], ['Southern', []]])],
  } as unknown as EditorWorld;
  world.stats![0].descriptors[0].description = 'Starving';
  world.stats![0].descriptors[1].description = '';

  it('lists traits, locations, bands and values under the labels the pickers show', () => {
    expect(pinSourcesOfKind(world, 'trait', 'town').map((s) => s.label)).toEqual(['kin', 'sworn']);
    expect(pinSourcesOfKind(world, 'location', 'town').map((s) => s.label)).toEqual(['fen', 'moor']);
    expect(pinSourcesOfKind(world, 'descriptor', 'town').map((s) => s.label)).toEqual(['Hunger ≤ 20: Starving', 'Hunger ≤ 60']);
    expect(pinSourcesOfKind(world, 'value', 'town').map((s) => s.label)).toEqual(['region = Northern', 'region = Southern']);
    expect(pinSourcesOfKind(world, 'descriptor', 'town').map((s) => s.source)).toEqual([
      { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' },
      { kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b1' },
    ]);
  });

  it('leaves the placeholder’s own values out, since a value cannot pin its own placeholder', () => {
    expect(pinSourcesOfKind(world, 'value', 'region').map((s) => s.label)).toEqual(['town = Marrow']);
  });

  it('keys every source distinctly, band ids included', () => {
    const keys = (['trait', 'location', 'descriptor', 'value'] as const)
      .flatMap((kind) => pinSourcesOfKind(world, kind, 'town').map((s) => pinSourceKey(s.source)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(pinSourceKey({ kind: 'descriptor', statId: 'hunger', descriptorId: 1 }))
      .not.toBe(pinSourceKey({ kind: 'descriptor', statId: 'hunger', descriptorId: '1x' }));
  });
});

describe('pins on blueprints — only blueprint-side sources name a blueprint, and none names a copy', () => {
  const garb: Placeholder = {
    id: 'garb', name: 'Garb', groupId: 'bp',
    values: [{ id: 'v-white', text: 'white tabard' }, { id: 'v-mail', text: 'mail' }],
  };
  const copy: Placeholder = {
    id: 'albus-garb', name: 'Garb', blueprintId: 'garb', values: [{ id: 'v-rust', text: 'rust cloak' }],
    valueOverrides: { 'v-white': { text: { value: 'sun-disc tabard', blueprint: 'white tabard' } }, 'v-mail': { removed: true } },
  };
  const sash: Placeholder = { id: 'sash', name: 'Sash', groupId: 'bp', values: [{ id: 'v-red', text: 'red' }] };
  // A part Garb owns: its values sit under a blueprint.
  const trim: Placeholder = { id: 'trim', name: 'Trim', ownerId: 'garb', values: [{ id: 'v-gilt', text: 'gilt' }] };
  const town = P('town', ['Marrow']);
  const ash: Entity = { id: 'ash', name: 'Ash', placeholders: [copy], traits: [trait('tamed', [])] };
  const world = {
    traits: [trait('paladin', [])],
    traitGroups: [],
    entities: [ash],
    locations: [location('fen', [])],
    stats: [{ ...stat('hunger', 50, [{ threshold: 20, pins: [] }]), name: 'Hunger', type: 'number' }],
    placeholders: [garb, trim, sash, town, copy],
    placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' as const }],
  } as unknown as EditorWorld;
  const offers = (source: Parameters<typeof pinTargetFilter>[1], w: EditorWorld | null = world) =>
    [garb, sash, town, copy].filter(pinTargetFilter(w, source)).map((p) => p.id);

  it('lets a world trait and a link’s pins list name a blueprint, never a copy', () => {
    expect(offers({ kind: 'trait', id: 'paladin' })).toEqual(['garb', 'sash', 'town']);
    expect(offers({ kind: 'trait', id: 'paladin', link: { bearerId: 'ash', linkId: 'l' } })).toEqual(['garb', 'sash', 'town']);
  });

  it('lets a blueprint’s values, its parts’ values and a copy’s values name a blueprint', () => {
    expect(offers({ kind: 'value', placeholderId: 'garb', valueId: 'v-white' })).toEqual(['garb', 'sash', 'town']);
    expect(offers({ kind: 'value', placeholderId: 'trim', valueId: 'v-gilt' })).toEqual(['garb', 'sash', 'town']);
  });

  it('keeps a copy’s values off its own blueprint, which would pin the copy itself', () => {
    expect(offers({ kind: 'value', placeholderId: 'albus-garb', valueId: 'v-rust' })).toEqual(['sash', 'town']);
  });

  it('keeps blueprints from an owned trait, a location, a band and a world value', () => {
    expect(offers({ kind: 'trait', id: 'tamed' })).toEqual(['town']);
    expect(offers({ kind: 'location', id: 'fen' })).toEqual(['town']);
    expect(offers({ kind: 'descriptor', statId: 'hunger', descriptorId: 'hunger-b0' })).toEqual(['town']);
    expect(offers({ kind: 'value', placeholderId: 'town', valueId: town.values[0].id })).toEqual(['town']);
  });

  it('keeps copies out with no world behind the editor', () => {
    expect(offers({ kind: 'trait', id: 'paladin' }, null)).toEqual(['garb', 'sash', 'town']);
  });

  it('offers a blueprint’s Pins section only trait and value sources, each blueprint-side', () => {
    expect(pinKindsFor(world, 'garb').map((k) => k.kind)).toEqual(['trait', 'value']);
    expect(pinKindsFor(world, 'town').map((k) => k.kind)).toEqual(['descriptor', 'location', 'trait', 'value']);
    expect(pinSourcesOfKind(world, 'trait', 'garb').map((s) => s.label)).toEqual(['paladin']);
    const valueOwners = (id: string) => pinSourcesOfKind(world, 'value', id).map((s) => (s.source as { placeholderId: string }).placeholderId);
    expect(valueOwners('garb')).toEqual(['trim', 'sash']);
    expect(valueOwners('sash')).toEqual(['garb', 'garb', 'trim', 'albus-garb']);
    expect(pinSourcesOfKind(world, 'trait', 'town').map((s) => s.label)).toEqual(['paladin', "Ash's tamed"]);
  });

  it('reads a copy’s values as the copy reads them, so a picked value keeps the blueprint’s id', () => {
    const onCopy = pin('albus-garb', '');
    expect(pinTarget(onCopy, world.placeholders)?.values.map((v) => v.text)).toEqual(['sun-disc tabard', 'rust cloak']);
    expect(withPinnedValue(onCopy, 'sun-disc tabard', world.placeholders)).toEqual(pin('albus-garb', 'sun-disc tabard', 'v-white'));
    expect(withPinnedValue(onCopy, 'mail', world.placeholders)).toEqual(pin('albus-garb', 'mail'));
  });
});
