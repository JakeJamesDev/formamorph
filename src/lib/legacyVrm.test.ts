import { describe, expect, it } from 'vitest';
import type { CharacterData, Entity, WorldOverview } from '@/types';
import { migrateWorld } from './version';
import { LEGACY_VRM_ID, defaultCharacterData, remapChosenVrm, seededCharacterData, withoutSpentFallback } from './legacyVrm';
import { playVrmContext, resolvePlayedVrm } from './vrmResolver';
import { DEFAULT_AVATAR_ID } from './defaultAvatar';

const oldFile = { data: 'data:model/vrm;base64,Z2xURgIA', type: 'model/vrm', name: 'Wren.vrm' };
const wren: Entity = { id: 'wren', name: 'Wren', persona: true } as Entity;
const custom: Entity = { id: 'you', name: 'You', customPersona: true } as Entity;

/** A world as an older build stored it: the flag and the old Avatar on the overview, at the current version. */
const oldWorld = (overview: Record<string, unknown>, entities: Entity[] = [wren]) =>
  ({ version: __APP_VERSION__, worldOverview: { name: 'Sedge Landing', ...overview }, entities });

const overviewOf = (raw: unknown) => migrateWorld(raw).worldOverview;

describe('the legacy Avatar migration', () => {
  it('gives a world with no flag no Avatar', () => {
    const overview = overviewOf(oldWorld({}));
    expect(overview.vrmStore).toBeUndefined();
    expect(overview.legacyVrmFallback).toBeUndefined();
  });

  it('gives a world with no flag but an old Avatar no fallback', () => {
    for (const customPlayerVRM of [null, oldFile]) {
      expect(overviewOf(oldWorld({ customPlayerVRM })).legacyVrmFallback).toBeUndefined();
    }
  });

  it('gives a world with the flag off no fallback, and drops the flag', () => {
    const overview = overviewOf(oldWorld({ use3DModel: false, customPlayerVRM: null }));
    expect(overview.legacyVrmFallback).toBeUndefined();
    expect(overview).not.toHaveProperty('use3DModel');
    expect(overview).not.toHaveProperty('customPlayerVRM');
  });

  it("keeps an old Avatar under a flag that is off in the store, with no fallback", () => {
    const overview = overviewOf(oldWorld({ use3DModel: false, customPlayerVRM: oldFile }));
    expect(overview.vrmStore?.[LEGACY_VRM_ID]).toEqual({ name: 'Wren', file: oldFile });
    expect(overview.legacyVrmFallback).toBeUndefined();
  });

  it("falls back to User's Default when the flag is on and there is no old Avatar", () => {
    const overview = overviewOf(oldWorld({ use3DModel: true, customPlayerVRM: null }));
    expect(overview.vrmStore).toBeUndefined();
    expect(overview.legacyVrmFallback).toEqual({ kind: 'default' });
  });

  it('moves the old Avatar into the store under the reserved id and points the fallback at it', () => {
    const overview = overviewOf(oldWorld({ use3DModel: true, customPlayerVRM: oldFile }));
    expect(overview.vrmStore).toEqual({ [LEGACY_VRM_ID]: { name: 'Wren', file: oldFile } });
    expect(overview.legacyVrmFallback).toEqual({ kind: 'world', id: LEGACY_VRM_ID });
    expect(overview).not.toHaveProperty('customPlayerVRM');
  });

  it("keeps the store's own Avatars beside the moved one", () => {
    const own = { name: 'Heron', file: { data: 'data:heron', type: 'model/vrm' } };
    const overview = overviewOf(oldWorld({ use3DModel: true, customPlayerVRM: oldFile, vrmStore: { heron: own } }));
    expect(Object.keys(overview.vrmStore ?? {})).toEqual(['heron', LEGACY_VRM_ID]);
  });

  it('assigns no entity an Avatar and creates no Custom Persona', () => {
    const world = migrateWorld(oldWorld({ use3DModel: true, customPlayerVRM: oldFile }, [wren, { ...custom }]));
    expect(world.entities.map((e) => e.vrmPick)).toEqual([undefined, undefined]);
    expect(world.entities.filter((e) => e.customPersona).map((e) => e.id)).toEqual(['you']);
    const noCustom = migrateWorld(oldWorld({ use3DModel: true }, [wren]));
    expect(noCustom.entities.some((e) => e.customPersona)).toBe(false);
  });

  it('is idempotent, and a re-saved world keeps its fallback', () => {
    const once = migrateWorld(oldWorld({ use3DModel: true, customPlayerVRM: oldFile }));
    const twice = migrateWorld(structuredClone(once));
    expect(twice).toEqual(once);
    expect(twice.worldOverview.legacyVrmFallback).toEqual({ kind: 'world', id: LEGACY_VRM_ID });
  });

  it('files the old Avatar under the same id on every load', () => {
    const raw = oldWorld({ use3DModel: true, customPlayerVRM: oldFile });
    const first = overviewOf(structuredClone(raw));
    const second = overviewOf(structuredClone(raw));
    expect(Object.keys(first.vrmStore ?? {})).toEqual([LEGACY_VRM_ID]);
    expect(Object.keys(second.vrmStore ?? {})).toEqual([LEGACY_VRM_ID]);
  });
});

