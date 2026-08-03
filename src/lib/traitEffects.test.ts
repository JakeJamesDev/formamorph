import { describe, it, expect } from 'vitest';
import type { PlayerStat, Stat, Trait, TraitGroup } from '@/types';
import {
  traitOrderIndex,
  inAuthoredOrder,
  invertStatChanges,
  activeStatEnabled,
  enabledStats,
  activePlaceholderPins,
  exclusiveSiblings,
  traitConflicts,
  collapseExclusiveDefaults,
} from './traitEffects';
import { applyTraitStatChanges } from './statChanges';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges: [], ...extra,
});
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({
  id, name: id, parentId: null, ...extra,
});
const S = (id: string, extra: Partial<Stat> = {}): Stat => ({
  id, name: id, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...extra,
});
const PS = (id: string, extra: Partial<PlayerStat> = {}): PlayerStat => ({
  ...(S(id) as Omit<Stat, 'value'>), value: 50, ...extra,
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

describe('stat-change reversal', () => {
  it('negates every change', () => {
    expect(invertStatChanges([
      { statId: 's', value: 5, type: 'max' },
      { statId: 's', value: -3, type: 'regen' },
    ])).toEqual([
      { statId: 's', value: -5, type: 'max' },
      { statId: 's', value: 3, type: 'regen' },
    ]);
  });

  it('restores min/max/regen/starting when applied on top of the original', () => {
    const before = [PS('s', { value: 40, min: 0, max: 100, regen: 1 })];
    const changes = [
      { statId: 's', value: 10, type: 'min' as const },
      { statId: 's', value: 20, type: 'max' as const },
      { statId: 's', value: 2, type: 'regen' as const },
      { statId: 's', value: 5, type: 'starting' as const },
    ];
    const floors = { s: 0 };
    const on = applyTraitStatChanges(before, changes, floors).stats;
    expect(on[0]).toMatchObject({ min: 10, max: 120, regen: 3, value: 45 });
    const off = applyTraitStatChanges(on, invertStatChanges(changes), floors).stats;
    expect(off[0]).toMatchObject({ min: 0, max: 100, regen: 1, value: 40 });
  });

  it('survives a switch off and back on without drift', () => {
    const changes = [{ statId: 's', value: 15, type: 'starting' as const }];
    let stats = [PS('s', { value: 30 })];
    for (let i = 0; i < 3; i++) {
      stats = applyTraitStatChanges(stats, changes).stats;
      stats = applyTraitStatChanges(stats, invertStatChanges(changes)).stats;
    }
    expect(stats[0].value).toBe(30);
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
      .toEqual({ others: ['Cured'], winsHere: false });
    expect(traitConflicts(cured, traits, groups).stats.s1)
      .toEqual({ others: ['Vampire'], winsHere: true });
  });

  it('stays silent for a target nothing else claims', () => {
    expect(traitConflicts(lone, [vampire, cured, lone], groups).stats.s2).toBeUndefined();
  });

  it('does not flag exclusive siblings, which can never both be active', () => {
    const red = T('red', { name: 'Redhead', groupId: 'excl', order: 0, placeholderPins: [{ placeholderId: 'hair', value: 'red' }] });
    const raven = T('raven', { name: 'Raven', groupId: 'excl', order: 1, placeholderPins: [{ placeholderId: 'hair', value: 'black' }] });
    expect(traitConflicts(red, [red, raven], groups).placeholders.hair).toBeUndefined();
  });

  it('still flags a rival outside the exclusive group', () => {
    const red = T('red', { name: 'Redhead', groupId: 'excl', order: 0, placeholderPins: [{ placeholderId: 'hair', value: 'red' }] });
    const raven = T('raven', { name: 'Raven', groupId: 'excl', order: 1, placeholderPins: [{ placeholderId: 'hair', value: 'black' }] });
    const dyed = T('dyed', { name: 'Dyed', groupId: 'plain', order: 0, placeholderPins: [{ placeholderId: 'hair', value: 'green' }] });
    expect(traitConflicts(red, [red, raven, dyed], groups).placeholders.hair)
      .toEqual({ others: ['Dyed'], winsHere: false });
  });

  it('ignores half-filled rows rather than reporting a conflict on the empty id', () => {
    const a = T('a', { name: 'A', statToggles: [{ statId: '', enabled: true }] });
    const b = T('b', { name: 'B', statToggles: [{ statId: '', enabled: false }] });
    expect(traitConflicts(a, [a, b], [])).toEqual({ stats: {}, placeholders: {} });
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
