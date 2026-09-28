// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDefaultPersona, hasPersonaChoice, locationForPersonaPick, namedStartLocation, offeredPersonas, samePersonaRef,
  offeredStartLocations, personaStartLocation, preselectPersona, readDefaultPersona, readWorldPersona,
  rememberWorldPersona, setDefaultPersona, withoutPersona, worldPlayerSetting, type PersonaChoices,
} from './personaPick';
import type { Entity, GameLocation, PersonaRef } from '@/types';

const lib = (entityId: string): PersonaRef => ({ source: 'library', entityId });
const world = (entityId: string): PersonaRef => ({ source: 'world', entityId });
const NONE: PersonaRef = { source: 'none' };

const choices = (over: Partial<PersonaChoices> = {}): PersonaChoices => ({
  playerSetting: 'open',
  remembered: undefined,
  globalDefault: undefined,
  available: { world: [], library: ['a', 'b'] },
  ...over,
});

afterEach(() => localStorage.clear());

// One rule serves the enter-world step and Quick Start: both call preselectPersona with the same inputs.
describe('preselectPersona (step and Quick Start)', () => {
  it.each<[string, Partial<PersonaChoices>, PersonaRef]>([
    ['the remembered pick wins over the global default', { remembered: lib('b'), globalDefault: 'a' }, lib('b')],
    ['a remembered None wins over the global default', { remembered: NONE, globalDefault: 'a' }, NONE],
    ['the global default applies when the world has no pick', { globalDefault: 'a' }, lib('a')],
    ['None applies when nothing is set', {}, NONE],
    ['a remembered pick of a deleted entity falls through to the default', { remembered: lib('gone'), globalDefault: 'a' }, lib('a')],
    ['a deleted default falls through to None', { globalDefault: 'gone' }, NONE],
    ['both deleted fall through to None', { remembered: lib('gone'), globalDefault: 'gone2' }, NONE],
    ['a remembered world pick with no world personas falls through', { remembered: { source: 'world', entityId: 'w' }, globalDefault: 'b' }, lib('b')],
    ['nothing is available: None', { available: { world: [], library: [] }, globalDefault: 'a', remembered: lib('a') }, NONE],
    ['a remembered world pick wins over the global default', { available: { world: ['w'], library: ['a'] }, remembered: world('w'), globalDefault: 'a' }, world('w')],
    ['a remembered world pick the world no longer marks falls through', { available: { world: ['w'], library: ['a'] }, remembered: world('gone'), globalDefault: 'a' }, lib('a')],
    ['world personas alone: None when nothing is remembered', { available: { world: ['w'], library: [] }, globalDefault: 'a' }, NONE],
    ['world personas alone: the remembered world pick', { available: { world: ['w'], library: [] }, remembered: world('w') }, world('w')],
    ['a Custom Persona entity alone: the remembered entry', { available: { world: [], library: [], custom: true }, remembered: { source: 'none', name: 'Ash' } }, { source: 'none', name: 'Ash' }],
    ['a Custom Persona entity under Cast with a world persona: the world persona, its row unoffered', { available: { world: ['w'], library: [], custom: true }, playerSetting: 'cast', remembered: { source: 'none', name: 'Ash' } }, world('w')],
  ])('%s', (_label, over, expected) => {
    expect(preselectPersona(choices(over))).toEqual(expected);
  });
});

// The world's player setting, for the step and Quick Start, with the remembered pick and the global default.
describe('preselectPersona under the world player setting', () => {
  const both = { world: ['w1', 'w2'], library: ['a', 'b'] };
  it.each<[string, Partial<PersonaChoices>, PersonaRef]>([
    ['open: the global default applies', { playerSetting: 'open', available: both, globalDefault: 'a' }, lib('a')],
    ['open: the remembered pick wins', { playerSetting: 'open', available: both, remembered: world('w2'), globalDefault: 'a' }, world('w2')],
    ['fixed: None over the global default', { playerSetting: 'fixed', available: both, globalDefault: 'a' }, NONE],
    ['fixed: a remembered library pick wins', { playerSetting: 'fixed', available: both, remembered: lib('b'), globalDefault: 'a' }, lib('b')],
    ['fixed: a remembered world pick wins', { playerSetting: 'fixed', available: both, remembered: world('w1') }, world('w1')],
    ['fixed: a remembered pick of a deleted entity falls to None', { playerSetting: 'fixed', available: both, remembered: lib('gone'), globalDefault: 'a' }, NONE],
    ['cast: the first world persona over the global default', { playerSetting: 'cast', available: both, globalDefault: 'a' }, world('w1')],
    ['cast: a remembered world pick wins', { playerSetting: 'cast', available: both, remembered: world('w2') }, world('w2')],
    ['cast: a remembered library pick is not offered', { playerSetting: 'cast', available: both, remembered: lib('a') }, world('w1')],
    ['cast: a remembered None is not offered', { playerSetting: 'cast', available: both, remembered: NONE, globalDefault: 'a' }, world('w1')],
    ['cast with no marked entity: None, as fixed', { playerSetting: 'cast', available: { world: [], library: ['a'] }, globalDefault: 'a' }, NONE],
    ['cast with no marked entity: a remembered pick wins, as fixed', { playerSetting: 'cast', available: { world: [], library: ['a'] }, remembered: lib('a') }, lib('a')],
  ])('%s', (_label, over, expected) => {
    expect(preselectPersona(choices(over))).toEqual(expected);
  });
});

