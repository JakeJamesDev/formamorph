import { describe, expect, it } from 'vitest';
import { buildEntityCardData, parseEntityCardData } from './entityFile';
import { bindOwnedTraits } from './portableTraits';
import { duplicateEntityNode } from './entityGroupTree';
import { editorGateInput } from './owners';
import { gateOf, gateStates } from './traitGates';
import type { OpeningKey } from './drawnOpening';
import type { Entity, OpeningRequirement, TraitRequirementRow } from '@/types';

const own: OpeningKey = { ownerId: 'aki', openingId: 'a1' };
const worlds: OpeningKey = { ownerId: null, openingId: 'w1' };
const onOpening = (openings: OpeningKey[]): OpeningRequirement => ({ kind: 'opening', openings });

const aki: Entity = {
  id: 'aki', name: 'Aki', description: '', locations: [],
  openings: [{ id: 'a1', text: 'Hi.', kind: 'action' }],
  traits: [
    { id: 't1', name: 'Route', statChanges: [], requires: [{ all: [onOpening([own, worlds])] }] },
    { id: 't2', name: 'World Route', statChanges: [], requires: [{ all: [onOpening([worlds])] }] },
  ],
} as Entity;

const requiresOf = (e: Entity, id: string): TraitRequirementRow[] | undefined => e.traits?.find((t) => t.id === id || t.name === id)?.requires;

describe('an Opening Condition on an entity card', () => {
  const imported = parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(aki))));
  const bound = bindOwnedTraits(imported, { traits: [], traitGroups: [], entities: [imported] });
  const newOpeningId = imported.openings![0].id;

  it('carries keys on its own Openings, rebound to the imported entity and its fresh Opening ids', () => {
    expect(newOpeningId).not.toBe('a1');
    expect(requiresOf(bound, 'Route')).toEqual([{ all: [onOpening([{ ownerId: imported.id, openingId: newOpeningId }])] }]);
  });

  it('drops every other key, and keeps a Condition left with none locked rather than widening the gate', () => {
    expect(requiresOf(bound, 'World Route')).toEqual([{ all: [onOpening([])] }]);
    const id = bound.traits!.find((t) => t.name === 'World Route')!.id;
    const states = gateStates(editorGateInput({ traits: [], traitGroups: [], entities: [bound], opening: worlds }));
    expect(gateOf(states, bound.id, id)!.unlocked).toBe(false);
  });
});

describe('an Opening Condition on a duplicated entity', () => {
  it('follows the copy and its fresh Opening ids, and leaves other owners alone', () => {
    const { entities, newId } = duplicateEntityNode([], [aki], 'aki');
    const copy = entities.find((e) => e.id === newId)!;
    const copyOpening = copy.openings![0].id;
    expect(copyOpening).not.toBe('a1');
    expect(copy.traits![0].requires).toEqual([{ all: [onOpening([{ ownerId: newId, openingId: copyOpening }, worlds])] }]);
    expect(requiresOf(entities.find((e) => e.id === 'aki')!, 't1')).toEqual(aki.traits![0].requires);
  });
});
