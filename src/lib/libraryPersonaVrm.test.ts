import { describe, expect, it } from 'vitest';
import { resolvePersona } from './persona';
import { bindLibraryEntity } from './blueprintTravel';
import { playLibraryStats } from './portableStats';
import { resolveEntityVrm, resolvePlayedVrm, type VrmContext } from './vrmResolver';
import type { Entity, MediaAsset } from '@/types';

/**
 * A library persona's Avatar pick, read from the library entity the save plays, wins over the world's Custom
 * Persona pick (Q7). The persona resolution hands the resolver the library entity as stored, pick included.
 */

const file: MediaAsset = { data: 'data:model/vrm;base64,AA==', type: 'model/vrm' };
const custom = { id: 'cp', name: 'Newcomer', customPersona: true, vrmPick: { kind: 'world', id: 'w-reed' } } as Entity;
const store = { 'w-reed': { name: 'Reed', file } };

const context = (libraryEntity: Entity): VrmContext => {
  const { persona } = resolvePersona({ source: 'library', entityId: libraryEntity.id }, [custom], [libraryEntity]);
  if (persona?.source !== 'library') throw new Error('expected a library persona');
  return {
    store, libraryIds: new Set(['heron']), deviceDefault: undefined,
    played: { source: 'library', entity: persona.entity }, customPersona: custom,
  };
};

describe('playing a library persona', () => {
  it('shows its library pick over the Custom Persona pick', () => {
    const ctx = context({ id: 'lib-w', name: 'Wren', vrmPick: { kind: 'library', id: 'heron' } } as Entity);
    expect(resolvePlayedVrm(ctx)).toEqual({ kind: 'library', id: 'heron' });
    expect(resolveEntityVrm({ id: 'lib-w' }, ctx)).toEqual({ kind: 'library', id: 'heron' });
  });

  it('keeps its pick through the snapshot Enter World builds for the save', () => {
    const world = { traits: [], traitGroups: [], entities: [custom], stats: [], statGroups: [], blueprints: [], placeholders: [] };
    const snapshot = bindLibraryEntity(
      playLibraryStats({ id: 'lib-w', name: 'Wren', vrmPick: { kind: 'library', id: 'heron' } } as Entity, world), world,
    );
    expect(snapshot.vrmPick).toEqual({ kind: 'library', id: 'heron' });
    expect(resolvePlayedVrm(context(snapshot))).toEqual({ kind: 'library', id: 'heron' });
  });

  it('falls back to the Custom Persona pick when its own pick is none', () => {
    const ctx = context({ id: 'lib-w', name: 'Wren' } as Entity);
    expect(resolvePlayedVrm(ctx)).toEqual({ kind: 'world', id: 'w-reed' });
  });
});
