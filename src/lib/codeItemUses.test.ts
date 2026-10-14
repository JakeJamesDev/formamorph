import { describe, expect, it } from 'vitest';
import type { CodeCardItem } from './codeCards';
import type { CodeUse } from './codeUses';
import { statBoxLookup, type CodeCardWorld } from './codeWorldLookup';
import type { PlaceholderOwners } from './placeholderHomes';
import { statCodeOwners } from './statCodeTargets';
import type { Dictionary, Entity, Placeholder, Stat, StatGroup, Trait } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

// Ann and Tom can be played: Ann owns a Brave of her own, Tom links the world's. Bram owns a third Brave.
// Mara and Bram each own a Copy of Look and bear Howl. Bram's Link of Echo overrides its code.
const brave = trait('brave', 'Brave');
const mood: Placeholder = { id: 'mood', name: 'Mood', values: [{ id: 'calm', text: 'calm' }] };
const look: Placeholder = { id: 'look', name: 'Look', values: [{ id: 'grim', text: 'grim' }] };
const maraLook: Placeholder = { id: 'mara-look', name: 'Look', blueprintId: 'look', values: [] };
const bramLook: Placeholder = { id: 'bram-look', name: 'Look', blueprintId: 'look', values: [] };
const beast: Placeholder = { id: 'beast', name: 'Beast', values: [{ id: 'wolf', text: 'wolf' }] };
const fauna: Dictionary = { id: 'fauna', name: 'Fauna', entries: [] };
const blueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;

const courage = stat('courage', 'Courage', {
  code: [
    'const b = traits.Brave;',
    'const m = placeholders.Mood;',
    'const e = entities.Mara.placeholders.Look;',
    'const d = dictionaries.Fauna.placeholders.Beast;',
    'const w = placeholders.Look;',
    "const s = entities['Mara'];",
  ].join('\n'),
});
const howl = stat('howl', 'Howl', {
  groupId: 'bp', code: 'const o = owner;\nconst p = owner.placeholders.Look;\nconst t = owner.traits.Brave;',
});
const echo = stat('echo', 'Echo', { groupId: 'bp', code: 'return 0;' });
const statLink = (id: string, original: Stat, code?: string) => ({
  id, originalId: original.id, kind: 'stat' as const, originalName: original.name, groupId: null, order: 1,
  ...(code === undefined ? {} : { overrides: { [original.id]: { code: { value: code, blueprint: original.code ?? '' } } } }),
});
const mara: Entity = {
  id: 'mara', name: 'Mara',
  stats: [stat('mara-health', 'Health', {
    beforeCode: 'owner.stats.Health.value = 1;\nconst t = owner.traits.Calm; const u = owner;\nconst n = persona.traits.Brave;',
  })],
  traits: [trait('calm', 'Calm')],
  statLinks: [statLink('l-mara', howl)],
};
const ann: Entity = { id: 'ann', name: 'Ann', persona: true, traits: [trait('ann-brave', 'Brave')] };
const tom: Entity = { id: 'tom', name: 'Tom', persona: true, traitLinks: [{ id: 'tom-brave', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null }] };
const bram: Entity = {
  id: 'bram', name: 'Bram',
  stats: [stat('bram-grit', 'Grit', { beforeCode: 'const x = owner.traits.Brave;\nconst y = traits.Brave;' })],
  traits: [trait('bram-brave', 'Brave')],
  statLinks: [statLink('l-bram', howl), statLink('l-bram-echo', echo, 'const o = owner;')],
};

const placeholders = [mood, look, maraLook, bramLook, beast];
const placeholderOwners: PlaceholderOwners = new Map([
  ['mara-look', { kind: 'entity', id: 'mara', name: 'Mara' }],
  ['bram-look', { kind: 'entity', id: 'bram', name: 'Bram' }],
  ['beast', { kind: 'dictionary', id: 'fauna', name: 'Fauna' }],
]);
const world: CodeCardWorld = {
  traits: [brave], traitGroups: [], entities: [mara, ann, tom, bram],
  stats: [courage, howl, echo], statGroups: [blueprints], placeholders, placeholderOwners, dictionaries: [fauna],
};

/** Asked as a card asks: through a box's lookup, from any box. */
const usesOf = (item: CodeCardItem) => {
  const owners = statCodeOwners({ ...world, placeholders });
  return statBoxLookup(owners, { owner: null, timing: 'after', self: courage }, world).uses(item);
};
const rows = (uses: CodeUse[]) => uses.map((use) => `${use.entity ? `${use.entity} › ` : ''}${use.stat} ${use.timing} ${use.line}`);

describe('Find All Uses for other kinds', () => {
  it('keeps a world trait apart from an entity’s namesake and joins every route to it', () => {
    expect(rows(usesOf({ kind: 'trait', traitId: 'brave' }))).toEqual(['Courage after 1', 'Mara › Health before 3', 'Bram › Grit before 2']);
    expect(rows(usesOf({ kind: 'trait', traitId: 'bram-brave', entityId: 'bram' }))).toEqual(['Howl after 3', 'Bram › Grit before 1']);
    expect(rows(usesOf({ kind: 'trait', traitId: 'calm', entityId: 'mara' }))).toEqual(['Mara › Health before 2']);
  });

  it('matches persona.traits through every entity that can be played, not only the first (T12-4)', () => {
    // Ann's Brave and Tom's world Brave differ, so the card names neither; each is reached all the same.
    expect(rows(usesOf({ kind: 'trait', traitId: 'ann-brave', entityId: 'ann' }))).toEqual(['Mara › Health before 3']);
    expect(rows(usesOf({ kind: 'trait', traitId: 'brave' }))).toContain('Mara › Health before 3');
  });

  it('matches a Blueprint placeholder and its Copies, and a Copy alone', () => {
    expect(rows(usesOf({ kind: 'placeholder', placeholderId: 'look' }))).toEqual(['Courage after 3', 'Courage after 5', 'Howl after 2']);
    expect(rows(usesOf({ kind: 'placeholder', placeholderId: 'mara-look' }))).toEqual(['Courage after 3', 'Howl after 2']);
    expect(rows(usesOf({ kind: 'placeholder', placeholderId: 'beast' }))).toEqual(['Courage after 4']);
  });

  it('matches owner.placeholders in a Blueprint box through every owner, not only the first (T12-4)', () => {
    expect(rows(usesOf({ kind: 'placeholder', placeholderId: 'bram-look' }))).toEqual(['Howl after 2']);
  });

  it('counts an own or Link box’s owner as its entity, once per line, and never a Blueprint box’s', () => {
    expect(rows(usesOf({ kind: 'entity', entityId: 'mara' }))).toEqual([
      'Courage after 3', 'Courage after 6', 'Mara › Health before 1', 'Mara › Health before 2',
    ]);
    expect(rows(usesOf({ kind: 'entity', entityId: 'bram' }))).toEqual(['Bram › Grit before 1', 'Bram › Echo after 1']);
  });

  it('matches a dictionary by its id', () => {
    expect(rows(usesOf({ kind: 'dictionary', dictionaryId: 'fauna' }))).toEqual(['Courage after 4']);
    expect(usesOf({ kind: 'dictionary', dictionaryId: 'missing' })).toEqual([]);
  });

  it('finds nothing without the world beyond its stats', () => {
    const owners = statCodeOwners({ ...world, placeholders });
    expect(statBoxLookup(owners, { owner: null, timing: 'after', self: courage }).uses({ kind: 'entity', entityId: 'mara' })).toEqual([]);
  });
});
