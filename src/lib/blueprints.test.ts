import { describe, it, expect } from 'vitest';
import type { BlueprintOverrides, Entity, Placeholder, PlaceholderValue, Trait, TraitLink } from '@/types';
import {
  lookupCopy, copyOf, copyValueState, customPersonaEntity, effectiveCopy, effectiveLinkTrait, effectiveRecord, isCopy,
  linkTraitState, readerFor, removeCopyValue, resetCopyOverrides, resetCopyValue, resetLinkOverride, resetLinkOverrides,
  resetLinkTraitOverrides, setCopyValueText, setCopyValueWeight, setLinkEdits, setLinkOverride, withOverride, withoutOverride,
} from './blueprints';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const link = (id: string, originalId: string, extra: Partial<TraitLink> = {}): TraitLink =>
  ({ id, originalId, kind: 'trait', originalName: originalId, groupId: null, order: 0, ...extra });
const value = (id: string, text: string): PlaceholderValue => ({ id, text });
const ph = (id: string, name: string, values: PlaceholderValue[], extra: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values, ...extra });

describe('effectiveRecord', () => {
  type Rec = { on: boolean; list: string[] };
  const blueprint: Rec = { on: false, list: ['a'] };

  const cases: [string, BlueprintOverrides<Rec> | undefined, Rec, (keyof Rec)[], (keyof Rec)[]][] = [
    ['untouched reads live', undefined, { on: false, list: ['a'] }, [], []],
    ['one override', { on: { value: true, blueprint: false } }, { on: true, list: ['a'] }, ['on'], []],
    ['a list override reads whole', { list: { value: ['b', 'c'], blueprint: ['a'] } }, { on: false, list: ['b', 'c'] }, ['list'], []],
    ['stale when the blueprint moved since', { on: { value: true, blueprint: true } }, { on: true, list: ['a'] }, ['on'], ['on']],
    ['a list compares by content', { list: { value: ['b'], blueprint: ['x'] } }, { on: false, list: ['b'] }, ['list'], ['list']],
  ];
  it.each(cases)('%s', (_name, overrides, record, overridden, stale) => {
    const out = effectiveRecord(blueprint, overrides);
    expect(out.record).toEqual(record);
    expect(out.overridden).toEqual(overridden);
    expect(out.stale).toEqual(stale);
  });

  it('is not stale while the blueprint still reads as the snapshot, even when the value matches the blueprint', () => {
    expect(effectiveRecord(blueprint, { on: { value: false, blueprint: false } }).stale).toEqual([]);
  });
});

describe('withOverride / withoutOverride', () => {
  it('stores the value with its snapshot, resets one field, and drops an emptied map', () => {
    const one = withOverride<{ a: number; b: number }, 'a'>(undefined, 'a', 2, 1);
    expect(one).toEqual({ a: { value: 2, blueprint: 1 } });
    const two = withOverride(one, 'b', 5, 4);
    expect(withoutOverride(two, 'a')).toEqual({ b: { value: 5, blueprint: 4 } });
    expect(withoutOverride(one, 'a')).toBeUndefined();
    expect(withoutOverride(undefined, 'a')).toBeUndefined();
  });
});