// The step's category and the in-game Change dialog list what this offers.
describe('offeredPersonas', () => {
  const both = { world: ['w'], library: ['a'] };
  it('open and fixed offer every persona and None', () => {
    expect(offeredPersonas('open', both)).toEqual({ ...both, none: true });
    expect(offeredPersonas('fixed', both)).toEqual({ ...both, none: true });
  });

  it("cast offers only the world's personas, with no None", () => {
    expect(offeredPersonas('cast', both)).toEqual({ world: ['w'], library: [], none: false });
  });

  it('cast with no marked entity offers what fixed offers', () => {
    expect(offeredPersonas('cast', { world: [], library: ['a'] })).toEqual({ world: [], library: ['a'], none: true });
  });

  it('leaves nothing to pick when no persona is on offer, whatever the setting', () => {
    for (const setting of ['open', 'fixed', 'cast'] as const) {
      expect(hasPersonaChoice(offeredPersonas(setting, { world: [], library: [] }))).toBe(false);
    }
    expect(hasPersonaChoice(offeredPersonas('cast', both))).toBe(true);
    expect(hasPersonaChoice(offeredPersonas('fixed', { world: [], library: ['a'] }))).toBe(true);
  });

  it('offers the Custom Persona entity in None’s place, which is a choice on its own, and drops it with None under Cast', () => {
    expect(offeredPersonas('open', { world: [], library: [], custom: 'cp' })).toEqual({ world: [], library: [], none: true, custom: 'cp' });
    expect(hasPersonaChoice(offeredPersonas('open', { world: [], library: [], custom: 'cp' }))).toBe(true);
    expect(offeredPersonas('cast', { ...both, custom: 'cp' })).toEqual({ world: ['w'], library: [], none: false });
  });
});

describe('samePersonaRef', () => {
  it('compares picks by source and id, and None picks by their entry', () => {
    expect(samePersonaRef(NONE, NONE)).toBe(true);
    expect(samePersonaRef(NONE, { source: 'none', name: 'Ash' })).toBe(false);
    expect(samePersonaRef({ source: 'none', name: 'Ash', description: '' }, { source: 'none', name: 'Ash' })).toBe(true);
    expect(samePersonaRef(lib('a'), lib('a'))).toBe(true);
    expect(samePersonaRef(lib('a'), world('a'))).toBe(false);
    expect(samePersonaRef(lib('a'), lib('b'))).toBe(false);
  });
});

describe('worldPlayerSetting', () => {
  it('reads an absent or unknown value as open', () => {
    expect(worldPlayerSetting({})).toBe('open');
    expect(worldPlayerSetting({ playerSetting: 'bogus' as never })).toBe('open');
    expect(worldPlayerSetting(undefined)).toBe('open');
  });

  it('reads fixed and cast', () => {
    expect(worldPlayerSetting({ playerSetting: 'fixed' })).toBe('fixed');
    expect(worldPlayerSetting({ playerSetting: 'cast' })).toBe('cast');
  });
});

const entity = (id: string, locations?: string[], startingLocationId?: string): Entity => ({
  id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', persona: true, locations, startingLocationId,
});
const place = (id: string, isStarting = false): GameLocation => ({ id, name: id, description: '', isStarting });
// Flagged: dock, gate. Unflagged: inn, cellar.
const places = [place('inn'), place('dock', true), place('cellar'), place('gate', true)];
const ids = (locations: readonly GameLocation[]) => locations.map((l) => l.id);

describe('personaStartLocation', () => {
  it("takes the first of the entity's locations that is a starting location, in the entity's order", () => {
    expect(personaStartLocation(entity('w', ['inn', 'gate', 'dock']), places)).toBe('gate');
  });

  it('gives null for an entity with no starting location among its locations', () => {
    expect(personaStartLocation(entity('w', ['inn']), places)).toBeNull();
    expect(personaStartLocation(entity('w'), places)).toBeNull();
  });

  it('prefers the location the persona names, flagged or not', () => {
    expect(personaStartLocation(entity('w', ['dock'], 'cellar'), places)).toBe('cellar');
    expect(personaStartLocation(entity('w', ['dock'], 'gate'), places)).toBe('gate');
  });

  it('falls back to the first flagged rule when the named location is gone', () => {
    expect(personaStartLocation(entity('w', ['dock'], 'gone'), places)).toBe('dock');
  });
});

