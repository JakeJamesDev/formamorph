/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import type { PlaceholderOwners } from './placeholderHomes';
import { phValues } from '@/test/placeholderValues';
import type { Dictionary, Entity, PersonaRef, Placeholder, PlayerStat } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

const ph = (id: string, name: string, values: string[]): Placeholder => ({ id, name, values: phValues(values) });

// The world has a Hair of its own, Molly owns another, and two books are both called Weather.
const worldHair = ph('world-hair', 'Hair', ['plain']);
const probe = ph('probe', 'Probe', ['unset']);
const mollyHair = ph('molly-hair', 'Hair', ['auburn']);
const firstSky = ph('first-sky', 'Sky', ['clear']);
const laterSky = ph('later-sky', 'Sky', ['overcast']);
const miraMark = ph('mira-mark', 'Mark', ['scar']);
const lyraEyes = ph('lyra-eyes', 'Eyes', ['green']);

const molly: Entity = { id: 'molly', name: 'Molly', placeholders: [mollyHair] };
const rook: Entity = { id: 'rook', name: 'Rook' };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, placeholders: [miraMark] };
const lyra: Entity = { id: 'lyra', name: 'Lyra', placeholders: [lyraEyes] };

const list = [worldHair, probe, mollyHair, miraMark, firstSky, laterSky];
const owners: PlaceholderOwners = new Map([
  ['molly-hair', { kind: 'entity', id: 'molly', name: 'Molly' }],
  ['mira-mark', { kind: 'entity', id: 'mira', name: 'Mira' }],
  ['first-sky', { kind: 'dictionary', id: 'first-weather', name: 'Weather' }],
  ['later-sky', { kind: 'dictionary', id: 'later-weather', name: 'Weather' }],
]);
const dictionaries = [{ id: 'first-weather', name: 'Weather' }, { id: 'later-weather', name: 'Weather' }, { id: 'lore', name: 'Lore' }];

/** The trait state of a playthrough under `persona`, the library persona among its library entities. */
function played(persona: PersonaRef, library: Entity[] = []): StatCodeBearers {
  const entities = [molly, rook, mira];
  const entered = [...withPersonaEntry(entities, persona, library[0]?.name)];
  return {
    acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: {}, entities, library,
    world: {
      traits: [], groups: [], entities: entered, persona,
      bearers: inPlayBearers({ traits: [], traitGroups: [], entities: entered }, persona, library),
    },
  };
}

const asLyra: PersonaRef = { source: 'library', entityId: 'lyra' };
const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

const run = (code: string, traits: StatCodeBearers = played(asLyra, [lyra])) => runStatCodeTurn({
  stats: [stat({ id: 's0', name: 'S0', value: 0, code })],
  enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: traits,
  placeholders: { placeholders: list, owners, dictionaries, rolls: { world: {} } },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
} satisfies StatCodeTurn);

const valueOf = (out: { stats: readonly PlayerStat[] }) => out.stats.find((s) => s.id === 's0')?.value;

