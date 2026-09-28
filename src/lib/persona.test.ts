import { describe, expect, it } from 'vitest';
import { enteredPersona, personaOption, resolvePersona, withPersonaEntry, worldEntitiesOf } from './persona';
import { entityIdsAt } from './entityPresence';
import { buildEntityContext, buildSublocationEntitiesContext } from './locationContext';
import type { Entity, GameLocation, PersonaRef } from '@/types';

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
    persona: { name: string; source: 'world' | 'library' | 'custom' } | null;
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

describe('resolvePersona: persona-only entities', () => {
  const custom = ent('w-custom', 'Custom Character', { persona: true, personaOnly: true, locations: ['dock'] });
  const withCustom = [mira, vos, custom];

  it.each<{ label: string; ref: PersonaRef | undefined }>([
    { label: 'absent', ref: undefined },
    { label: 'None', ref: { source: 'none' } },
    { label: 'another world persona', ref: { source: 'world', entityId: 'w-mira' } },
    { label: 'a library persona', ref: { source: 'library', entityId: 'l-wren' } },
    { label: 'a reference that no longer resolves', ref: { source: 'world', entityId: 'w-gone' } },
  ])('leaves an unpicked persona-only entity out of the cast under $label', ({ ref }) => {
    const { cast } = resolvePersona(ref, withCustom, library);
    expect(cast.map((e) => e.id)).not.toContain('w-custom');
    expect(entityIdsAt('dock', cast)).not.toContain('w-custom');
  });

  it('plays a picked persona-only entity and keeps it out of the cast', () => {
    const res = resolvePersona({ source: 'world', entityId: 'w-custom' }, withCustom, library);
    expect(res.persona?.entity.id).toBe('w-custom');
    expect(res.cast.map((e) => e.id)).toEqual(['w-mira', 'w-vos']);
  });

  it('does not return an unpicked persona-only entity to the cast after a switch away', () => {
    const switched = resolvePersona({ source: 'world', entityId: 'w-mira' }, withCustom, library);
    expect(switched.cast.map((e) => e.id)).toEqual(['w-vos']);
  });

  it('reads the flag only with the Persona mark', () => {
    const unmarked = { ...custom, persona: false };
    const { cast } = resolvePersona({ source: 'none' }, [mira, vos, unmarked], library);
    expect(cast.map((e) => e.id)).toContain('w-custom');
  });

  it('leaves an unpicked persona-only entity out of the roster', () => {
    const { cast } = resolvePersona({ source: 'none' }, withCustom, library);
    const dock: GameLocation = { id: 'dock', name: 'Dock' };
    expect(buildEntityContext(dock, cast, { format: 'markdown' })).not.toContain('Custom Character');
    expect(buildEntityContext(dock, cast, { format: 'markdown' })).toContain('Captain Vos');
  });
});