describe('namedStartLocation', () => {
  it('gives the location the persona names, or nothing on Automatic or a deleted one', () => {
    expect(namedStartLocation(entity('w', [], 'cellar'), places)?.id).toBe('cellar');
    expect(namedStartLocation(entity('w', []), places)).toBeUndefined();
    expect(namedStartLocation(entity('w', [], 'gone'), places)).toBeUndefined();
  });
});

describe('offeredStartLocations', () => {
  const context = { worldEntities: [entity('hermit', [], 'cellar'), entity('guard', [], 'gate'), entity('plain')], locations: places };

  it('offers the flagged locations in world order', () => {
    expect(ids(offeredStartLocations(NONE, context))).toEqual(['dock', 'gate']);
    expect(ids(offeredStartLocations(world('plain'), context))).toEqual(['dock', 'gate']);
  });

  it('adds an unflagged location while the persona that names it is picked', () => {
    expect(ids(offeredStartLocations(world('hermit'), context))).toEqual(['dock', 'cellar', 'gate']);
    expect(ids(offeredStartLocations(world('guard'), context))).toEqual(['dock', 'gate']);
  });

  it('never adds a location for a library pick that shares a world id', () => {
    expect(ids(offeredStartLocations(lib('hermit'), context))).toEqual(['dock', 'gate']);
  });
});

describe('locationForPersonaPick', () => {
  const entities = [
    entity('w', ['inn', 'dock']), entity('homeless', ['inn']),
    entity('hermit', ['dock'], 'cellar'), entity('guard', ['dock'], 'gate'),
  ];
  const pick = (ref: PersonaRef, current: string | null, locationChosen = false) =>
    locationForPersonaPick({ ref, current, locationChosen, worldEntities: entities, locations: places });

  it("moves the location to the world persona's first starting location", () => {
    expect(pick(world('w'), null)).toEqual({ locationId: 'dock', locationChosen: false });
    expect(pick(world('w'), 'gate').locationId).toBe('dock');
  });

  it('prefers the location the persona names over the first flagged rule', () => {
    expect(pick(world('guard'), null).locationId).toBe('gate');
    expect(pick(world('hermit'), 'gate').locationId).toBe('cellar');
  });

  it('keeps a location the player chose by hand', () => {
    expect(pick(world('w'), 'gate', true)).toEqual({ locationId: 'gate', locationChosen: true });
    expect(pick(world('hermit'), null, true).locationId).toBeNull();
  });

  it('keeps the location for a library persona and for None', () => {
    expect(pick(lib('a'), 'gate').locationId).toBe('gate');
    expect(pick(NONE, null).locationId).toBeNull();
  });

  it('keeps the location for a world persona with no starting location among its locations', () => {
    expect(pick(world('homeless'), 'gate').locationId).toBe('gate');
    expect(pick(world('homeless'), null).locationId).toBeNull();
  });

  it("drops an unflagged location on a switch to a persona that does not name it, to that persona's automatic pick", () => {
    expect(pick(world('w'), 'cellar')).toEqual({ locationId: 'dock', locationChosen: false });
    expect(pick(world('homeless'), 'cellar')).toEqual({ locationId: null, locationChosen: false });
    expect(pick(NONE, 'cellar')).toEqual({ locationId: null, locationChosen: false });
  });

  it('drops a hand-picked unflagged location too, and clears the hand pick', () => {
    expect(pick(world('guard'), 'cellar', true)).toEqual({ locationId: 'gate', locationChosen: false });
    expect(pick(lib('a'), 'cellar', true)).toEqual({ locationId: null, locationChosen: false });
  });

  it('keeps an unflagged location while its own persona is picked again', () => {
    expect(pick(world('hermit'), 'cellar', true)).toEqual({ locationId: 'cellar', locationChosen: true });
  });
});

describe('withoutPersona', () => {
  it('drops the library persona from the added characters', () => {
    expect([...withoutPersona(new Set(['a', 'c']), lib('a'))]).toEqual(['c']);
  });

  it('keeps every character for None and for a world persona', () => {
    expect([...withoutPersona(new Set(['a']), NONE)]).toEqual(['a']);
    expect([...withoutPersona(new Set(['a']), { source: 'world', entityId: 'a' })]).toEqual(['a']);
  });
});

describe('device-local persona memory', () => {
  it('remembers each world pick on its own, None included', () => {
    rememberWorldPersona('w1', lib('a'));
    rememberWorldPersona('w2', NONE);
    expect(readWorldPersona('w1')).toEqual(lib('a'));
    expect(readWorldPersona('w2')).toEqual(NONE);
    expect(readWorldPersona('w3')).toBeUndefined();
  });

  it('reads a corrupt remembered pick as no pick', () => {
    localStorage.setItem('FORMAMORPH_worldPersona', JSON.stringify({ w1: { source: 'library' } }));
    expect(readWorldPersona('w1')).toBeUndefined();
  });

  it('sets and clears the global default', () => {
    expect(readDefaultPersona()).toBeUndefined();
    setDefaultPersona('a');
    expect(readDefaultPersona()).toBe('a');
    clearDefaultPersona();
    expect(readDefaultPersona()).toBeUndefined();
  });
});
