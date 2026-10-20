import { describe, expect, it } from 'vitest';
import { boxOwnerOf } from './codeBoxOwner';
import type { UnitOwner } from './sandboxSnapshot';
import { statCodeBoxes, statCodeOwners, traitCodeBoxes } from './statCodeTargets';
import type { Entity, Placeholder, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait =>
  ({ id, name, statChanges: [], scripts: boxScripts({ after: 'return 0;' }), ...extra });

const code = { scripts: boxScripts({ after: 'return 0;' }) };
const statBlueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;
const traitBlueprints: TraitGroup = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const pack = { id: 'pack', name: 'Pack', parentId: 'bp' } as StatGroup;
const howl = stat('howl', 'Howl', { groupId: 'pack', ...code });
const beast: Placeholder = { id: 'ph-beast', name: 'Beast', values: [{ id: 'v-wolf', text: 'Wolf' }] };
const fang = stat('fang', '{{ph:ph-beast:world:p1}} Fang', { groupId: 'pack' });
const mara: Entity = {
  id: 'mara', name: 'Mara',
  stats: [stat('grit', 'Grit', code)],
  traits: [trait('calm', 'Calm')],
  statLinks: [{
    id: 'l-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null, order: 1,
    overrides: { howl: { scripts: { value: boxScripts({ after: 'return 1;' }), blueprint: howl.scripts ?? [] } } },
  }],
};
const world = {
  stats: [stat('courage', 'Courage', code), howl, fang],
  statGroups: [statBlueprints, pack],
  entities: [mara],
  traits: [trait('brave', 'Brave'), trait('wild', 'Wild', { groupId: 'tbp' })],
  traitGroups: [traitBlueprints],
  placeholders: [beast],
};

describe('boxOwnerOf', () => {
  const owners = statCodeOwners(world);
  const statOwner = (statId: string, entity: string | null) =>
    boxOwnerOf(statCodeBoxes(owners).find((box) => box.stat.id === statId && (box.entity?.id ?? null) === entity)!, world.placeholders);
  const traitOwner = (traitId: string) => boxOwnerOf(traitCodeBoxes(owners, world).find((box) => box.trait.id === traitId)!, world.placeholders);

  it.each<[string, () => UnitOwner, UnitOwner]>([
    ['a global stat', () => statOwner('courage', null), { kind: 'none' }],
    ['an entity stat', () => statOwner('grit', 'mara'), { kind: 'entity', entityId: 'mara' }],
    ['a link that overrides a Blueprint stat', () => statOwner('howl', 'mara'), { kind: 'entity', entityId: 'mara' }],
    ['a global trait', () => traitOwner('brave'), { kind: 'none' }],
    ['an entity trait', () => traitOwner('calm'), { kind: 'entity', entityId: 'mara' }],
    ['a Blueprint trait', () => traitOwner('wild'), { kind: 'blueprintTrait' }],
  ])('derives the Owner of %s', (_, owner, expected) => {
    expect(owner()).toEqual(expected);
  });

  it('gives a Blueprint stat its group’s stats as its Owner, under their code names', () => {
    const owner = statOwner('howl', null);
    expect(owner.kind).toBe('blueprintStat');
    expect(owner.kind === 'blueprintStat' && owner.stats.map((s) => s.name)).toEqual(['Howl', 'Beast Fang']);
  });
});
