import { describe, it, expect } from 'vitest';
import type { Placeholder, Stat, Trait, TraitGroup } from '@/types';
import { phValues, phValueId } from '@/test/placeholderValues';
import { reconcilePlaceholderValues } from './placeholders';
import {
  traitOrderIndex,
  inAuthoredOrder,
  activeStatEnabled,
  enabledStats,
  exclusiveSiblings,
  traitConflicts,
  collapseExclusiveDefaults,
  refreshChosenTraits,
  renamedPlaceholderValues,
  repinRenamedValues,
} from './traitEffects';
import { activePlaceholderPins, withPinnedValue } from './placeholderPins';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges: [], ...extra,
});
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({
  id, name: id, parentId: null, ...extra,
});
const S = (id: string, extra: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...extra,
});

describe('authored order', () => {
  it('orders active traits by tree position regardless of the order they were chosen in', () => {
    const groups = [G('g1', { order: 1 }), G('g2', { order: 2 })];
    const traits = [
      T('loose', { order: 0 }),
      T('a', { groupId: 'g1', order: 0 }),
      T('b', { groupId: 'g2', order: 0 }),
    ];
    const order = traitOrderIndex(traits, groups);
    const picked = [traits[2], traits[0], traits[1]]; // b, loose, a — click order
    expect(inAuthoredOrder(picked, order).map((t) => t.id)).toEqual(['loose', 'a', 'b']);
  });

  it('sorts traits missing from the world last rather than dropping them', () => {
    const order = traitOrderIndex([T('a')], []);
    expect(inAuthoredOrder([T('gone'), T('a')], order).map((t) => t.id)).toEqual(['a', 'gone']);
  });
});

describe('re-reading chosen traits from the world', () => {
  it('gives a playthrough the switch on a trait made switchable after it began', () => {
    // The bug this exists for: the save froze the trait before the author marked it switchable, and the
    // panel reads playerToggle off that frozen copy, so no control was ever rendered.
    const saved = [T('brave', { name: 'Brave' })];
    const authored = [T('brave', { name: 'Brave', playerToggle: true })];
    expect(refreshChosenTraits(saved, authored)[0].playerToggle).toBe(true);
  });

  it('picks up renamed text, stat toggles and pins the author has added since', () => {
    const saved = [T('brave', { name: 'Brave', aiDescription: 'old' })];
    const authored = [T('brave', {
      name: 'Bold',
      aiDescription: 'new',
      statToggles: [{ statId: 'rage', enabled: true }],
      placeholderPins: [{ placeholderId: 'hair', value: 'red' }],
    })];
    const [t] = refreshChosenTraits(saved, authored);
    expect(t.name).toBe('Bold');
    expect(t.aiDescription).toBe('new');
    expect(t.statToggles).toEqual([{ statId: 'rage', enabled: true }]);
    expect(t.placeholderPins).toEqual([{ placeholderId: 'hair', value: 'red' }]);
  });

  it('keeps the stat changes that were actually applied, not the ones the author now says', () => {
    // Switching the trait off negates these. Adopting an edited value would un-apply something that was
    // never applied and leave the stat permanently adrift.
    const saved = [T('brave', { statChanges: [{ statId: 'vigor', value: 10, type: 'max' }] })];
    const authored = [T('brave', { statChanges: [{ statId: 'vigor', value: 25, type: 'max' }] })];
    expect(refreshChosenTraits(saved, authored)[0].statChanges).toEqual([{ statId: 'vigor', value: 10, type: 'max' }]);
  });

  it('leaves a trait the world no longer has exactly as the save had it', () => {
    // Deleting and re-creating a trait mints a new id, so an unmatched trait is not reliably a deletion —
    // dropping it would strip it, and its effects, from every existing save.
    const saved = [T('gone', { name: 'Gone', aiDescription: 'still here' })];
    expect(refreshChosenTraits(saved, [])).toEqual(saved);
  });
});