describe('an old world in play', () => {
  const world = migrateWorld(oldWorld({ use3DModel: true, customPlayerVRM: oldFile }, [wren]));
  const played = (persona: Parameters<typeof playVrmContext>[0]['persona']) => resolvePlayedVrm(playVrmContext({
    persona, entities: world.entities, overview: world.worldOverview, characterData: defaultCharacterData,
    libraryIds: new Set(['lib-a']), deviceDefault: undefined,
  }));
  const shown = { kind: 'world', id: LEGACY_VRM_ID };

  it('shows the old Avatar under None', () => {
    expect(played(null)).toEqual(shown);
  });

  it('shows the old Avatar under a library persona with no pick', () => {
    expect(played({ source: 'library', entity: { id: 'lib-persona', name: 'Rook' } as Entity })).toEqual(shown);
  });

  it('shows the old Avatar under a world persona whose pick is none', () => {
    expect(played({ source: 'world', entity: wren })).toEqual(shown);
  });
});

describe('dropping a spent fallback', () => {
  const overview = { name: 'W', legacyVrmFallback: { kind: 'default' } } as WorldOverview;

  it('drops the fallback once the Custom Persona has a pick', () => {
    expect(withoutSpentFallback(overview, [{ ...custom, vrmPick: { kind: 'default' } }])).not.toHaveProperty('legacyVrmFallback');
  });

  it('keeps it while the Custom Persona picks none, or for a pick on another entity', () => {
    expect(withoutSpentFallback(overview, [custom, { ...wren, vrmPick: { kind: 'default' } }])).toBe(overview);
  });
});

describe('remapping a save at game load', () => {
  const store = { [LEGACY_VRM_ID]: { name: 'Wren', file: oldFile } };
  const old = (playerModelId?: string) =>
    ({ ...defaultCharacterData, chosenVrm: undefined, ...(playerModelId ? { playerModelId } : {}) }) as unknown as CharacterData;
  const legacyWorld = { pick: { kind: 'world', id: LEGACY_VRM_ID }, legacy: true };

  it("remaps an unset choice to the world's old Avatar, marked legacy", () => {
    expect(remapChosenVrm(old(), store)?.chosenVrm).toEqual(legacyWorld);
  });

  it("remaps \"the world's\" to the old Avatar, or to no choice when the world had none", () => {
    expect(remapChosenVrm(old('world'), store)?.chosenVrm).toEqual(legacyWorld);
    expect(remapChosenVrm(old('world'), undefined)?.chosenVrm).toBeNull();
    expect(remapChosenVrm(old(), {})?.chosenVrm).toBeNull();
  });

  it('keeps a library Avatar the save chose, marked legacy, and drops the old key', () => {
    const out = remapChosenVrm(old('lib-a'), store);
    expect(out?.chosenVrm).toEqual({ pick: { kind: 'library', id: 'lib-a' }, legacy: true });
    expect(out).not.toHaveProperty('playerModelId');
  });

  it('points the pre-library default at the seeded copy', () => {
    expect(remapChosenVrm(old('default'), store)?.chosenVrm?.pick).toEqual({ kind: 'library', id: DEFAULT_AVATAR_ID });
  });

  it("keeps Q24's legacy library pick even where the played side picks something else", () => {
    const chosenVrm = remapChosenVrm(old('lib-a'), store)?.chosenVrm ?? undefined;
    const source = resolvePlayedVrm({
      store, libraryIds: new Set(['lib-a']), deviceDefault: undefined, played: { source: 'none' },
      customPersona: { id: 'you', vrmPick: { kind: 'world', id: LEGACY_VRM_ID } }, chosen: chosenVrm,
    });
    expect(source).toEqual({ kind: 'library', id: 'lib-a' });
  });

  it('leaves a save made after the change alone, null choice included', () => {
    const fresh = { ...defaultCharacterData, chosenVrm: null };
    expect(remapChosenVrm(fresh, store)).toBe(fresh);
    const picked = { ...defaultCharacterData, chosenVrm: { pick: { kind: 'library' as const, id: 'lib-a' } } };
    expect(remapChosenVrm(picked, store)).toBe(picked);
  });

  it('is idempotent', () => {
    const once = remapChosenVrm(old(), store);
    expect(remapChosenVrm(once, store)).toBe(once);
  });

  it('passes a save with no character data through as none', () => {
    expect(remapChosenVrm(null, store)).toBeNull();
  });
});

describe('seeding customization', () => {
  it('seeds the defaults when the played side shows an Avatar and the save holds none', () => {
    expect(seededCharacterData(null, true)).toEqual(defaultCharacterData);
  });

  it('seeds nothing when the played side shows no Avatar, and keeps data the save holds', () => {
    expect(seededCharacterData(null, false)).toBeNull();
    const own = { ...defaultCharacterData, hairColor: '#123456' };
    expect(seededCharacterData(own, true)).toBe(own);
  });
});
