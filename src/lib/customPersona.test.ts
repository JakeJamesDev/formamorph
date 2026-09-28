import { describe, expect, it } from 'vitest';
import {
  customPersonaCounts, customPersonaHeldElsewhere, deleteLine, personaRole, personaRolePatch, unmarkLine,
} from './customPersona';
import type { Entity, Placeholder, TraitLink } from '@/types';

const link = (id: string): TraitLink => ({ id, originalId: `o-${id}`, kind: 'trait', originalName: id, groupId: null });
const ph = (id: string, blueprintId?: string): Placeholder => ({ id, name: id, values: [], ...(blueprintId ? { blueprintId } : {}) });

describe('the Persona role', () => {
  it.each([
    [{}, 'cast'],
    [{ persona: true }, 'playable'],
    [{ persona: true, personaOnly: true }, 'only'],
    [{ customPersona: true }, 'custom'],
  ] as const)('reads %o as %s', (marks, role) => {
    expect(personaRole(marks)).toBe(role);
  });

  it('writes each role back as the marks it reads from', () => {
    for (const role of ['cast', 'playable', 'only', 'custom'] as const) expect(personaRole(personaRolePatch(role))).toBe(role);
  });

  it('clears the Persona marks and the node placement when an entity takes the Custom Persona role', () => {
    expect(personaRolePatch('custom')).toStrictEqual({ persona: undefined, personaOnly: undefined, customPersona: true, traitPlacement: undefined });
    expect(personaRolePatch('playable')).not.toHaveProperty('traitPlacement');
  });
});

describe('one Custom Persona per world', () => {
  const entities: Entity[] = [{ id: 'a', name: 'Ash' }, { id: 'cp', name: 'Newcomer', customPersona: true }];

  it('names the holder to every other entity, and nobody to the holder', () => {
    expect(customPersonaHeldElsewhere(entities, 'a')?.name).toBe('Newcomer');
    expect(customPersonaHeldElsewhere(entities, 'cp')).toBeUndefined();
    expect(customPersonaHeldElsewhere([entities[0]], 'a')).toBeUndefined();
  });
});

describe('the confirmations', () => {
  const entity: Entity = {
    id: 'cp', name: 'Newcomer', customPersona: true,
    traitLinks: [link('l1'), link('l2')],
    traits: [{ id: 't1', name: 'Scar', statChanges: [] }],
    traitGroups: [{ id: 'g1', name: 'Past', parentId: null }],
    placeholders: [ph('garb', 'bp-garb'), ph('home')],
  };

  it('counts links, own traits, copies and placeholders, never groups', () => {
    expect(customPersonaCounts(entity)).toEqual({ links: 2, traits: 1, copies: 1, placeholders: 2 });
  });

  it('names what the unmark keeps and what the delete removes', () => {
    expect(unmarkLine(customPersonaCounts(entity))).toBe('It becomes a regular entity and keeps its 2 links, 1 trait and 1 copy.');
    expect(deleteLine(customPersonaCounts(entity))).toBe('This also deletes its 2 links, 1 trait and 2 placeholders.');
  });

  it('names only the counts that are there', () => {
    expect(unmarkLine(customPersonaCounts({ id: 'x', name: 'X', traitLinks: [link('l1')] }))).toBe('It becomes a regular entity and keeps its 1 link.');
    expect(deleteLine(customPersonaCounts({ id: 'x', name: 'X', placeholders: [ph('a'), ph('b')], traits: [] })))
      .toBe('This also deletes its 2 placeholders.');
  });

  it('has nothing to confirm for an entity that carries nothing', () => {
    const empty = customPersonaCounts({ id: 'x', name: 'X', traitGroups: [{ id: 'g', name: 'G', parentId: null }] });
    expect(unmarkLine(empty)).toBeNull();
    expect(deleteLine(empty)).toBeNull();
  });
});
