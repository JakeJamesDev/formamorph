import { describe, expect, it } from 'vitest';
import { applyPreset, emptyEntryDraft, entryDefaults, matchPreset, type EntryDraft, type EntryTraitWorld, type PresetPlaces } from './entryDraft';
import type { Entity, GameLocation, PresetRow, PresetValue, PresetWorldOption, Trait, TraitGroup, TraitRequirementRow, WorldOption } from '@/types';

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
    expect(notice.off).toEqual([{ ownerId: null, traitId: 'torch' }]);
    expect(draft.cascadeOffTraitIds).toEqual({ global: ['torch'], owners: {} });
    expect(notice.value.id).toBe('dark');
  });

  it('skips a row it cannot apply, names it, and applies the rest', () => {
    const stale: PresetRow[] = [
      opt('secret', true), opt('gone', 1), opt('start', 'hot'), opt('size', 'huge'), opt('heat', 'warm'),
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

describe('applyPreset trait rows', () => {
  const group = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({ id, name: id, parentId: null, ...extra });
  const groups = [group('race', { minPicks: 1, maxPicks: 1 }), group('bg', { minPicks: 1, maxPicks: 1 }), group('perks', { maxPicks: 2 })];
  const not = (id: string): TraitRequirementRow => ({ all: [{ kind: 'trait', id, not: true }] });
  const t = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
  const rootTraits: Trait[] = [
    t('elf', { groupId: 'race', isDefault: true }), t('orc', { groupId: 'race' }),
    t('evil', { requires: [not('elf')] }), t('pacifist'), t('berserker', { requires: [not('pacifist')] }),
    t('mage', { requires: [{ all: [{ kind: 'trait', id: 'elf' }] }] }), t('easy', { isDefault: true }),
    t('farmer', { groupId: 'bg', isDefault: true }), t('noble', { groupId: 'bg' }),
    t('quick', { groupId: 'perks' }), t('strong', { groupId: 'perks' }), t('tough', { groupId: 'perks' }),
    t('blessed', { mode: 'alwaysOn' }),
  ];
  const wolf: Entity = {
    id: 'wolf', name: 'Wolf', traitGroups: [group('temper', { maxPicks: 1 })],
    traits: [t('tame', { groupId: 'temper', isDefault: true }), t('feral', { groupId: 'temper' })],
  };
  const on = (traitId: string, ownerId?: string): PresetRow => ({ kind: 'trait', traitId, on: true, ...(ownerId ? { ownerId } : {}) });
  const off = (traitId: string): PresetRow => ({ kind: 'trait', traitId, on: false });
  const worldOf = (start: PresetWorldOption): EntryTraitWorld => ({ traits: rootTraits, traitGroups: groups, entities: [wolf], library: [], options: [start] });
  const run = (mode: PresetWorldOption['mode'], rows: PresetRow[], picks: Partial<EntryDraft> = {}) => {
    const start = preset(mode, [value('v', rows)]);
    const world = worldOf(start);
    const before = { ...startDraft(world), ...picks };
    return { before, world, start, ...applied(before, world, start, 'v') };
  };

  it('applies Orc and Evil from Elf, which blocks Evil', () => {
    const { before, draft, notice } = run('overlay', [on('orc'), on('evil')]);
    expect(before.traitIds).toContain('elf');
    expect(draft.traitIds).toEqual(expect.arrayContaining(['orc', 'evil']));
    expect(draft.traitIds).not.toContain('elf');
    expect(notice.skipped).toEqual([]);
  });

  it('wins a Not conflict against an unlisted pick, which goes to cascade-off', () => {
    const { draft, notice } = run('overlay', [on('berserker')], { traitIds: ['elf', 'farmer', 'pacifist'] });
    expect(draft.traitIds).toContain('berserker');
    expect(draft.traitIds).not.toContain('pacifist');
    expect(draft.cascadeOffTraitIds.global).toContain('pacifist');
    expect(notice.off).toContainEqual({ ownerId: null, traitId: 'pacifist' });
    expect(notice.skipped).toEqual([]);
  });

  it('turns a pick off with an off-row, and never returns it from cascade-off', () => {
    const { draft } = run('overlay', [off('easy')], { cascadeOffTraitIds: { global: ['easy'] } });
    expect(draft.traitIds).not.toContain('easy');
    expect(draft.cascadeOffTraitIds.global ?? []).not.toContain('easy');
  });

  it('fills a group its off-row leaves short, never with the trait it turned off', () => {
    const { draft, notice } = run('overlay', [off('farmer')]);
    expect(draft.traitIds).toContain('noble');
    expect(draft.traitIds).not.toContain('farmer');
    expect(notice.on).toContainEqual({ ownerId: null, traitId: 'noble' });
  });

  it('makes room in a full group by dropping the latest unlisted pick', () => {
    const { draft } = run('overlay', [on('tough')], { traitIds: ['elf', 'farmer', 'quick', 'strong'] });
    expect(draft.traitIds).toEqual(expect.arrayContaining(['quick', 'tough']));
    expect(draft.traitIds).not.toContain('strong');
  });

  it('skips a row its own rows leave no room for', () => {
    const rows = [on('quick'), on('strong'), on('tough')];
    const { draft, notice } = run('overlay', rows);
    expect(draft.traitIds).toEqual(expect.arrayContaining(['quick', 'strong']));
    expect(notice.skipped).toEqual([rows[2]]);
  });

  it('under a snapshot, resets unlisted traits to the defaults and clears cascade-off', () => {
    const picks = { traitIds: ['orc', 'noble', 'pacifist'], cascadeOffTraitIds: { global: ['easy'] } };
    const { draft } = run('snapshot', [on('quick')], picks);
    expect(new Set(draft.traitIds)).toEqual(new Set(['elf', 'farmer', 'easy', 'quick', 'blessed']));
    expect(draft.cascadeOffTraitIds.global).toEqual([]);
  });

  it('under an overlay, keeps unlisted picks', () => {
    const { draft } = run('overlay', [on('quick')], { traitIds: ['orc', 'noble', 'pacifist'] });
    expect(draft.traitIds).toEqual(expect.arrayContaining(['orc', 'noble', 'pacifist', 'quick']));
  });

  it('applies an owned row to that entity, and skips one whose owner is not in the cast', () => {
    const ghost = on('feral', 'ghost');
    const { draft, notice } = run('overlay', [on('feral', 'wolf'), ghost]);
    expect(draft.ownedTraitIds.wolf).toEqual(['feral']);
    expect(draft.traitIds).not.toContain('feral');
    expect(notice.on).toContainEqual({ ownerId: 'wolf', traitId: 'feral' });
    expect(notice.skipped).toEqual([ghost]);
  });

  it('applies an owned row for a Blueprint trait the entity links (Q42)', () => {
    const smite = t('smite', { groupId: 'bp' });
    const hound: Entity = { id: 'hound', name: 'Hound', traitLinks: [{ id: 'l', originalId: 'smite', kind: 'trait', originalName: 'Smite', groupId: null }] };
    const start = preset('overlay', [value('v', [on('smite', 'hound')])]);
    const world: EntryTraitWorld = {
      traits: [...rootTraits, smite], traitGroups: [...groups, group('bp', { system: 'blueprints' })], entities: [hound], library: [], options: [start],
    };
    const { draft, notice } = applied(startDraft(world), world, start, 'v');
    expect(draft.ownedTraitIds.hound).toEqual(['smite']);
    expect(draft.traitIds).not.toContain('smite');
    expect(notice.skipped).toEqual([]);
  });

  it('skips a row that fails after the settle, an Always On row and a deleted trait, and applies the rest', () => {
    const failing = [on('mage'), off('blessed'), on('gone')];
    const { draft, notice } = run('overlay', [on('orc'), ...failing]);
    expect(draft.traitIds).toContain('orc');
    expect(draft.traitIds).toContain('blessed');
    expect(notice.skipped).toEqual(failing);
  });

  it('names every trait it turned on and off', () => {
    const { notice } = run('overlay', [on('orc'), on('evil'), off('easy')]);
    expect(notice.on).toEqual([{ ownerId: null, traitId: 'orc' }, { ownerId: null, traitId: 'evil' }]);
    expect(notice.off).toEqual(expect.arrayContaining([{ ownerId: null, traitId: 'elf' }, { ownerId: null, traitId: 'easy' }]));
    expect(notice.off).toHaveLength(2);
  });
});

describe('matchPreset trait rows', () => {
  const traitsOf: Trait[] = [
    { id: 'elf', name: 'Elf', statChanges: [], groupId: 'race', isDefault: true },
    { id: 'orc', name: 'Orc', statChanges: [], groupId: 'race' },
    { id: 'evil', name: 'Evil', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'elf', not: true }] }] },
    { id: 'pet', name: 'Pet', statChanges: [] },
  ];
  const race: TraitGroup = { id: 'race', name: 'Race', parentId: null, minPicks: 1, maxPicks: 1 };
  const rows: PresetRow[] = [{ kind: 'trait', traitId: 'orc', on: true }, { kind: 'trait', traitId: 'evil', on: true }];
  const setUp = (mode: PresetWorldOption['mode']) => {
    const start = preset(mode, [value('dark', rows)]);
    const world: EntryTraitWorld = { traits: traitsOf, traitGroups: [race], entities: [], library: [], options: [start] };
    return { start, world, draft: applied(startDraft(world), world, start, 'dark').draft };
  };

  it('selects the value just applied, and clears when the player turns off a trait it set', () => {
    const { start, world, draft } = setUp('overlay');
    expect(matchPreset(draft, world, start)).toBe('dark');
    expect(matchPreset({ ...draft, traitIds: draft.traitIds.filter((id) => id !== 'evil') }, world, start)).toBeNull();
  });

  it('under an overlay ignores an unlisted trait; under a snapshot does not', () => {
    const overlay = setUp('overlay');
    expect(matchPreset({ ...overlay.draft, traitIds: [...overlay.draft.traitIds, 'pet'] }, overlay.world, overlay.start)).toBe('dark');
    const snapshot = setUp('snapshot');
    expect(matchPreset(snapshot.draft, snapshot.world, snapshot.start)).toBe('dark');
    expect(matchPreset({ ...snapshot.draft, traitIds: [...snapshot.draft.traitIds, 'pet'] }, snapshot.world, snapshot.start)).toBeNull();
  });
});