describe('stat availability', () => {
  it('defaults to on, honors an authored off, and lets a trait switch it back on', () => {
    const stats = [S('a'), S('b', { enabled: false })];
    expect(activeStatEnabled(stats, [])).toEqual({ a: true, b: false });
    expect(activeStatEnabled(stats, [T('t', { statToggles: [{ statId: 'b', enabled: true }] })]))
      .toEqual({ a: true, b: true });
  });

  it('lets the later trait in authored order win a conflict', () => {
    const stats = [S('a')];
    const first = T('first', { statToggles: [{ statId: 'a', enabled: false }] });
    const last = T('last', { statToggles: [{ statId: 'a', enabled: true }] });
    expect(activeStatEnabled(stats, [first, last]).a).toBe(true);
    expect(activeStatEnabled(stats, [last, first]).a).toBe(false);
  });

  it('ignores a toggle naming a stat the world no longer has', () => {
    expect(activeStatEnabled([S('a')], [T('t', { statToggles: [{ statId: 'gone', enabled: false }] })]))
      .toEqual({ a: true });
  });

  it('filters a stat list to the live ones', () => {
    expect(enabledStats([S('a'), S('b')], { a: true, b: false }).map((s) => s.id)).toEqual(['a']);
  });
});

describe('placeholder pins', () => {
  it('collects pins, last active trait winning', () => {
    const early = T('early', { placeholderPins: [{ placeholderId: 'hair', value: 'brown' }] });
    const late = T('late', { placeholderPins: [{ placeholderId: 'hair', value: 'red' }] });
    expect(activePlaceholderPins([early, late])).toEqual({ hair: 'red' });
    expect(activePlaceholderPins([late, early])).toEqual({ hair: 'brown' });
  });

  it('skips half-filled editor rows so a blank pin never blanks a placeholder', () => {
    expect(activePlaceholderPins([
      T('t', { placeholderPins: [{ placeholderId: 'hair', value: '' }, { placeholderId: '', value: 'red' }] }),
    ])).toEqual({});
  });
});

describe('exclusive groups', () => {
  const groups = [G('excl', { exclusive: true }), G('plain')];
  const traits = [
    T('a', { groupId: 'excl' }), T('b', { groupId: 'excl' }),
    T('c', { groupId: 'plain' }), T('d', { groupId: 'plain' }),
    T('loose'),
  ];

  it('names the siblings an exclusive pick retires', () => {
    expect(exclusiveSiblings(traits[0], traits, groups)).toEqual(['b']);
  });

  it('retires nothing for a non-exclusive group or an ungrouped trait', () => {
    expect(exclusiveSiblings(traits[2], traits, groups)).toEqual([]);
    expect(exclusiveSiblings(traits[4], traits, groups)).toEqual([]);
  });
});