describe('trait links', () => {
  const paladin = trait('paladin', {
    isDefault: true, playerToggle: false, requires: [{ kind: 'trait', id: 'brave' }],
    placeholderPins: [{ placeholderId: 'garb', value: 'tabard', valueId: 'v-tabard' }],
    statChanges: [{ statId: 'hp', value: 2, type: 'max' }],
  });

  it('reads the original live when the link overrides nothing', () => {
    const l = link('l1', 'classes');
    expect(effectiveLinkTrait(paladin, l)).toBe(paladin);
    expect(effectiveLinkTrait(paladin, undefined)).toBe(paladin);
    expect(linkTraitState(paladin, l)).toEqual({
      record: {
        isDefault: true, playerToggle: false, requires: paladin.requires, placeholderPins: paladin.placeholderPins,
        statChanges: paladin.statChanges, mode: 'optional',
      },
      overridden: [], stale: [],
    });
  });

  it('normalizes absent trait fields to their off or empty reading', () => {
    expect(linkTraitState(trait('bare'), link('l1', 'bare')).record)
      .toEqual({ isDefault: false, playerToggle: false, requires: [], placeholderPins: [], statChanges: [], mode: 'optional' });
  });

  it('overrides the mode, and an override to Optional clears the original\'s mode', () => {
    const hiddenOriginal = trait('sage', { mode: 'hidden' });
    const toOptional = setLinkOverride(link('l1', 'classes'), hiddenOriginal, 'mode', 'optional');
    expect(toOptional.overrides).toEqual({ sage: { mode: { value: 'optional', blueprint: 'hidden' } } });
    expect(effectiveLinkTrait(hiddenOriginal, toOptional)).not.toHaveProperty('mode');
    const toAlwaysOn = setLinkOverride(link('l1', 'classes'), paladin, 'mode', 'alwaysOn');
    expect(effectiveLinkTrait(paladin, toAlwaysOn).mode).toBe('alwaysOn');
    expect(effectiveLinkTrait(hiddenOriginal, link('l2', 'classes')).mode).toBe('hidden');
    // The editor's Optional choice arrives as an absent mode on the edited trait.
    const { mode: _m, ...asOptional } = hiddenOriginal;
    expect(setLinkEdits(link('l1', 'classes'), hiddenOriginal, asOptional).overrides?.sage?.mode?.value).toBe('optional');
  });

  it('writes one override with the original\'s value as the snapshot, and the trait reads it', () => {
    const l = setLinkOverride(link('l1', 'classes'), paladin, 'isDefault', false);
    expect(l.overrides).toEqual({ paladin: { isDefault: { value: false, blueprint: true } } });
    const seen = effectiveLinkTrait(paladin, l);
    expect(seen.isDefault).toBe(false);
    expect(seen.requires).toBe(paladin.requires);
    expect(linkTraitState(paladin, l).overridden).toEqual(['isDefault']);
  });

  it('overrides a list as a whole, and playerToggle and statChanges too', () => {
    let l = setLinkOverride(link('l1', 'classes'), paladin, 'requires', []);
    l = setLinkOverride(l, paladin, 'playerToggle', true);
    l = setLinkOverride(l, paladin, 'statChanges', [{ statId: 'hp', value: 4, type: 'max' }]);
    l = setLinkOverride(l, paladin, 'placeholderPins', [{ placeholderId: 'garb', value: 'robes', valueId: 'v-robes' }]);
    const seen = effectiveLinkTrait(paladin, l);
    expect(seen).toMatchObject({
      requires: [], playerToggle: true, statChanges: [{ statId: 'hp', value: 4, type: 'max' }],
      placeholderPins: [{ placeholderId: 'garb', valueId: 'v-robes' }],
    });
    expect(seen.name).toBe(paladin.name);
    expect(linkTraitState(paladin, l).overridden).toEqual(['requires', 'placeholderPins', 'playerToggle', 'statChanges']);
  });

  it('keys overrides by original trait id, so a linked group holds one map per child', () => {
    const wizard = trait('wizard');
    let l = setLinkOverride(link('l1', 'classes'), paladin, 'isDefault', false);
    l = setLinkOverride(l, wizard, 'isDefault', true);
    expect(Object.keys(l.overrides!)).toEqual(['paladin', 'wizard']);
    expect(effectiveLinkTrait(wizard, l).isDefault).toBe(true);
  });

  it('resets one field, and drops the trait\'s map and the link\'s map when emptied', () => {
    let l = setLinkOverride(link('l1', 'classes'), paladin, 'isDefault', false);
    l = setLinkOverride(l, paladin, 'playerToggle', true);
    const one = resetLinkOverride(l, 'paladin', 'isDefault');
    expect(one.overrides).toEqual({ paladin: { playerToggle: { value: true, blueprint: false } } });
    expect(resetLinkOverride(one, 'paladin', 'playerToggle')).not.toHaveProperty('overrides');
    expect(resetLinkOverride(l, 'gone', 'isDefault')).toBe(l);
  });

  it('resets every override at once', () => {
    let l = setLinkOverride(link('l1', 'classes'), paladin, 'isDefault', false);
    l = setLinkOverride(l, trait('wizard'), 'playerToggle', true);
    expect(resetLinkOverrides(l)).not.toHaveProperty('overrides');
    expect(resetLinkOverrides(link('l1', 'classes'))).toEqual(link('l1', 'classes'));
  });

  it("resets one trait's overrides and keeps the other traits' maps", () => {
    let l = setLinkOverride(link('l1', 'classes'), paladin, 'isDefault', false);
    l = setLinkOverride(l, trait('wizard'), 'playerToggle', true);
    expect(resetLinkTraitOverrides(l, 'paladin').overrides).toEqual({ wizard: { playerToggle: { value: true, blueprint: false } } });
    expect(resetLinkTraitOverrides(resetLinkTraitOverrides(l, 'paladin'), 'wizard')).not.toHaveProperty('overrides');
    expect(resetLinkTraitOverrides(l, 'gone')).toBe(l);
  });

  it('writes an edited trait as overrides on the fields that differ from what the link reads, and no others', () => {
    const l = setLinkOverride(link('l1', 'classes'), paladin, 'playerToggle', true);
    const edited = { ...effectiveLinkTrait(paladin, l), isDefault: false, name: 'Renamed', aiDescription: 'x' };
    const out = setLinkEdits(l, paladin, edited);
    expect(linkTraitState(paladin, out).overridden).toEqual(['isDefault', 'playerToggle']);
    expect(out.overrides?.paladin?.isDefault).toEqual({ value: false, blueprint: true });
    // An absent list reads as empty, so clearing the last pin of an original with none is no edit.
    const bare = trait('bare');
    expect(setLinkEdits(link('l2', 'bare'), bare, { ...bare, requires: [], placeholderPins: undefined })).toEqual(link('l2', 'bare'));
    expect(setLinkEdits(l, paladin, effectiveLinkTrait(paladin, l))).toBe(l);
  });

  it('marks an override stale once the original\'s field changed after it was written', () => {
    const l = setLinkOverride(link('l1', 'classes'), paladin, 'requires', [{ kind: 'trait', id: 'calm' }]);
    expect(linkTraitState(paladin, l).stale).toEqual([]);
    const moved = { ...paladin, requires: [{ kind: 'trait' as const, id: 'brave' }, { kind: 'trait' as const, id: 'bold' }] };
    expect(linkTraitState(moved, l).stale).toEqual(['requires']);
    expect(effectiveLinkTrait(moved, l).requires).toEqual([{ kind: 'trait', id: 'calm' }]);
  });
});

