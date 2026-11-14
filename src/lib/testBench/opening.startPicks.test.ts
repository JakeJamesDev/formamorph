import { describe, expect, it } from 'vitest';
import { inPlayWorldOf } from '@/lib/inPlayWorld';
import type { Entity, GameLocation, Trait, TraitGroup, TraitRequirement } from '@/types';
import { oneRoutine } from '@/test/routines';
import { buildLens } from './lens';
import { buildOpening, lensStartPicks, type OpeningWorld } from './opening';

// Sadie owns a Sex pick that defaults to Female; each partner is on under one of her picks. The scout is on
// while the player holds Reach-Born over the Sedge-Born default.
const origin: TraitGroup = { id: 'origin', name: 'Origin', parentId: null, maxPicks: 1 };
const sex: TraitGroup = { id: 'sex', name: 'Sex', parentId: null };
const traits: Trait[] = [
  { id: 'sedge', name: 'Sedge-Born', statChanges: [], groupId: 'origin', isDefault: true },
  { id: 'reach', name: 'Reach-Born', statChanges: [], groupId: 'origin' },
  { id: 'female', name: 'Female', statChanges: [], groupId: 'sex', isDefault: true },
  { id: 'futa', name: 'Futanari', statChanges: [], groupId: 'sex' },
];
const field: GameLocation = { id: 'field', name: 'Sports Field' };
const sadiePick = (id: string): TraitRequirement => ({ kind: 'trait', id, owner: { kind: 'entity', id: 'sadie' } });
const at = (id: string, name: string, enabledWhen?: TraitRequirement): Entity =>
  ({ id, name, kind: 'unique', routines: oneRoutine([{ id: `${id}-s`, place: 'field', weight: 1, schedule: [] }]), ...(enabledWhen && { enabledWhen: [{ all: [enabledWhen] }] }) });
const sadie: Entity = { ...at('sadie', 'Sadie'), traitLinks: [{ id: 'sadie-sex', originalId: 'sex', originalName: 'Sex', kind: 'group', groupId: null, order: 0 }] };
const world = {
  entities: [sadie, at('mudsdale', 'Mudsdale', sadiePick('female')), at('rapidash', 'Rapidash', sadiePick('futa')), at('scout', 'Scout', { kind: 'trait', id: 'reach' })],
  locations: [field], traits, traitGroups: [origin, sex], stats: [], placeholders: [],
} as unknown as OpeningWorld; // A world slice: the opening reads the rest as empty.

/** The names in the turn-one scene, as the Test Bench reads the world: gated under the lens's start picks. */
const scene = (pickedTraitId: string | null) => {
  const lens = buildLens(world, { personaId: null, locationId: 'field', pickedTraitId });
  const shown = inPlayWorldOf(world, null, undefined, lensStartPicks(world, lens));
  const system = buildOpening(shown, lens, {}, { startLocationId: 'field' }).system;
  const block = system.split('## Entities in the Current Location')[1]?.split(/\n## /)[0] ?? '';
  return [...block.matchAll(/^- \*\*(.+?)\*\*$/gm)].map((m) => m[1]).sort();
};

describe('the Test Bench opening gates entities as play does', () => {
  it("keeps the partner Sadie's default pick turns on, and drops the other", () => {
    expect(scene(null)).toEqual(['Mudsdale', 'Sadie']);
  });

  it("reads the lens's picked trait over the default", () => {
    expect(scene('reach')).toEqual(['Mudsdale', 'Sadie', 'Scout']);
  });
});
