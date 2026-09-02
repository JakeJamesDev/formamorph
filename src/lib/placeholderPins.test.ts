import { describe, it, expect, vi } from 'vitest';
import type { GameLocation, Placeholder, PlaceholderPin, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { decodePlaceholderToken } from './placeholders';
import {
  activePlaceholderPins, addPinAt, allPinTexts, collectPinLayers, collectPins, pinConflict, pinSourceKey, pinSourcesOfKind,
  pinsTargeting, removePinAt, updatePinAt, valuePinRollChips, type PinnableStat,
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
      traitGroups: [{ id: 'g', name: 'Hair', parentId: null, exclusive: true }],
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
