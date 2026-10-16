import { describe, it, expect } from 'vitest';
import { codeCard, type CodeCard } from './codeCards';
import { statBoxLookup, type CodeBoxOwner, type CodeCardWorld } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { PlaceholderOwners } from './placeholderHomes';
import type { Entity, Placeholder, Stat, StatGroup, StatLink, Trait, TraitGroup, TraitLink } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });
const braveLink = (id: string): TraitLink => ({ id, originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null });
const howlLink = (id: string): StatLink => ({ id, originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null });

const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const courage = stat('courage', 'Courage');
const howl = stat('howl', 'Howl', { groupId: 'bp' });
const traitBlueprints: TraitGroup = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const brave = trait('brave', 'Brave', { playerDescription: 'Faces danger without flinching.', mode: 'alwaysOn', groupId: 'tbp' });

const look: Placeholder = { id: 'look', name: 'Look', values: [{ id: 'grim', text: 'grim' }, { id: 'sly', text: 'sly' }] };
const copyOfLook = (id: string): Placeholder => ({ id, name: 'Look', blueprintId: 'look', values: [] });
const ownLook = (id: string): Placeholder => ({ id, name: 'Look', values: [{ id: 'odd', text: 'odd' }] });

// Tom and Sam link the world's Brave and hold Copies of Look. Ann owns a Brave and a Look of her own.
const tom: Entity = { id: 'tom', name: 'Tom', persona: true, traitLinks: [braveLink('tom-brave')], statLinks: [howlLink('tom-howl')] };
const sam: Entity = { id: 'sam', name: 'Sam', persona: true, traitLinks: [braveLink('sam-brave')], statLinks: [howlLink('sam-howl')] };
const ann: Entity = { id: 'ann', name: 'Ann', persona: true, traits: [trait('ann-brave', 'Brave')], statLinks: [howlLink('ann-howl')] };
const kit: Entity = { id: 'kit', name: 'Kit', persona: true, statLinks: [howlLink('kit-howl')] };

const allPlaceholders = [look, copyOfLook('tom-look'), copyOfLook('sam-look'), ownLook('ann-look')];
const placeholderOwners: PlaceholderOwners = new Map([
  ['tom-look', { kind: 'entity', id: 'tom', name: 'Tom' }],
  ['sam-look', { kind: 'entity', id: 'sam', name: 'Sam' }],
  ['ann-look', { kind: 'entity', id: 'ann', name: 'Ann' }],
]);

/** A world whose playable entities, and Howl's owners, are `entities`. */
const worldOf = (...entities: Entity[]): CodeCardWorld => ({
  traits: [brave], traitGroups: [traitBlueprints], entities, stats: [courage, howl], statGroups: [blueprints],
  placeholders: allPlaceholders, placeholderOwners,
});

/** A box's options as the stat editor builds them: Courage's world box, or Howl's Blueprint box. */
function box(world: CodeCardWorld, owner: CodeBoxOwner | null): SurfaceAnalysisOptions {
  const self = owner ? howl : courage;
  return {
    surface: STAT_CODE_SURFACE,
    selfName: self.name,
    ...(owner ? { owner: owner.kind } : {}),
    statNames: ['Courage', 'Howl'],
    ownerStatNames: owner ? ['Howl'] : [],
    traits: worldTraitPlaces(world, allPlaceholders).map((place) => place.name),
    entities: entityTraitNames(world, allPlaceholders),
    placeholders: { list: allPlaceholders, owners: placeholderOwners, dictionaries: [] },
    lookup: statBoxLookup(statCodeOwners({ ...world, placeholders: allPlaceholders }), { owner, timing: 'after', self }, world),
  };
}

const worldBox = (...entities: Entity[]) => box(worldOf(...entities), null);
const howlBox = (...entities: Entity[]) => box(worldOf(...entities), { kind: 'blueprint' });

function cardAt(doc: string, options: SurfaceAnalysisOptions): CodeCard | null {
  return codeCard(doc.replace('|', ''), doc.indexOf('|'), options);
}

const rowsOf = (card: CodeCard | null) => Object.fromEntries((card?.rows ?? []).map((row) => [row.label, row.value]));