describe('copies', () => {
  const garb = ph('garb', 'Class Garb', [value('tabard', 'white tabard'), value('robes', 'blue robes'), value('leathers', 'oiled leathers')], {
    weights: { leathers: 2 }, roll: true,
  });
  const copy = (extra: Partial<Placeholder> = {}): Placeholder => ph('albus-garb', 'Class Garb', [], { blueprintId: 'garb', ...extra });

  it('reads the blueprint\'s values live under the copy\'s id', () => {
    const seen = effectiveCopy(copy(), garb);
    expect(seen.id).toBe('albus-garb');
    expect(seen.name).toBe('Class Garb');
    expect(seen.blueprintId).toBe('garb');
    expect(seen.values).toEqual(garb.values);
    expect(seen.weights).toEqual({ leathers: 2 });
    expect(seen.roll).toBe(true);
    expect(isCopy(seen)).toBe(true);
    expect(isCopy(garb)).toBe(false);
  });

  it('rewords one value, keeping its id, and reports it overridden', () => {
    const c = setCopyValueText(copy(), garb, 'tabard', 'sun-disc tabard');
    expect(c.valueOverrides).toEqual({ tabard: { text: { value: 'sun-disc tabard', blueprint: 'white tabard' } } });
    expect(effectiveCopy(c, garb).values.map((v) => [v.id, v.text])).toEqual([
      ['tabard', 'sun-disc tabard'], ['robes', 'blue robes'], ['leathers', 'oiled leathers'],
    ]);
    expect(copyValueState(c, garb, 'tabard')).toEqual({ overridden: ['text'], stale: [] });
    expect(copyValueState(c, garb, 'robes')).toEqual({ overridden: [], stale: [] });
  });

  it('overrides one value\'s weight against the blueprint\'s, 1 when the blueprint has none', () => {
    const c = setCopyValueWeight(setCopyValueWeight(copy(), garb, 'tabard', 0), garb, 'leathers', 5);
    expect(c.valueOverrides).toEqual({
      tabard: { weight: { value: 0, blueprint: 1 } },
      leathers: { weight: { value: 5, blueprint: 2 } },
    });
    expect(effectiveCopy(c, garb).weights).toEqual({ tabard: 0, leathers: 5 });
  });

  it('removes a blueprint value from this copy alone', () => {
    const c = removeCopyValue(copy(), 'robes');
    expect(c.valueOverrides).toEqual({ robes: { removed: true } });
    expect(effectiveCopy(c, garb).values.map((v) => v.id)).toEqual(['tabard', 'leathers']);
    expect(copyValueState(c, garb, 'robes')).toEqual({ overridden: ['removed'], stale: [] });
    expect(effectiveCopy(copy(), garb).values.map((v) => v.id)).toEqual(['tabard', 'robes', 'leathers']);
  });

  it('keeps own values beside the blueprint\'s, with their own weights', () => {
    const c = copy({ values: [value('own', 'a borrowed cloak')], weights: { own: 3 } });
    const seen = effectiveCopy(c, garb);
    expect(seen.values.map((v) => v.id)).toEqual(['tabard', 'robes', 'leathers', 'own']);
    expect(seen.weights).toEqual({ leathers: 2, own: 3 });
  });

  it('weighs a blueprint value by its override only, never by a stray entry in the copy\'s own map', () => {
    const c = setCopyValueWeight(copy({ weights: { leathers: 9 } }), garb, 'leathers', 5);
    expect(effectiveCopy(c, garb).weights).toEqual({ leathers: 5 });
    expect(effectiveCopy(copy({ weights: { leathers: 9 } }), garb).weights).toEqual({ leathers: 2 });
  });

  it('shows a value the blueprint adds later in every copy', () => {
    const c = setCopyValueText(copy(), garb, 'tabard', 'sun-disc tabard');
    const grown = { ...garb, values: [...garb.values, value('vestments', 'gray vestments')] };
    expect(effectiveCopy(c, grown).values.map((v) => v.id)).toEqual(['tabard', 'robes', 'leathers', 'vestments']);
  });

  it('marks a text or weight override stale once the blueprint changed that field', () => {
    const c = setCopyValueWeight(setCopyValueText(copy(), garb, 'tabard', 'sun-disc tabard'), garb, 'tabard', 0);
    const reworded = { ...garb, values: [value('tabard', 'white tabard and mail'), ...garb.values.slice(1)], weights: { leathers: 2, tabard: 4 } };
    expect(copyValueState(c, reworded, 'tabard')).toEqual({ overridden: ['text', 'weight'], stale: ['text', 'weight'] });
    expect(copyValueState(c, garb, 'tabard')).toEqual({ overridden: ['text', 'weight'], stale: [] });
  });

  it('resets one field, one value, or the whole copy', () => {
    let c = setCopyValueWeight(setCopyValueText(copy(), garb, 'tabard', 'sun-disc tabard'), garb, 'tabard', 0);
    c = removeCopyValue(c, 'robes');
    expect(resetCopyValue(c, 'tabard', 'text').valueOverrides).toEqual({ tabard: { weight: { value: 0, blueprint: 1 } }, robes: { removed: true } });
    expect(resetCopyValue(c, 'tabard').valueOverrides).toEqual({ robes: { removed: true } });
    expect(resetCopyValue(c, 'robes', 'removed').valueOverrides).toEqual({ tabard: c.valueOverrides!.tabard });
    expect(resetCopyOverrides(c)).not.toHaveProperty('valueOverrides');
    expect(resetCopyValue(resetCopyValue(c, 'tabard'), 'robes')).not.toHaveProperty('valueOverrides');
  });
});

