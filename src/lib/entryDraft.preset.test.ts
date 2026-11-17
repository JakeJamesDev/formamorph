import { describe, expect, it } from 'vitest';
import { applyPreset, emptyEntryDraft, entryDefaults, matchPreset, type EntryDraft, type EntryTraitWorld } from './entryDraft';
import type { PresetRow, PresetValue, PresetWorldOption, Trait, WorldOption } from '@/types';

const SIZE: WorldOption = {
  id: 'size', name: 'Size', type: 'choice', shownToPlayer: true, midGame: false,
  values: [{ id: 'small', name: 'Small' }, { id: 'big', name: 'Big' }], default: 'small',
};
const LIT: WorldOption = { id: 'lit', name: 'Lanterns Lit', type: 'boolean', shownToPlayer: true, midGame: false, default: true };
const HEAT: WorldOption = { id: 'heat', name: 'Heat', type: 'number', shownToPlayer: true, midGame: false, min: 0, max: 10, default: 3 };
const SECRET: WorldOption = { id: 'secret', name: 'Secret', type: 'boolean', shownToPlayer: false, midGame: false, default: false };

// The torch needs the lanterns lit; the cloak is a plain default pick.
const traits: Trait[] = [
  { id: 'torch', name: 'Torch', statChanges: [], isDefault: true, requires: [{ all: [{ kind: 'option', id: 'lit' }] }] },
  { id: 'cloak', name: 'Cloak', statChanges: [], isDefault: true },
];

const value = (id: string, rows: PresetRow[]): PresetValue => ({ id, name: id, description: '', rows });
const opt = (optionId: string, v: string | boolean | number): PresetRow => ({ kind: 'option', optionId, value: v });
const preset = (mode: PresetWorldOption['mode'], values: PresetValue[]): PresetWorldOption => ({ id: 'start', name: 'Start', type: 'preset', mode, values });

const worldWith = (start: PresetWorldOption): EntryTraitWorld => ({
  traits, traitGroups: [], entities: [], library: [], options: [SIZE, LIT, HEAT, SECRET, start],
});
const startDraft = (world: EntryTraitWorld, optionValues = {}): EntryDraft =>
  ({ ...emptyEntryDraft(), ...entryDefaults(world, { source: 'none' }), optionValues });
const applied = (draft: EntryDraft, world: EntryTraitWorld, start: PresetWorldOption, id: string) => applyPreset(draft, world, start, id)!;

describe('applyPreset', () => {
  it('sets the listed Options and an overlay keeps the unlisted ones', () => {
    const start = preset('overlay', [value('hot', [opt('heat', 9), opt('size', 'big')])]);
    const world = worldWith(start);
    const { draft } = applied(startDraft(world, { lit: false, heat: 1 }), world, start, 'hot');
    expect(draft.optionValues).toEqual({ lit: false, heat: 9, size: 'big' });
  });

  it('under a snapshot, puts every unlisted Option back on its default', () => {
    const start = preset('snapshot', [value('hot', [opt('heat', 9)])]);
    const world = worldWith(start);
    const { draft } = applied(startDraft(world, { lit: false, size: 'big' }), world, start, 'hot');
    expect(draft.optionValues).toEqual({ heat: 9 });
  });

  it('settles the picks against the new Options and reports what turned off', () => {
    const start = preset('overlay', [value('dark', [opt('lit', false)])]);
    const world = worldWith(start);
    const before = startDraft(world);
    expect(before.traitIds).toEqual(expect.arrayContaining(['torch', 'cloak']));
    const { draft, notice } = applied(before, world, start, 'dark');
    expect(draft.traitIds).toEqual(['cloak']);
    expect(notice.turnedOff).toEqual([{ ownerId: null, traitId: 'torch' }]);
    expect(draft.cascadeOffTraitIds).toEqual({ global: ['torch'], owners: {} });
    expect(notice.value.id).toBe('dark');
  });

  it('skips a row it cannot apply, names it, and applies the rest', () => {
    const stale: PresetRow[] = [
      opt('secret', true), opt('gone', 1), opt('start', 'hot'), opt('size', 'huge'), opt('heat', 'warm'),
      { kind: 'trait', traitId: 'cloak', on: false },
    ];
    const start = preset('overlay', [value('hot', [...stale, opt('heat', 9)])]);
    const world = worldWith(start);
    const { draft, notice } = applied(startDraft(world), world, start, 'hot');
    expect(notice.skipped).toEqual(stale);
    expect(draft.optionValues).toEqual({ heat: 9 });
  });

  it('is null for a value the Preset does not have', () => {
    const start = preset('overlay', [value('hot', [opt('heat', 9)])]);
    const world = worldWith(start);
    expect(applyPreset(startDraft(world), world, start, 'cold')).toBeNull();
  });
});

describe('matchPreset', () => {
  it('selects the value just applied, and clears when a listed Option changes', () => {
    const start = preset('overlay', [value('hot', [opt('heat', 9)]), value('cold', [opt('heat', 0)])]);
    const world = worldWith(start);
    const base = startDraft(world);
    expect(matchPreset(base, world, start)).toBeNull();
    const { draft } = applied(base, world, start, 'cold');
    expect(matchPreset(draft, world, start)).toBe('cold');
    expect(matchPreset({ ...draft, optionValues: { ...draft.optionValues, heat: 4 } }, world, start)).toBeNull();
  });

  it('under an overlay, ignores what the value does not list', () => {
    const start = preset('overlay', [value('hot', [opt('heat', 9)])]);
    const world = worldWith(start);
    const { draft } = applied(startDraft(world), world, start, 'hot');
    expect(matchPreset({ ...draft, optionValues: { ...draft.optionValues, size: 'big' } }, world, start)).toBe('hot');
  });

  it('under a snapshot, needs every unlisted Option on its default', () => {
    const start = preset('snapshot', [value('hot', [opt('heat', 9)])]);
    const world = worldWith(start);
    const { draft } = applied(startDraft(world), world, start, 'hot');
    expect(matchPreset(draft, world, start)).toBe('hot');
    expect(matchPreset({ ...draft, optionValues: { ...draft.optionValues, size: 'big' } }, world, start)).toBeNull();
  });

  it('selects the first value in authored order when two match', () => {
    const start = preset('overlay', [value('first', [opt('heat', 9)]), value('second', [opt('heat', 9), opt('lit', true)])]);
    const world = worldWith(start);
    const { draft } = applied(startDraft(world), world, start, 'second');
    expect(matchPreset(draft, world, start)).toBe('first');
  });

  it('never selects a value with no rows, or none that applies (Q21)', () => {
    const start = preset('overlay', [value('empty', []), value('stale', [opt('gone', 1)])]);
    const world = worldWith(start);
    expect(matchPreset(startDraft(world), world, start)).toBeNull();
    const snapshot = preset('snapshot', [value('empty', [])]);
    const snapWorld = worldWith(snapshot);
    expect(matchPreset(startDraft(snapWorld), snapWorld, snapshot)).toBeNull();
  });
});