describe('trait cards on a route that reaches several entities (Q37)', () => {
  it('shows the shared trait with the reached entities as Owners through `persona.traits`', () => {
    const card = cardAt('return persona.traits.Br|ave.enabled;', worldBox(tom, sam));
    expect(rowsOf(card)).toEqual({ Mode: 'Automatic', Owners: 'Tom, Sam' });
    expect(card?.description).toBe('Faces danger without flinching.');
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('shows only who owns one where the owners’ traits differ', () => {
    const card = cardAt('return persona.traits.Br|ave.enabled;', worldBox(tom, ann));
    expect(card?.rows).toEqual([{ label: 'Owners', value: 'Tom, Ann' }]);
    expect(card?.description).toBeUndefined();
    expect(card?.item).toBeUndefined();
  });

  it('leaves out a reached entity that holds no such trait', () => {
    expect(rowsOf(cardAt('return persona.traits.Br|ave.enabled;', worldBox(kit, tom)))).toEqual({ Mode: 'Automatic', Owners: 'Tom' });
  });

  // Q8, Q33: a Blueprint trait sits in the editor's global tree, but global scope is never an owner.
  it('keeps the plain card with every entity owner where `persona` reaches one entity (T15-1)', () => {
    const card = cardAt('return persona.traits.Br|ave.enabled;', worldBox(tom));
    expect(rowsOf(card)).toEqual({ Mode: 'Automatic', Owners: 'Tom' });
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('shows no World Details where no reached entity holds the trait', () => {
    expect(cardAt('return persona.traits.Br|ave.enabled;', worldBox(kit))?.rows).toBeUndefined();
  });

  it('follows the same rule through `owner.traits` in a Blueprint box', () => {
    expect(rowsOf(cardAt('return owner.traits.Br|ave.enabled;', howlBox(tom, sam)))).toEqual({ Mode: 'Automatic', Owners: 'Tom, Sam' });
    const mixed = cardAt('return owner.traits.Br|ave.enabled;', howlBox(tom, ann));
    expect(mixed?.rows).toEqual([{ label: 'Owners', value: 'Tom, Ann' }]);
    expect(mixed?.item).toBeUndefined();
  });
});

describe('placeholder cards on a route that reaches several entities (Q37)', () => {
  it('shows the Blueprint every owner’s Copy shares, with the reached entities as Owners', () => {
    const card = cardAt('return owner.placeholders.Lo|ok.value;', howlBox(tom, sam));
    expect(rowsOf(card)).toEqual({ Owners: 'Tom, Sam', Kind: 'Wildcard' });
    expect(card?.signature.scope).toBeUndefined();
    expect(card?.allowedValues?.values.map((value) => value.text)).toEqual(['grim', 'sly']);
    expect(card?.item).toEqual({ kind: 'placeholder', placeholderId: 'look' });
  });

  it('shows the one owner’s Copy where a single entity owns it', () => {
    const card = cardAt('return owner.placeholders.Lo|ok.value;', howlBox(kit, tom));
    expect(rowsOf(card)).toEqual({ Owners: 'Tom', Kind: 'Wildcard' });
    expect(card?.item).toEqual({ kind: 'placeholder', placeholderId: 'tom-look' });
  });

  it('shows only who owns one where the owners’ placeholders differ', () => {
    const card = cardAt('return owner.placeholders.Lo|ok.value;', howlBox(tom, ann));
    expect(card?.rows).toEqual([{ label: 'Owners', value: 'Tom, Ann' }]);
    expect(card?.allowedValues).toBeUndefined();
    expect(card?.item).toBeUndefined();
  });

  it('follows the same rule through `persona.placeholders`', () => {
    expect(rowsOf(cardAt('return persona.placeholders.Lo|ok.value;', worldBox(tom, sam))).Owners).toBe('Tom, Sam');
    expect(cardAt('return persona.placeholders.Lo|ok.value;', worldBox(tom, ann))?.rows).toEqual([{ label: 'Owners', value: 'Tom, Ann' }]);
  });

  it('keeps the plain card with one Owners row where a Blueprint box has one owner (T15-1)', () => {
    expect(rowsOf(cardAt('return owner.placeholders.Lo|ok.value;', howlBox(tom)))).toEqual({ Owners: 'Tom', Kind: 'Wildcard' });
  });

  it('shows no World Details where no reached entity holds the placeholder', () => {
    expect(cardAt('return owner.placeholders.Lo|ok.value;', howlBox(kit))?.rows).toBeUndefined();
  });
});
