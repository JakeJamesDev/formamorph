import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDefaultPersona, preselectPersona, readDefaultPersona, readWorldPersona, rememberWorldPersona,
  setDefaultPersona, withoutPersona, type PersonaChoices,
} from './personaPick';
import type { PersonaRef } from '@/types';

const lib = (entityId: string): PersonaRef => ({ source: 'library', entityId });
const NONE: PersonaRef = { source: 'none' };

const choices = (over: Partial<PersonaChoices> = {}): PersonaChoices => ({
  playerSetting: 'open',
  remembered: undefined,
  globalDefault: undefined,
  available: { library: ['a', 'b'] },
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
    ['nothing is available: None', { available: { library: [] }, globalDefault: 'a', remembered: lib('a') }, NONE],
  ])('%s', (_label, over, expected) => {
    expect(preselectPersona(choices(over))).toEqual(expected);
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
