import { describe, it, expect } from 'vitest';
import { buildEnterFlow, entryVrmPick, navigableSteps, type EnterFlowWorld, type EntryVrmInput } from './enterFlow';
import type { Entity, PersonaRef, VrmPick, WorldVrm } from '@/types';

/** A world offering nothing: every step has to be earned by the case that wants it. */
const bare: EnterFlowWorld = {
  traitCount: 0,
  startingLocationCount: 1,
  hasLibraryAdditions: false,
  hasWorldPersonas: false,
  showsAvatar: false,
};

const world = (over: Partial<EnterFlowWorld> = {}): EnterFlowWorld => ({ ...bare, ...over });

describe('buildEnterFlow', () => {
  it('opens with the Introduction when the world has one', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2 }), 'newGame'))
      .toEqual(['intro', 'workspace']);
  });

  it('leaves the Introduction out when the world has none', () => {
    expect(buildEnterFlow(world({ traitCount: 2 }), 'newGame')).toEqual(['workspace']);
  });

  it('treats whitespace-only Introduction text as none', () => {
    expect(buildEnterFlow(world({ introReadme: '   \n  ', traitCount: 2 }), 'newGame')).toEqual(['workspace']);
  });

  it('still shows the Introduction for a world with no traits', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', startingLocationCount: 3 }), 'newGame'))
      .toEqual(['intro', 'workspace']);
  });

  it('shows the workspace for world personas alone, so the player can pick one', () => {
    expect(buildEnterFlow(world({ hasWorldPersonas: true }), 'newGame')).toEqual(['workspace']);
  });

  it('skips every step, Introduction included, on Quick Start', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2, showsAvatar: true }), 'quickStart'))
      .toEqual([]);
  });

  it('skips every step, Introduction included, when a save is loaded', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome', traitCount: 2, showsAvatar: true }), 'saveLoad'))
      .toEqual([]);
  });

  it('keeps all library choices inside the workspace before Avatar', () => {
    const full = world({
      introReadme: 'hi',
      traitCount: 1,
      startingLocationCount: 2,
      hasLibraryAdditions: true,
      showsAvatar: true,
    });
    expect(buildEnterFlow(full, 'newGame'))
      .toEqual(['intro', 'workspace', 'avatar']);
  });

  it('offers no location step when the world has a single starting location', () => {
    expect(buildEnterFlow(world({ startingLocationCount: 1, traitCount: 1 }), 'newGame')).toEqual(['workspace']);
  });

  it('gives an Introduction-only world nothing to overlay', () => {
    expect(buildEnterFlow(world({ introReadme: '# Welcome' }), 'newGame')).toEqual(['intro']);
  });
});

describe('navigableSteps', () => {
  it('drops the Introduction, so Back never targets an overlay', () => {
    expect(navigableSteps(['intro', 'workspace', 'avatar'])).toEqual(['workspace', 'avatar']);
  });

  it('leaves a flow without an Introduction alone', () => {
    expect(navigableSteps(['workspace', 'avatar'])).toEqual(['workspace', 'avatar']);
  });
});

describe('the avatar step follows the draft persona', () => {
  const file = { name: 'a.vrm', type: 'model/gltf-binary', data: 'data:' };
  const vrmStore: Record<string, WorldVrm> = { knight: { name: 'Knight', file } };
  const entity = (id: string, vrmPick?: VrmPick, over: Partial<Entity> = {}): Entity => ({
    id, name: id, playerDescription: '', aiDescription: '', aiSummary: '', ...(vrmPick ? { vrmPick } : {}), ...over,
  });
  const knight = { kind: 'world', id: 'knight' } as const;
  const userDefault = { kind: 'default' } as const;
  // Two personas, one with an author Avatar and one on User's Default, and a bare third.
  const entities = [
    entity('hero', knight, { persona: true }),
    entity('scout', userDefault, { persona: true }),
    entity('ghost', undefined, { persona: true }),
  ];
  const as = (persona: PersonaRef, over: Partial<EntryVrmInput> = {}): EntryVrmInput => ({
    persona, libraryPersona: undefined, entities, overview: { vrmStore }, ...over,
  });
  const steps = (vrm: EntryVrmInput) => buildEnterFlow(world({ traitCount: 1, showsAvatar: !!entryVrmPick(vrm) }), 'newGame');

  it("shows the step for an author Avatar and for User's Default", () => {
    expect(entryVrmPick(as({ source: 'world', entityId: 'hero' }))).toEqual(knight);
    expect(entryVrmPick(as({ source: 'world', entityId: 'scout' }))).toEqual(userDefault);
  });

  it('skips the step for a persona with no Avatar', () => {
    expect(entryVrmPick(as({ source: 'world', entityId: 'ghost' }))).toBeUndefined();
    expect(steps(as({ source: 'world', entityId: 'ghost' }))).toEqual(['workspace']);
  });

  it('changes the step list with the persona pick', () => {
    expect(steps(as({ source: 'world', entityId: 'hero' }))).toEqual(['workspace', 'avatar']);
    expect(steps(as({ source: 'world', entityId: 'ghost' }))).toEqual(['workspace']);
    expect(steps(as({ source: 'world', entityId: 'scout' }))).toEqual(['workspace', 'avatar']);
  });

  it('skips a store id that is gone, as the game would', () => {
    expect(entryVrmPick(as({ source: 'world', entityId: 'hero' }, { overview: { vrmStore: {} } }))).toBeUndefined();
  });

  it("reads the Custom Persona's pick under None, and the legacy fallback after it", () => {
    const custom = entity('custom', knight, { customPersona: true });
    expect(entryVrmPick(as({ source: 'none' }, { entities: [...entities, custom] }))).toEqual(knight);
    expect(entryVrmPick(as({ source: 'none' }))).toBeUndefined();
    expect(entryVrmPick(as({ source: 'none' }, { overview: { vrmStore, legacyVrmFallback: userDefault } }))).toEqual(userDefault);
  });

  it("reads a library persona's pick from its loaded record, and no pick before the load", () => {
    const ref = { source: 'library', entityId: 'wanderer' } as const;
    const lib = { kind: 'library', id: 'lib-fox' } as const;
    expect(entryVrmPick(as(ref, { libraryPersona: { id: 'wanderer', vrmPick: lib } }))).toEqual(lib);
    expect(entryVrmPick(as(ref))).toBeUndefined();
  });
});