describe('copy lookup', () => {
  const garb = ph('garb', 'Class Garb', [value('tabard', 'white tabard')]);
  const albus: Entity = { id: 'albus', name: 'Albus', persona: true, placeholders: [ph('albus-garb', 'Class Garb', [], { blueprintId: 'garb' })] };
  const marked: Entity = {
    id: 'cp', name: 'Newcomer', customPersona: true,
    placeholders: [ph('cp-garb', 'Class Garb', [], { blueprintId: 'garb', valueOverrides: { tabard: { text: { value: 'a plain tabard', blueprint: 'white tabard' } } } })],
  };
  const libWithCopy: Entity = { id: 'lib', name: 'Lib', persona: true, placeholders: [ph('lib-garb', 'Class Garb', [], { blueprintId: 'garb' })] };
  const libWithout: Entity = { id: 'lib2', name: 'Lib2', persona: true };
  const world = { placeholders: [garb], entities: [albus, marked] };

  it('finds the copy an owner holds of a blueprint', () => {
    expect(copyOf(albus, 'garb')?.id).toBe('albus-garb');
    expect(copyOf(albus, 'other')).toBeUndefined();
    expect(copyOf(null, 'garb')).toBeUndefined();
    expect(customPersonaEntity(world.entities)).toBe(marked);
    expect(customPersonaEntity([albus])).toBeUndefined();
  });

  it.each([
    ['a world persona reads its own copy', readerFor({ source: 'world', entityId: 'albus' }, albus, true), 'albus-garb'],
    ['a cast entity reads its own copy', readerFor({ source: 'none' }, albus, false), 'albus-garb'],
    ['a library persona with a copy reads its own', readerFor({ source: 'library', entityId: 'lib' }, libWithCopy, true), 'lib-garb'],
    ['a library persona without one reads the Custom Persona\'s', readerFor({ source: 'library', entityId: 'lib2' }, libWithout, true), 'cp-garb'],
    ['the Custom Persona entity reads its own', readerFor({ source: 'none' }, marked, true), 'cp-garb'],
    ['the root player under None reads the Custom Persona\'s', readerFor({ source: 'none' }, null, true), 'cp-garb'],
    ['the root player under a world persona reads the blueprint', readerFor({ source: 'world', entityId: 'albus' }, null, true), 'garb'],
  ] as const)('%s', (_name, reader, id) => {
    expect(lookupCopy(world, 'garb', reader)?.id).toBe(id);
  });

  it('reads the blueprint under None with no marked entity, and the effective copy otherwise', () => {
    const plain = { placeholders: [garb], entities: [albus] };
    expect(lookupCopy(plain, 'garb', readerFor({ source: 'none' }, null, true))).toBe(garb);
    expect(lookupCopy(world, 'garb', readerFor({ source: 'none' }, null, true))?.values).toEqual([value('tabard', 'a plain tabard')]);
    expect(lookupCopy(world, 'gone', readerFor({ source: 'none' }, null, true))).toBeUndefined();
  });

  it('never reaches the Custom Persona\'s copy for a cast entity or a world persona', () => {
    const hesk: Entity = { id: 'hesk', name: 'Hesk' };
    expect(lookupCopy(world, 'garb', readerFor({ source: 'none' }, hesk, false))).toBe(garb);
    const bare = { ...albus, placeholders: [] };
    expect(lookupCopy(world, 'garb', readerFor({ source: 'world', entityId: 'albus' }, bare, true))).toBe(garb);
  });
});
