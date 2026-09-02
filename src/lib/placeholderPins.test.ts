import { describe, it, expect, vi } from 'vitest';
import type { GameLocation, Placeholder, PlaceholderPin, Trait } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { decodePlaceholderToken } from './placeholders';
import { activePlaceholderPins, allPinTexts, collectPins, valuePinRollChips, type PinnableStat } from './placeholderPins';

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
    expect(onFinding.mock.calls[0][0]).toEqual({ kind: 'value-pin-cycle', placeholderIds: ['a', 'b'] });
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
