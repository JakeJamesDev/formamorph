import { describe, expect, it } from 'vitest';
import type { Entity, VrmPick, WorldVrm } from '@/types';
import { resolveEntityVrm, resolvePlayedVrm, type VrmContext } from './vrmResolver';

const file = { name: 'a.vrm', type: 'model/gltf-binary', data: 'data:' };
const store: Record<string, WorldVrm> = { knight: { name: 'Knight', file }, fox: { name: 'Fox', file }, legacy: { name: 'Old', file } };
const library = new Set(['lib-a', 'lib-b', 'lib-default']);

const entity = (id: string, vrmPick?: VrmPick): Pick<Entity, 'id' | 'vrmPick'> => (vrmPick ? { id, vrmPick } : { id });
const world = (id: string) => ({ kind: 'world', id }) as const;
const lib = (id: string) => ({ kind: 'library', id }) as const;
const userDefault = { kind: 'default' } as const;

const ctx = (over: Partial<VrmContext> = {}): VrmContext => ({
  store, libraryIds: library, deviceDefault: 'lib-default', played: { source: 'none' }, customPersona: undefined, ...over,
});

describe('resolvePlayedVrm precedence', () => {
  describe('played as a library persona', () => {
    const played = (pick?: VrmPick) => ({ source: 'library', entity: entity('me', pick) }) as const;

    it("takes the library persona's pick first", () => {
      expect(resolvePlayedVrm(ctx({ played: played(lib('lib-a')), customPersona: entity('custom', world('fox')), legacyFallback: world('legacy') })))
        .toEqual(lib('lib-a'));
    });

    it("takes the Custom Persona's pick second", () => {
      expect(resolvePlayedVrm(ctx({ played: played(), customPersona: entity('custom', world('fox')), legacyFallback: world('legacy') })))
        .toEqual(world('fox'));
    });

    it('takes the legacy fallback third', () => {
      expect(resolvePlayedVrm(ctx({ played: played(), customPersona: entity('custom'), legacyFallback: world('legacy') })))
        .toEqual(world('legacy'));
    });

    it('resolves to none when every source is none', () => {
      expect(resolvePlayedVrm(ctx({ played: played(), customPersona: entity('custom') }))).toBeUndefined();
    });
  });

  describe('played as a world persona', () => {
    const played = (pick?: VrmPick) => ({ source: 'world', entity: entity('hero', pick) }) as const;

    it("takes that entity's pick first", () => {
      expect(resolvePlayedVrm(ctx({ played: played(world('knight')), legacyFallback: world('legacy') }))).toEqual(world('knight'));
    });

    it('takes the legacy fallback second, never the Custom Persona', () => {
      expect(resolvePlayedVrm(ctx({ played: played(), customPersona: entity('custom', world('fox')), legacyFallback: world('legacy') })))
        .toEqual(world('legacy'));
    });

    it('resolves to none third', () => {
      expect(resolvePlayedVrm(ctx({ played: played(), customPersona: entity('custom', world('fox')) }))).toBeUndefined();
    });
  });

  describe('played as None', () => {
    it("takes the Custom Persona's pick first", () => {
      expect(resolvePlayedVrm(ctx({ customPersona: entity('custom', world('fox')), legacyFallback: world('legacy') }))).toEqual(world('fox'));
    });

    it('takes the legacy fallback second', () => {
      expect(resolvePlayedVrm(ctx({ customPersona: entity('custom'), legacyFallback: world('legacy') }))).toEqual(world('legacy'));
    });

    it('takes the legacy fallback with no Custom Persona at all', () => {
      expect(resolvePlayedVrm(ctx({ legacyFallback: world('legacy') }))).toEqual(world('legacy'));
    });

    it('resolves to none third', () => {
      expect(resolvePlayedVrm(ctx({ customPersona: entity('custom') }))).toBeUndefined();
    });
  });
});

describe("User's Default", () => {
  it('resolves to the device default', () => {
    expect(resolveEntityVrm(entity('npc', userDefault), ctx())).toEqual(lib('lib-default'));
  });

  it('resolves to the bundled file with no device default', () => {
    expect(resolveEntityVrm(entity('npc', userDefault), ctx({ deviceDefault: undefined }))).toEqual({ kind: 'bundled' });
  });

  it('resolves to the bundled file when the device default is gone, the seeded bundled copy included', () => {
    expect(resolveEntityVrm(entity('npc', userDefault), ctx({ deviceDefault: 'default-avatar' }))).toEqual({ kind: 'bundled' });
  });

  it('is what a legacy fallback without an old Avatar resolves to', () => {
    expect(resolvePlayedVrm(ctx({ legacyFallback: userDefault }))).toEqual(lib('lib-default'));
  });
});