describe('conflict detection', () => {
  const groups = [G('excl', { exclusive: true, order: 0 }), G('plain', { order: 1 })];
  const vampire = T('vampire', { name: 'Vampire', order: 0, statToggles: [{ statId: 's1', enabled: true }] });
  const cured = T('cured', { name: 'Cured', order: 1, statToggles: [{ statId: 's1', enabled: false }] });
  const lone = T('lone', { name: 'Lone', order: 2, statToggles: [{ statId: 's2', enabled: true }] });

  it('names the rival and says the later trait wins', () => {
    const traits = [vampire, cured, lone];
    expect(traitConflicts(vampire, traits, groups).stats.s1)
      .toEqual({ others: [{ id: 'cured', name: 'Cured' }], winsHere: false });
    expect(traitConflicts(cured, traits, groups).stats.s1)
      .toEqual({ others: [{ id: 'vampire', name: 'Vampire' }], winsHere: true });
  });

  it('stays silent for a target nothing else claims', () => {
    expect(traitConflicts(lone, [vampire, cured, lone], groups).stats.s2).toBeUndefined();
  });

  it('does not flag exclusive siblings, which can never both be active', () => {
    const red = T('red', { name: 'Redhead', groupId: 'excl', order: 0, statToggles: [{ statId: 'sun', enabled: false }] });
    const raven = T('raven', { name: 'Raven', groupId: 'excl', order: 1, statToggles: [{ statId: 'sun', enabled: true }] });
    expect(traitConflicts(red, [red, raven], groups).stats.sun).toBeUndefined();
  });

  it('still flags a rival outside the exclusive group', () => {
    const red = T('red', { name: 'Redhead', groupId: 'excl', order: 0, statToggles: [{ statId: 'sun', enabled: false }] });
    const raven = T('raven', { name: 'Raven', groupId: 'excl', order: 1, statToggles: [{ statId: 'sun', enabled: true }] });
    const dyed = T('dyed', { name: 'Dyed', groupId: 'plain', order: 0, statToggles: [{ statId: 'sun', enabled: true }] });
    expect(traitConflicts(red, [red, raven, dyed], groups).stats.sun)
      .toEqual({ others: [{ id: 'dyed', name: 'Dyed' }], winsHere: false });
  });

  it('ignores half-filled rows rather than reporting a conflict on the empty id', () => {
    const a = T('a', { name: 'A', statToggles: [{ statId: '', enabled: true }] });
    const b = T('b', { name: 'B', statToggles: [{ statId: '', enabled: false }] });
    expect(traitConflicts(a, [a, b], [])).toEqual({ stats: {} });
  });
});

describe('collapseExclusiveDefaults', () => {
  const groups = [G('excl', { exclusive: true, order: 0 }), G('plain', { order: 1 })];
  const traits = [
    T('a', { groupId: 'excl', order: 0 }), T('b', { groupId: 'excl', order: 1 }),
    T('c', { groupId: 'plain', order: 0 }), T('d', { groupId: 'plain', order: 1 }),
    T('loose'),
  ];

  it('keeps only the first authored default per exclusive group', () => {
    expect(collapseExclusiveDefaults(['b', 'a', 'loose'], traits, groups)).toEqual(['a', 'loose']);
  });

  it('leaves non-exclusive groups and ungrouped traits alone', () => {
    expect(collapseExclusiveDefaults(['c', 'd', 'loose'], traits, groups)).toEqual(['c', 'd', 'loose']);
  });
});