describe('resolvePersona: the Custom Persona entity in None’s place', () => {
  const you = ent('w-you', 'Wanderer', {
    customPersona: true, aliases: ['Stranger'], playerDescription: 'A traveler.', aiDescription: 'Arrived last night.',
  });
  const marked = [mira, vos, you];

  it.each<{ label: string; ref: PersonaRef | undefined }>([
    { label: 'an absent reference', ref: undefined },
    { label: 'an explicit None', ref: { source: 'none' } },
  ])('plays the marked entity under $label, out of the cast, under its own name', ({ ref }) => {
    const res = resolvePersona(ref, marked, library);
    expect(res.persona).toEqual({ entity: you, source: 'custom' });
    expect(res.cast.map((e) => e.id)).toEqual(['w-mira', 'w-vos']);
    expect(res.playerNames).toEqual(['Wanderer', 'Stranger']);
    expect(res.unresolved).toBe(false);
  });

  it('replaces its name with the entered name and follows both descriptions with the entered one', () => {
    const res = resolvePersona({ source: 'none', name: ' Ash ', description: ' Hates the cold. ' }, marked, library);
    expect(res.persona?.entity).toEqual({
      ...you, name: 'Ash', playerDescription: 'A traveler.\n\nHates the cold.', aiDescription: 'Arrived last night.\n\nHates the cold.',
    });
    expect(res.playerNames).toEqual(['Ash', 'Stranger']);
  });

  it('keeps the authored name for a blank entry, and writes the entered description alone into an empty field', () => {
    const bare = { ...you, aiDescription: undefined };
    expect(enteredPersona(bare, { source: 'none', name: '  ' })).toBe(bare);
    expect(enteredPersona(bare, { source: 'none', description: 'Quiet.' })).toMatchObject({ name: 'Wanderer', aiDescription: 'Quiet.' });
  });

  it('keeps a world persona and a library persona as they are, the marked entity out of both casts', () => {
    const asMira = resolvePersona({ source: 'world', entityId: 'w-mira' }, marked, library);
    expect(asMira.persona).toEqual({ entity: mira, source: 'world' });
    expect(asMira.cast.map((e) => e.id)).toEqual(['w-vos']);
    const asWren = resolvePersona({ source: 'library', entityId: 'l-wren' }, marked, library);
    expect(asWren.persona).toEqual({ entity: wren, source: 'library' });
    expect(asWren.cast.map((e) => e.id)).toEqual(['w-mira', 'w-vos']);
  });

  it('counts the played marked entity among the world’s entities, as a played world persona is', () => {
    const { cast, persona } = resolvePersona({ source: 'none', name: 'Ash' }, marked, library);
    expect(worldEntitiesOf(cast, persona).map((e) => e.name)).toEqual(['Mira', 'Captain Vos', 'Ash']);
    expect(worldEntitiesOf(cast, resolvePersona({ source: 'library', entityId: 'l-wren' }, marked, library).persona)).toBe(cast);
  });

  it('puts the entered entity in the list in the marked entity’s place, and leaves other lists alone', () => {
    const entered = withPersonaEntry(marked, { source: 'none', name: 'Ash' });
    expect(entered.map((e) => e.name)).toEqual(['Mira', 'Captain Vos', 'Ash']);
    expect(withPersonaEntry(marked, { source: 'none' })).toBe(marked);
    expect(withPersonaEntry(marked, { source: 'world', entityId: 'w-mira' })).toBe(marked);
    expect(withPersonaEntry(world, { source: 'none', name: 'Ash' })).toBe(world);
  });

  it('names the marked entity for the library persona the player picked', () => {
    const picked = withPersonaEntry(marked, { source: 'library', entityId: 'l-wren' }, 'Wren');
    expect(picked.map((e) => e.name)).toEqual(['Mira', 'Captain Vos', 'Wren']);
    expect(withPersonaEntry(marked, { source: 'library', entityId: 'l-wren' })).toBe(marked);
  });
});

describe('the roster without the played entity', () => {
  const town: GameLocation = { id: 'town', name: 'Town' };
  const dock: GameLocation = { id: 'dock', name: 'Dock', parentId: 'town' };
  const inn: GameLocation = { id: 'inn', name: 'Inn', parentId: 'town' };
  const locations = [town, dock, inn];
  const played = resolvePersona({ source: 'world', entityId: 'w-mira' }, world, library);

  it('leaves the played entity out of the roster at every one of its locations', () => {
    for (const location of [dock, inn]) {
      expect(buildEntityContext(location, played.cast, { format: 'markdown' })).not.toContain('Mira');
    }
    expect(buildEntityContext(dock, played.cast, { format: 'markdown' })).toContain('Captain Vos');
    expect(buildSublocationEntitiesContext(town, locations, played.cast, { format: 'markdown' })).not.toContain('Mira');
  });

  it('lists the entity at its locations again after a switch away', () => {
    const { cast } = resolvePersona({ source: 'none' }, world, library);
    for (const location of [dock, inn]) {
      expect(buildEntityContext(location, cast, { format: 'markdown' })).toContain('Mira');
    }
  });
});

describe('personaOption', () => {
  it('resolves the player description with the entity as its owner', () => {
    const wren: Entity = { id: 'wren', name: 'Wren', persona: true, playerDescription: ' {{char}} rows the ferry. ' };
    const option = personaOption((entity, text) => text.replaceAll('{{char}}', entity.name))(wren);
    expect(option.description).toBe('Wren rows the ferry.');
  });
});
