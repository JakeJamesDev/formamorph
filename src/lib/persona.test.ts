import { describe, expect, it } from 'vitest';
import { resolvePersona } from './persona';
import { entityIdsAt } from './entityPresence';
import type { Entity, PersonaRef } from '@/types';

const ent = (id: string, name: string, extra: Partial<Entity> = {}): Entity => ({ id, name, ...extra });

const mira = ent('w-mira', 'Mira', { aliases: ['Matron'], persona: true, locations: ['dock', 'inn'] });
const vos = ent('w-vos', 'Captain Vos', { locations: ['dock'] });
const world = [mira, vos];
const wren = ent('l-wren', 'Wren', { aliases: ['Little Bird', ''], persona: true });
const library = [wren];

describe('resolvePersona', () => {
  const cases: Array<{
    label: string;
    ref: PersonaRef | undefined;
    persona: { name: string; source: 'world' | 'library' } | null;
    cast: string[];
    playerNames: string[];
    unresolved: boolean;
  }> = [
    { label: 'absent', ref: undefined, persona: null, cast: ['Mira', 'Captain Vos'], playerNames: [], unresolved: false },
    { label: 'explicit None', ref: { source: 'none' }, persona: null, cast: ['Mira', 'Captain Vos'], playerNames: [], unresolved: false },
    {
      label: 'world entity', ref: { source: 'world', entityId: 'w-mira' },
      persona: { name: 'Mira', source: 'world' }, cast: ['Captain Vos'], playerNames: ['Mira', 'Matron'], unresolved: false,
    },
    {
      label: 'library entity', ref: { source: 'library', entityId: 'l-wren' },
      persona: { name: 'Wren', source: 'library' }, cast: ['Mira', 'Captain Vos'], playerNames: ['Wren', 'Little Bird'], unresolved: false,
    },
    {
      label: 'world id that no longer exists', ref: { source: 'world', entityId: 'w-gone' },
      persona: null, cast: ['Mira', 'Captain Vos'], playerNames: [], unresolved: true,
    },
    {
      label: 'library id that no longer exists', ref: { source: 'library', entityId: 'l-gone' },
      persona: null, cast: ['Mira', 'Captain Vos'], playerNames: [], unresolved: true,
    },
    {
      // Each source is searched on its own: a library id never matches a world entity, and the reverse.
      label: 'world id stored as library', ref: { source: 'library', entityId: 'w-mira' },
      persona: null, cast: ['Mira', 'Captain Vos'], playerNames: [], unresolved: true,
    },
  ];

  it.each(cases)('$label', ({ ref, persona, cast, playerNames, unresolved }) => {
    const res = resolvePersona(ref, world, library);
    expect(res.persona ? { name: res.persona.entity.name, source: res.persona.source } : null).toEqual(persona);
    expect(res.cast.map((e) => e.name)).toEqual(cast);
    expect(res.playerNames).toEqual(playerNames);
    expect(res.unresolved).toBe(unresolved);
  });

  it('removes a played world entity from every one of its locations', () => {
    const { cast } = resolvePersona({ source: 'world', entityId: 'w-mira' }, world, library);
    expect(entityIdsAt('dock', cast)).toEqual(['w-vos']);
    expect(entityIdsAt('inn', cast)).toEqual([]);
  });

  it('never puts a library persona into the cast', () => {
    const { cast } = resolvePersona({ source: 'library', entityId: 'l-wren' }, world, library);
    expect(cast.some((e) => e.id === 'l-wren')).toBe(false);
  });

  it('returns the played entity to the cast after a switch away', () => {
    const played = resolvePersona({ source: 'world', entityId: 'w-mira' }, world, library);
    const switched = resolvePersona({ source: 'none' }, world, library);
    expect(played.cast.map((e) => e.id)).not.toContain('w-mira');
    expect(switched.cast.map((e) => e.id)).toContain('w-mira');
  });

  it('resolves an entity that lost its Persona mark, since the mark only gates the picker', () => {
    const unmarked = [{ ...mira, persona: false }, vos];
    const res = resolvePersona({ source: 'world', entityId: 'w-mira' }, unmarked, library);
    expect(res.persona?.entity.id).toBe('w-mira');
    expect(res.cast.map((e) => e.id)).toEqual(['w-vos']);
  });

  it('hands back the same cast array when nothing is played', () => {
    expect(resolvePersona({ source: 'none' }, world, library).cast).toBe(world);
    expect(resolvePersona({ source: 'library', entityId: 'l-wren' }, world, library).cast).toBe(world);
  });
});
