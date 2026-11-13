import { describe, it, expect } from 'vitest';
import type { PlaceholderPin, Trait, WorldOption } from '@/types';
import { phValues } from '@/test/placeholderValues';
import {
  addPinAt, collectPinLayers, collectPins, commitPinSource, pinsTargeting, removePinAt,
} from './placeholderPins';
import { encodePlaceholderToken, resolvePlaceholders } from './placeholders';
import {
  BOOLEAN_OFF, BOOLEAN_ON, optionDefault, optionPinLists, optionValue, shownOptions, snapNumber, withOptionType,
} from './worldOptions';

const pin = (placeholderId: string, value: string): PlaceholderPin => ({ placeholderId, value });

const tone = { id: 'tone', name: 'Tone', values: phValues(['plain', 'terse', 'lush']) };
const pace = { id: 'pace', name: 'Pace', values: phValues(['slow', 'quick']) };
const placeholders = [tone, pace];

const style: WorldOption = {
  id: 'o-style', name: 'Style', type: 'choice', shownToPlayer: true, midGame: true, default: 'v-plain',
  values: [
    { id: 'v-plain', name: 'Plain', placeholderPins: [pin('tone', 'plain')] },
    { id: 'v-lush', name: 'Lush', placeholderPins: [pin('tone', 'lush')] },
  ],
};
const brisk: WorldOption = {
  id: 'o-brisk', name: 'Brisk', type: 'boolean', shownToPlayer: true, midGame: false, default: false,
  onPins: [pin('pace', 'quick')], offPins: [pin('pace', 'slow')],
};
const length: WorldOption = {
  id: 'o-length', name: 'Length', type: 'number', shownToPlayer: false, midGame: false, min: 1, max: 9, step: 2, default: 4,
};
const options = [style, brisk, length];

describe('an Option value as a playthrough reads it', () => {
  it('keeps a value the Option accepts', () => {
    expect(optionValue(style, { 'o-style': 'v-lush' })).toBe('v-lush');
    expect(optionValue(brisk, { 'o-brisk': true })).toBe(true);
    expect(optionValue(length, { 'o-length': 7 })).toBe(7);
  });

  it('reads the default for a missing id, a stale choice, a wrong type or an out-of-range number', () => {
    expect(optionValue(style, {})).toBe('v-plain');
    expect(optionValue(style, { 'o-style': 'v-gone' })).toBe('v-plain');
    expect(optionValue(brisk, { 'o-brisk': 'yes' })).toBe(false);
    expect(optionValue(length, { 'o-length': 11 })).toBe(5);
    expect(optionValue(length, { 'o-length': 2.5 })).toBe(5);
  });

  it('snaps a number default onto the step grid inside min and max', () => {
    expect(optionDefault(length)).toBe(5);
    expect(snapNumber(length, -40)).toBe(1);
    expect(snapNumber(length, 40)).toBe(9);
    expect(snapNumber({ min: 0, max: 10 }, 3.6)).toBe(4);
  });

  it('falls to the first value when a choice default names no value', () => {
    expect(optionDefault({ ...style, default: 'v-gone' })).toBe('v-plain');
  });
});

describe('the pins an Option value lays', () => {
  it('lays the picked choice value\'s pins and the boolean state\'s, and none for a number', () => {
    expect(optionPinLists(options, { 'o-style': 'v-lush', 'o-brisk': true })).toEqual([
      { optionId: 'o-style', valueId: 'v-lush', pins: [pin('tone', 'lush')] },
      { optionId: 'o-brisk', valueId: BOOLEAN_ON, pins: [pin('pace', 'quick')] },
    ]);
    expect(optionPinLists(options, {}).map((o) => o.valueId)).toEqual(['v-plain', BOOLEAN_OFF]);
  });

  it('switches the pinned text in a resolved prompt when the value switches', () => {
    const text = `Write ${encodePlaceholderToken({ id: 'tone', mode: 'world', placementId: 'p1' })} prose.`;
    const read = (values: Record<string, string>) =>
      resolvePlaceholders(text, { placeholders, rolls: {}, pins: collectPins({ traits: [], placeholders, options: optionPinLists(options, values) }) });
    expect(read({ 'o-style': 'v-plain' })).toBe('Write plain prose.');
    expect(read({ 'o-style': 'v-lush' })).toBe('Write lush prose.');
  });

  it('ranks under a trait and over a value pin (Q31)', () => {
    const terse: Trait = { id: 't-terse', name: 'Terse', statChanges: [], placeholderPins: [pin('tone', 'terse')] };
    const optionPins = optionPinLists([style], { 'o-style': 'v-lush' });
    expect(collectPins({ traits: [terse], placeholders, options: optionPins }).tone).toBe('terse');
    // A value pin on pace's 'quick' value would pin tone; the Option outranks it.
    const pacer = { ...pace, values: pace.values.map((v) => (v.text === 'quick' ? { ...v, pins: [pin('tone', 'plain')] } : v)) };
    const world = [tone, pacer];
    const pins = collectPins({ traits: [], placeholders: world, options: optionPins, rolls: { world: { pace: 'quick' }, unique: {} } });
    expect(pins.tone).toBe('lush');
  });

  it('traces each lay to its Option value for the lens', () => {
    const { layers } = collectPinLayers({ traits: [], placeholders, options: optionPinLists([style], {}) });
    expect(layers).toEqual([expect.objectContaining({ source: { kind: 'option', optionId: 'o-style', valueId: 'v-plain' }, wins: true })]);
  });
});

describe('Option pins on the pin editors', () => {
  const world = { placeholders, options };

  it('lists every Option pin aimed at a placeholder, labeled by Option and value', () => {
    expect(pinsTargeting(world, 'tone').map((r) => r.label)).toEqual(['Option: Style = Plain', 'Option: Style = Lush']);
    expect(pinsTargeting(world, 'pace').map((r) => r.label)).toEqual(['Option: Brisk = On', 'Option: Brisk = Off']);
  });

  it('writes an added and a removed pin back to the Option that holds it', () => {
    const source = { kind: 'option' as const, optionId: 'o-brisk', valueId: BOOLEAN_ON };
    const added = addPinAt(world, source, pin('tone', 'terse'));
    const on = added.options.find((o) => o.id === 'o-brisk');
    expect(on?.type === 'boolean' && on.onPins).toEqual([pin('pace', 'quick'), pin('tone', 'terse')]);
    const removed = removePinAt(added, { kind: 'option', optionId: 'o-style', valueId: 'v-lush' }, pin('tone', 'lush'));
    const choice = removed.options.find((o) => o.id === 'o-style');
    expect(choice?.type === 'choice' && choice.values[1].placeholderPins).toBeUndefined();
    const written: WorldOption[] = [];
    commitPinSource(added, source, { updateOption: (o) => written.push(o) });
    expect(written).toEqual([on]);
  });
});

describe('Option list helpers', () => {
  it('shows only Options Shown to Player', () => {
    expect(shownOptions(options).map((o) => o.id)).toEqual(['o-style', 'o-brisk']);
  });

  it('keeps the shared fields when the type changes', () => {
    let n = 0;
    const next = withOptionType({ ...style, playerDescription: 'How it reads' }, 'number', () => `id-${n++}`);
    expect(next).toMatchObject({ id: 'o-style', name: 'Style', type: 'number', midGame: true, playerDescription: 'How it reads' });
  });
});