describe('pins following a placeholder value rename', () => {
  const P = (placeholderId: string, value: string) => ({ placeholderId, value });
  // The author-visible operation: the editor's own edit to a value list, then the sweep the world runs over
  // it. Composed here so the tests state behavior, not the shape of the intermediate pairs.
  const afterEdit = (traits: Trait[], placeholderId: string, prev: string[], next: string[]) => {
    const before = phValues(prev);
    const after = reconcilePlaceholderValues(before, next);
    return repinRenamedValues(traits, placeholderId, renamedPlaceholderValues(before, after));
  };
  const pinsOf = (traits: Trait[]) => traits.map((t) => t.placeholderPins ?? []);

  it('carries a text-keyed pin onto the renamed value', () => {
    const traits = [T('t', { placeholderPins: [P('hair', 'Red')] })];
    expect(pinsOf(afterEdit(traits, 'hair', ['Red', 'Blue'], ['Crimson', 'Blue'])))
      .toEqual([[P('hair', 'Crimson')]]);
  });

  it('leaves pins alone when the values were only reordered', () => {
    const traits = [T('t', { placeholderPins: [P('hair', 'Red')] })];
    expect(afterEdit(traits, 'hair', ['Red', 'Blue'], ['Blue', 'Red'])).toBe(traits);
  });

  it('treats a delete plus an add as two edits, not a rename', () => {
    const traits = [T('t', { placeholderPins: [P('hair', 'Red')] })];
    // Each surviving value keeps its own id, so neither edit claims anything was renamed into anything.
    expect(afterEdit(traits, 'hair', ['Red', 'Blue'], ['Blue'])).toBe(traits);
    expect(afterEdit(traits, 'hair', ['Red', 'Blue'], ['Red', 'Blue', 'Green'])).toBe(traits);
  });

  it('reaches every trait in the world and every matching pin within a trait', () => {
    const traits = [
      T('a', { placeholderPins: [P('hair', 'Red'), P('eyes', 'Red')] }),
      T('b', { placeholderPins: [P('hair', 'Red')] }),
      T('c'),
    ];
    expect(pinsOf(afterEdit(traits, 'hair', ['Red'], ['Crimson']))).toEqual([
      [P('hair', 'Crimson'), P('eyes', 'Red')],
      [P('hair', 'Crimson')],
      [],
    ]);
  });

  it('never rewrites a custom pin the author typed off the value list', () => {
    const traits = [T('t', { placeholderPins: [P('hair', 'Ash-Gray')] })];
    expect(afterEdit(traits, 'hair', ['Red'], ['Crimson'])).toBe(traits);
  });

  it('leaves a half-filled pin row alone even when a blank value is renamed', () => {
    const traits = [T('t', { placeholderPins: [P('hair', ''), P('', 'Red')] })];
    expect(afterEdit(traits, 'hair', ['', 'Red'], ['Crimson', 'Red'])).toBe(traits);
  });

  it('carries the pin through each keystroke of a rename', () => {
    let traits = [T('t', { placeholderPins: [P('hair', 'Red')] })];
    traits = afterEdit(traits, 'hair', ['Red'], ['Re']);
    traits = afterEdit(traits, 'hair', ['Re'], ['Cr']);
    traits = afterEdit(traits, 'hair', ['Cr'], ['Crimson']);
    expect(pinsOf(traits)).toEqual([[P('hair', 'Crimson')]]);
  });

  it('leaves a pin naming its value by id alone — the id already follows the rename', () => {
    const traits = [T('t', { placeholderPins: [{ ...P('hair', 'Red'), valueId: phValueId('Red') }] })];
    expect(afterEdit(traits, 'hair', ['Red'], ['Crimson'])).toBe(traits);
  });
});

describe('pins naming their value by id', () => {
  const hair = (texts: string[]): Placeholder => ({ id: 'hair', name: 'Hair', values: phValues(texts) });

  it('reads the value’s current text, so a rename moves the pin with it', () => {
    const trait = T('t', { placeholderPins: [{ placeholderId: 'hair', value: 'Red', valueId: phValueId('Red') }] });
    // The stored text is the pin as written; the list has since been re-spelled under the same id.
    const renamed: Placeholder = { id: 'hair', name: 'Hair', values: [{ id: phValueId('Red'), text: 'Crimson' }] };
    expect(activePlaceholderPins([trait], [renamed])).toEqual({ hair: 'Crimson' });
  });

  it('falls back to the written text when the id names nothing', () => {
    const trait = T('t', { placeholderPins: [{ placeholderId: 'hair', value: 'Ash-Gray', valueId: 'v:gone' }] });
    expect(activePlaceholderPins([trait], [hair(['Red'])])).toEqual({ hair: 'Ash-Gray' });
  });

  it('names a picked value by id and leaves a typed one free text', () => {
    const pin = { placeholderId: 'hair', value: '' };
    expect(withPinnedValue(pin, 'Red', [hair(['Red', 'Blue'])]))
      .toEqual({ placeholderId: 'hair', value: 'Red', valueId: phValueId('Red') });
    expect(withPinnedValue(pin, 'Ash-Gray', [hair(['Red', 'Blue'])]))
      .toEqual({ placeholderId: 'hair', value: 'Ash-Gray' });
  });

  it('drops a stale id when the pin is retyped off the list', () => {
    const pin = { placeholderId: 'hair', value: 'Red', valueId: phValueId('Red') };
    expect(withPinnedValue(pin, 'Ash-Gray', [hair(['Red'])]))
      .toEqual({ placeholderId: 'hair', value: 'Ash-Gray' });
  });
});