describe('applyPreset persona and location rows', () => {
  const playingAs = (id: string): TraitRequirementRow => ({ all: [{ kind: 'playingAs', id }] });
  const person = (id: string, extra: Partial<Entity> = {}): Entity =>
    ({ id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', ...extra });
  // The knight starts at the keep, and only the knight can take the squire trait or swear its oath.
  const knight = person('knight', {
    persona: true, locations: ['keep'], traits: [{ id: 'oath', name: 'Oath', statChanges: [], requires: [playingAs('knight')] }],
  });
  const rogue = person('rogue', { persona: true, locations: ['den'] });
  const hermit = person('hermit', { customPersona: true });
  const npc = person('npc', { locations: ['cave'] });
  const place = (id: string, isStarting = false): GameLocation => ({ id, name: id, description: '', isStarting });
  const locations = [place('town', true), place('keep'), place('den'), place('cave'), place('walls', true)];
  const rootTraits: Trait[] = [
    { id: 'squire', name: 'Squire', statChanges: [], requires: [playingAs('knight')] },
    { id: 'pet', name: 'Pet', statChanges: [] },
    { id: 'armor', name: 'Armor', statChanges: [], isDefault: true, requires: [playingAs('knight')] },
  ];
  // The walls are open only while the lanterns are lit.
  const places: PresetPlaces = {
    allowed: 'any', worldEntities: [knight, rogue, hermit, npc], locations,
    openLocationIds: (draft) => new Set(locations.filter((l) => l.id !== 'walls' || draft.optionValues.lit !== false).map((l) => l.id)),
  };
  const persona = (entityId: string): PresetRow => ({ kind: 'persona', entityId });
  const at = (locationId: string): PresetRow => ({ kind: 'location', locationId });
  const on = (traitId: string, ownerId?: string): PresetRow => ({ kind: 'trait', traitId, on: true, ...(ownerId ? { ownerId } : {}) });
  const setUp = (mode: PresetWorldOption['mode'], rows: PresetRow[], picks: Partial<EntryDraft> = {}) => {
    const start = preset(mode, [value('v', rows)]);
    const world: EntryTraitWorld = { traits: rootTraits, traitGroups: [], entities: [knight, rogue, hermit, npc], library: [], options: [LIT, start] };
    const before: EntryDraft = { ...startDraft(world), ...picks };
    return { start, world, before, ...applyPreset(before, world, start, 'v', places)! };
  };

  it('sets the Starting Location as a click does, so a later persona change keeps it (Q34)', () => {
    const { draft, notice } = setUp('overlay', [at('walls')]);
    expect(draft).toMatchObject({ locationId: 'walls', locationChosen: true });
    expect(notice).toMatchObject({ locationId: 'walls', skipped: [] });
    expect(notice.persona).toBeUndefined();
  });

  it('picks a world persona as a click does, and the location follows to its start (Q33)', () => {
    const { draft, notice } = setUp('overlay', [persona('knight')], { locationId: 'town' });
    expect(draft).toMatchObject({ persona: { source: 'world', entityId: 'knight' }, locationId: 'keep', locationChosen: false });
    expect(notice).toMatchObject({ persona: { source: 'world', entityId: 'knight' }, locationId: 'keep' });
  });

  it('under a snapshot with no persona or location row, keeps both (Q9)', () => {
    const picks = { persona: { source: 'world', entityId: 'rogue' } as const, locationId: 'den', locationChosen: true, traitIds: ['pet'] };
    const { draft, notice } = setUp('snapshot', [opt('lit', false)], picks);
    expect(draft).toMatchObject({ persona: picks.persona, locationId: 'den', locationChosen: true, traitIds: [] });
    expect(notice.persona).toBeUndefined();
    expect(notice.locationId).toBeUndefined();
  });

  it('applies a persona row and the rows that need that persona in one click, on its defaults (Q38)', () => {
    const { draft, notice } = setUp('snapshot', [on('squire'), on('oath', 'knight'), persona('knight')]);
    expect(draft.persona).toEqual({ source: 'world', entityId: 'knight' });
    expect([...draft.traitIds].sort()).toEqual(['armor', 'squire']);
    expect(draft.ownedTraitIds.knight).toEqual(['oath']);
    expect(notice.skipped).toEqual([]);
  });

  it('checks a location row against the persona and Options the click leaves', () => {
    // The rogue's den is offered only once the rogue is picked; the walls close with the lanterns.
    expect(setUp('overlay', [at('den'), persona('rogue')]).draft.locationId).toBe('den');
    const closed = [opt('lit', false), at('walls')];
    expect(setUp('overlay', closed)).toMatchObject({ draft: { locationId: null }, notice: { skipped: [closed[1]] } });
  });

  it('skips a persona or location row it cannot pick, and applies the rest (Q35, Q36)', () => {
    const stale = [persona('npc'), persona('gone'), at('cave'), at('nowhere')];
    const { draft, notice } = setUp('overlay', [...stale, on('pet')]);
    expect(notice.skipped).toEqual(stale);
    expect(draft).toMatchObject({ persona: { source: 'none' }, locationId: null, traitIds: ['pet'] });
  });

  it('skips persona and location rows without the world places to read', () => {
    const start = preset('overlay', [value('v', [persona('knight'), at('town')])]);
    const world: EntryTraitWorld = { traits: rootTraits, traitGroups: [], entities: [knight], library: [], options: [start] };
    expect(applyPreset(startDraft(world), world, start, 'v')!.notice.skipped).toHaveLength(2);
  });

  it('picks the Custom Persona as None, keeping the name the player entered', () => {
    const named = { source: 'none', name: 'Ash' } as const;
    expect(setUp('overlay', [persona('hermit')], { persona: named }).draft.persona).toEqual(named);
    expect(setUp('overlay', [persona('hermit')], { persona: { source: 'world', entityId: 'rogue' } }).draft.persona).toEqual({ source: 'none' });
  });

  it('matches a persona and location only when a row names them', () => {
    const named = setUp('overlay', [persona('rogue'), at('town')]);
    expect(matchPreset(named.draft, named.world, named.start, places)).toBe('v');
    expect(matchPreset({ ...named.draft, locationId: 'den' }, named.world, named.start, places)).toBeNull();
    expect(matchPreset({ ...named.draft, persona: { source: 'world', entityId: 'knight' } }, named.world, named.start, places)).toBeNull();
    const unnamed = setUp('snapshot', [opt('lit', false)]);
    const moved = { ...unnamed.draft, persona: { source: 'world', entityId: 'rogue' } as const, locationId: 'den' };
    expect(matchPreset(moved, unnamed.world, unnamed.start, places)).toBe('v');
  });
});