describe('runStatCodeTurn owner placeholders', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads an entity’s placeholder through its entry, and pins it on that placeholder’s id', async () => {
    const out = await run('placeholders.Probe.pin(entities.Molly.placeholders.Hair.value); entities.Molly.placeholders.Hair.pin("red");');
    expect(out.pinWrites).toEqual({ probe: 'auburn', 'molly-hair': 'red' });
  });

  it('holds one pin state for a placeholder reached through persona and through its entities entry', async () => {
    const out = await run('entities.Mira.placeholders.Mark.pin("burn"); placeholders.Probe.pin(persona.placeholders.Mark.value);',
      played(asMira));
    expect(out.pinWrites).toEqual({ 'mira-mark': 'burn', probe: 'burn' });
  });

  it('names an owned placeholder by its owner’s route in what a bad write reports', async () => {
    await run('entities.Molly.placeholders.Hair.id = "x"; persona.placeholders.Nope.name = "y"; dictionaries.Weather.placeholders.Sky.name = "z";');
    const warned = vi.mocked(console.warn).mock.calls.flat().join('\n');
    expect(warned).toContain('entities.Molly.placeholders.Hair.id');
    // The played persona is an `entities` entry, so its route names it there.
    expect(warned).toContain('entities.Lyra.placeholders.Nope.name');
    expect(warned).toContain('dictionaries.Weather.placeholders.Sky.name');
    await run('entities.Molly.placeholders.Hair.pin({});');
    expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain('entities.Molly.placeholders.Hair.value must be text');
  });

  it('does not reach an owned placeholder through placeholders', async () => {
    const out = await run('const blank = placeholders.Molly.Hair === undefined && placeholders.Sky.value === "";'
      + ' placeholders.Probe.pin(blank ? "blank" : "reached");');
    expect(out.pinWrites).toEqual({ probe: 'blank' });
  });

  it('reads the played library persona’s placeholder through persona, and pins it as a Code Pin on its id', async () => {
    const code = 'placeholders.Probe.pin(persona.placeholders.Eyes.value); persona.placeholders.Eyes.pin("gold");'
      + ' return persona.placeholders === entities.Lyra.placeholders ? 1 : 0;';
    const out = await run(code);
    expect(out.pinWrites).toEqual({ probe: 'green', 'lyra-eyes': 'gold' });
    expect(valueOf(out)).toBe(1);
  });

  it('reads the played world persona’s placeholder through persona', async () => {
    const out = await run('placeholders.Probe.pin(persona.placeholders.Mark.value);', played(asMira));
    expect(out.pinWrites).toEqual({ probe: 'scar' });
  });

  it('reads an added character’s placeholder through its entry, and pins it as a Code Pin on its id', async () => {
    const pip: Entity = { id: 'pip', name: 'Pip', placeholders: [ph('pip-tag', 'Tag', ['loyal'])] };
    // Pip plays beside a library persona, whose pool joins first.
    const out = await run('placeholders.Probe.pin(entities.Pip.placeholders.Tag.value); entities.Pip.placeholders.Tag.pin("sly");',
      played(asLyra, [lyra, pip]));
    expect(out.pinWrites).toEqual({ probe: 'loyal', 'pip-tag': 'sly' });
  });

  it('reads and pins a library dictionary’s placeholder through its entry, after the authored books', async () => {
    const tides: Dictionary = { id: 'run-tides', name: 'Tides', entries: [], placeholders: [ph('tide', 'Tide', ['ebb'])] };
    // A library book that shares an authored book's code name wins it, as the later book does.
    const weather: Dictionary = { id: 'run-weather', name: 'Weather', entries: [], placeholders: [ph('lib-sky', 'Sky', ['hail'])] };
    const code = 'placeholders.Probe.pin(dictionaries.Tides.placeholders.Tide.value + "/" + dictionaries.Weather.placeholders.Sky.value);'
      + ' dictionaries.Tides.placeholders.Tide.pin("flood");'
      + ' return dictionaries.Tides.id === "run-tides" && dictionaries.Weather.id === "run-weather" ? 1 : 0;';
    const out = await runStatCodeTurn({
      stats: [stat({ id: 's0', name: 'S0', value: 0, code })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(asLyra, [lyra]),
      placeholders: { placeholders: list, owners, dictionaries, libraryDictionaries: [tides, weather], rolls: { world: {} } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(out.pinWrites).toEqual({ probe: 'ebb/hail', tide: 'flood' });
    expect(valueOf(out)).toBe(1);
  });

  it('keeps added characters’ and library books’ placeholders out of placeholders', async () => {
    const pip: Entity = { id: 'pip', name: 'Pip', placeholders: [ph('pip-tag', 'Tag', ['loyal'])] };
    const tides: Dictionary = { id: 'run-tides', name: 'Tides', entries: [], placeholders: [ph('tide', 'Tide', ['ebb'])] };
    const out = await runStatCodeTurn({
      stats: [stat({ id: 's0', name: 'S0', value: 0, code: 'placeholders.Tag.pin("x"); placeholders.Tide.pin("y");' })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(asMira, [pip]),
      placeholders: { placeholders: list, owners, dictionaries, libraryDictionaries: [tides], rolls: { world: {} } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(out.pinWrites).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('the world does not have: Tag, Tide'));
  });

  it('keeps the library persona’s placeholders out of placeholders', async () => {
    // `placeholders.Lyra` is a blank entry, not an owner node, so nothing hangs below it.
    const out = await run('const blank = placeholders.Lyra.value === "" && placeholders.Lyra.Eyes === undefined;'
      + ' placeholders.Eyes.pin("x"); return blank ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
    expect(out.pinWrites).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('the world does not have: Eyes'));
  });

  it('reads and pins a dictionary’s placeholder through its entry, the later of two same-named books winning', async () => {
    const code = 'placeholders.Probe.pin(dictionaries.Weather.placeholders.Sky.value); dictionaries.Weather.placeholders.Sky.pin("storm");'
      + ' return dictionaries.Weather.id === "later-weather" && dictionaries.Weather.name === "Weather" && dictionaries.Lore.id === "lore" ? 1 : 0;';
    const out = await run(code);
    expect(out.pinWrites).toEqual({ probe: 'overcast', 'later-sky': 'storm' });
    expect(valueOf(out)).toBe(1);
  });

  it('reads an unknown owner or placeholder as a blank entry, and drops and reports a pin through one', async () => {
    const code = 'const blank = entities.Ghost.placeholders.Hair.value === "" && dictionaries.Nope.name === ""'
      + ' && dictionaries.Nope.placeholders.Sky.value === "" && entities.Rook.placeholders.Hair.value === ""'
      + ' && entities.Molly.placeholders.Hiar.value === "";'
      + ' entities.Ghost.placeholders.Hair.pin("x"); dictionaries.Nope.placeholders.Sky.pin("y"); entities.Rook.placeholders.Hair.pin("z");'
      + ' return blank ? 1 : 0;';
    const out = await run(code);
    expect(valueOf(out)).toBe(1);
    expect(out.pinWrites).toEqual({});
    // Rook is in play with no placeholders, so its miss is the world's; Ghost and Nope are no owner at all.
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/the world does not have: Rook › Hair$/));
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/owners not in play: Ghost › Hair, Nope › Sky$/));
  });

  it('leaves an authored dictionary turned off at Enter World out of dictionaries, and reports a pin through it', async () => {
    const code = 'const gone = dictionaries.Lore.id === "" && dictionaries.Weather.id === "later-weather";'
      + ' dictionaries.Lore.placeholders.Mood.pin("x"); dictionaries.Weather.placeholders.Sky.pin("storm"); return gone ? 1 : 0;';
    const mood = ph('lore-mood', 'Mood', ['calm']);
    const withLore = new Map([...owners, ['lore-mood', { kind: 'dictionary' as const, id: 'lore', name: 'Lore' }]]);
    const out = await runStatCodeTurn({
      stats: [stat({ id: 's0', name: 'S0', value: 0, code })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(asLyra, [lyra]),
      placeholders: {
        placeholders: [...list, mood], owners: withLore, dictionaries, rolls: { world: {} },
        inPlayDictionaryIds: new Set(['first-weather', 'later-weather']),
      },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(valueOf(out)).toBe(1);
    expect(out.pinWrites).toEqual({ 'later-sky': 'storm' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/owners not in play: Lore › Mood$/));
  });

  it('lists every authored dictionary when the run has no Enter World set', async () => {
    const out = await run('return dictionaries.Lore.id === "lore" && dictionaries.Weather.id === "later-weather" ? 1 : 0;');
    expect(valueOf(out)).toBe(1);
  });

  it('lists an authored dictionary left on and every library dictionary beside one turned off', async () => {
    const tides: Dictionary = { id: 'run-tides', name: 'Tides', entries: [], placeholders: [ph('tide', 'Tide', ['ebb'])] };
    const out = await runStatCodeTurn({
      stats: [stat({ id: 's0', name: 'S0', value: 0, code: 'return dictionaries.Lore.id === "lore" && dictionaries.Tides.id === "run-tides" && dictionaries.Weather.id === "" ? 1 : 0;' })],
      enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: played(asLyra, [lyra]),
      placeholders: {
        placeholders: list, owners, dictionaries, libraryDictionaries: [tides], rolls: { world: {} },
        inPlayDictionaryIds: new Set(['lore']),
      },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
    });
    expect(valueOf(out)).toBe(1);
  });

  it('reads persona.placeholders as empty when no persona entity plays, and reports a pin through it', async () => {
    const out = await run('const blank = persona.placeholders.Eyes.value === ""; persona.placeholders.Eyes.pin("x"); return blank ? 1 : 0;',
      played({ source: 'none' }));
    expect(valueOf(out)).toBe(1);
    expect(out.pinWrites).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/owners not in play: persona › Eyes$/));
  });

  it('drops and reports a write to an owner entry’s read-only fields', async () => {
    const out = await run('entities.Molly.placeholders = {}; dictionaries.Weather.id = "x"; dictionaries.Weather.placeholders = 1;');
    expect(out.pinWrites).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/entities\.Molly\.placeholders.*dictionaries\.Weather\.id.*dictionaries\.Weather\.placeholders/),
    );
  });
});