describe('dangling picks', () => {
  it('resolves a deleted store id to none', () => {
    expect(resolveEntityVrm(entity('npc', world('gone')), ctx())).toBeUndefined();
  });

  it('reads only the store\'s own ids, never an inherited key', () => {
    expect(resolveEntityVrm(entity('npc', world('constructor')), ctx())).toBeUndefined();
  });

  it('lets a deleted store id fall through to the next source on the played side', () => {
    expect(resolvePlayedVrm(ctx({ customPersona: entity('custom', world('gone')), legacyFallback: world('legacy') })))
      .toEqual(world('legacy'));
  });

  it('resolves an unresolvable library id to the bundled file', () => {
    expect(resolveEntityVrm(entity('npc', lib('gone')), ctx())).toEqual({ kind: 'bundled' });
  });

  it('stops at an unresolvable library id instead of falling through', () => {
    const played = { source: 'library', entity: entity('me', lib('gone')) } as const;
    expect(resolvePlayedVrm(ctx({ played, customPersona: entity('custom', world('fox')) }))).toEqual({ kind: 'bundled' });
  });
});

describe('resolveEntityVrm', () => {
  it("shows an unplayed entity's own pick and ignores the legacy fallback", () => {
    const c = ctx({ legacyFallback: world('legacy') });
    expect(resolveEntityVrm(entity('npc'), c)).toBeUndefined();
    expect(resolveEntityVrm(entity('npc', world('knight')), c)).toEqual(world('knight'));
  });

  it("shows an entity's pick over the fallback when it is played", () => {
    const hero = entity('hero', world('knight'));
    expect(resolveEntityVrm(hero, ctx({ played: { source: 'world', entity: hero }, legacyFallback: world('legacy') }))).toEqual(world('knight'));
  });

  it('resolves the Custom Persona through the played side under None', () => {
    const custom = entity('custom');
    expect(resolveEntityVrm(custom, ctx({ customPersona: custom, legacyFallback: world('legacy') }))).toEqual(world('legacy'));
  });

  it('shows the Custom Persona its own pick when a persona is played', () => {
    const custom = entity('custom');
    const played = { source: 'world', entity: entity('hero') } as const;
    expect(resolveEntityVrm(custom, ctx({ played, customPersona: custom, legacyFallback: world('legacy') }))).toBeUndefined();
  });
});

describe("the save's chosen Avatar", () => {
  const chosen = { pick: lib('lib-b') };

  it("replaces User's Default for the played entity only", () => {
    const hero = entity('hero', userDefault);
    const c = ctx({ played: { source: 'world', entity: hero }, chosen });
    expect(resolveEntityVrm(hero, c)).toEqual(lib('lib-b'));
    expect(resolveEntityVrm(entity('npc', userDefault), c)).toEqual(lib('lib-default'));
  });

  it("replaces User's Default reached through the Custom Persona or the fallback", () => {
    expect(resolvePlayedVrm(ctx({ customPersona: entity('custom', userDefault), chosen }))).toEqual(lib('lib-b'));
    expect(resolvePlayedVrm(ctx({ legacyFallback: userDefault, chosen }))).toEqual(lib('lib-b'));
  });

  it('leaves a store pick alone', () => {
    const hero = entity('hero', world('knight'));
    expect(resolvePlayedVrm(ctx({ played: { source: 'world', entity: hero }, chosen }))).toEqual(world('knight'));
  });

  it('adds no Avatar where the played side resolves to none', () => {
    expect(resolvePlayedVrm(ctx({ chosen }))).toBeUndefined();
  });

  it('falls back to the device default when it names a store id that is gone', () => {
    expect(resolvePlayedVrm(ctx({ legacyFallback: userDefault, chosen: { pick: world('gone') } }))).toEqual(lib('lib-default'));
  });

  describe('from a legacy save', () => {
    const legacy = { pick: lib('lib-b'), legacy: true as const };

    it('replaces the whole played-side result', () => {
      const hero = entity('hero', world('knight'));
      expect(resolvePlayedVrm(ctx({ played: { source: 'world', entity: hero }, chosen: legacy }))).toEqual(lib('lib-b'));
    });

    it('replaces a played-side result of none', () => {
      expect(resolvePlayedVrm(ctx({ chosen: legacy }))).toEqual(lib('lib-b'));
    });

    it('leaves unplayed entities alone', () => {
      expect(resolveEntityVrm(entity('npc', world('fox')), ctx({ chosen: legacy }))).toEqual(world('fox'));
    });
  });
});
