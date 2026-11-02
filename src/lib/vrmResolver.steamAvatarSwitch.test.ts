import { describe, expect, it, vi } from 'vitest';
import sugarscape from '@/defaultworlds/sugarscape.json';
import type { Entity, VrmPick } from '@/types';
import { customPersonaEntity } from './blueprints';
import { DEFAULT_AVATAR_ID } from './defaultAvatar';
import { namedVrmSource, resolveEntityVrm, resolvePlayedVrm, type VrmContext } from './vrmResolver';

// Vitest serves the build's define as a global, so the real modules read this value as a `none` build would.
vi.hoisted(() => { (globalThis as Record<string, unknown>).__AVATAR_SET__ = 'none'; });

type PickedEntity = Pick<Entity, 'id' | 'vrmPick'>;

const userDefault = { kind: 'default' } as const;
const lib = (id: string) => ({ kind: 'library', id }) as const;
const entity = (id: string, vrmPick?: VrmPick): PickedEntity => (vrmPick ? { id, vrmPick } : { id });
const persona = entity('custom', userDefault);
const ctx = (over: Partial<VrmContext> = {}): VrmContext => ({
  store: undefined, libraryIds: new Set(), deviceDefault: undefined, played: { source: 'none' }, customPersona: persona, ...over,
});

/** Sugarscape's Custom Persona, as the bundled file stores it. */
const sugarscapePersona = (): PickedEntity => {
  const found = customPersonaEntity(sugarscape.entities as unknown as Entity[]);
  if (found?.vrmPick?.kind !== 'default') throw new Error("Sugarscape's Custom Persona is not on User's Default");
  return found;
};

describe('the resolver on a build with no bundled Avatar', () => {
  it("resolves User's Default to no model on an empty library", () => {
    expect(resolvePlayedVrm(ctx())).toBeUndefined();
  });

  it("resolves Sugarscape's User's Default pick to no model", () => {
    const customPersona = sugarscapePersona();
    expect(resolvePlayedVrm(ctx({ customPersona }))).toBeUndefined();
    expect(resolveEntityVrm(customPersona, ctx({ customPersona }))).toBeUndefined();
  });

  it('resolves a save that names the default Avatar id to no model', () => {
    expect(resolvePlayedVrm(ctx({ chosen: { pick: lib(DEFAULT_AVATAR_ID) } }))).toBeUndefined();
    expect(namedVrmSource(lib(DEFAULT_AVATAR_ID), { store: undefined, libraryIds: new Set() })).toBeUndefined();
  });

  it('resolves another entity that names the default Avatar id to no model', () => {
    expect(resolveEntityVrm(entity('npc', lib(DEFAULT_AVATAR_ID)), ctx())).toBeUndefined();
  });

  it('plays an added Avatar set as the device default', () => {
    const added = ctx({ libraryIds: new Set(['added']), deviceDefault: 'added' });
    expect(resolvePlayedVrm(added)).toEqual(lib('added'));
    expect(resolveEntityVrm(entity('npc', userDefault), added)).toEqual(lib('added'));
  });

  it('plays an added Avatar picked for the save', () => {
    expect(resolvePlayedVrm(ctx({ libraryIds: new Set(['added']), chosen: { pick: lib('added') } }))).toEqual(lib('added'));
  });

  it("falls through a save's gone default id to the device default", () => {
    const save = ctx({ libraryIds: new Set(['added']), deviceDefault: 'added', chosen: { pick: lib(DEFAULT_AVATAR_ID) } });
    expect(resolvePlayedVrm(save)).toEqual(lib('added'));
  });

  it('does not guess an added Avatar with no device default or pick', () => {
    expect(resolvePlayedVrm(ctx({ libraryIds: new Set(['added']) }))).toBeUndefined();
  });

  it('still resolves a default record the library holds', () => {
    expect(resolvePlayedVrm(ctx({ libraryIds: new Set([DEFAULT_AVATAR_ID]) }))).toEqual(lib(DEFAULT_AVATAR_ID));
  });
});
