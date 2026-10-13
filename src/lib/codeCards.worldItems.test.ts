import { describe, it, expect } from 'vitest';
import { codeCard, CARD_LIST_CAP, listText, placeholderValues, type CodeCard } from './codeCards';
import { statBoxLookup, type CodeBoxOwner, type CodeCardWorld } from './codeWorldLookup';
import { statCodeCompletions, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { PlaceholderOwners } from './placeholderHomes';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });

const courage = stat('courage', 'Courage');
const stamina = stat('stamina', 'Stamina');
const fatigue = stat('fatigue', 'Fatigue', { type: 'percentage' });

const brave = trait('brave', 'Brave', {
  playerDescription: 'Faces danger without flinching.',
  requires: [
    { all: [{ kind: 'stat', id: 'courage', operator: '>=', value: 50, unit: 'raw' }, { kind: 'trait', id: 'shy', not: true }] },
    { all: [{ kind: 'playingAs', id: 'tom' }] },
  ],
  statChanges: [{ statId: 'stamina', value: 10, type: 'max' }, { statId: 'fatigue', value: -1, type: 'regen' }],
  statToggles: [{ statId: 'fatigue', enabled: false }],
  placeholderPins: [{ placeholderId: 'mood', value: 'calm', valueId: 'calm' }],
});
const shy = trait('shy', 'Shy', { mode: 'alwaysOn' });

const mood: Placeholder = {
  id: 'mood', name: 'Mood', roll: true,
  values: [{ id: 'calm', text: 'calm' }, { id: 'wary', text: 'wary' }, { id: 'giddy', text: 'giddy' }],
  weights: { calm: 2, giddy: 0 },
};
// Mara's Copy benches one Blueprint value and keeps the other's weight.
const look: Placeholder = { id: 'look', name: 'Look', values: [{ id: 'grim', text: 'grim' }, { id: 'sly', text: 'sly' }], weights: { sly: 3 } };
const maraLook: Placeholder = {
  id: 'mara-look', name: 'Look', blueprintId: 'look', values: [],
  valueOverrides: { grim: { weight: { value: 0, blueprint: 1 } } },
};
const beast: Placeholder = { id: 'beast', name: 'Beast', values: [{ id: 'wolf', text: 'wolf' }] };

const mara: Entity = {
  id: 'mara', name: 'Mara', type: 'Ranger', playerDescription: 'A quiet scout.',
  stats: [stat('mara-health', 'Health')],
  traits: [trait('calm', 'Calm', { mode: 'hidden' })],
};
const tom: Entity = { id: 'tom', name: 'Tom', persona: true, traitLinks: [{ id: 'tom-brave', originalId: 'brave', kind: 'trait', originalName: 'Brave', groupId: null }] };
const fen: GameLocation = { id: 'fen', name: 'Fen', placeholderPins: [{ placeholderId: 'mood', value: 'wary', valueId: 'wary' }] } as GameLocation;
const fauna: Dictionary = {
  id: 'fauna', name: 'Fauna', description: 'Animals of the marsh.',
  entries: [{ id: 'e1', name: 'Heron', key: ['heron'], value: 'A grey bird.' }, { id: 'e2', name: 'Eel', key: ['eel'], value: 'A slick fish.' }],
};

const placeholders = [mood, look, maraLook, beast];
const placeholderOwners: PlaceholderOwners = new Map([
  ['mara-look', { kind: 'entity', id: 'mara', name: 'Mara' }],
  ['beast', { kind: 'dictionary', id: 'fauna', name: 'Fauna' }],
]);
const cardWorld: CodeCardWorld = {
  traits: [brave, shy], traitGroups: [], entities: [mara, tom], locations: [fen],
  stats: [courage, stamina, fatigue], statGroups: [], placeholders, placeholderOwners, dictionaries: [fauna],
};

/** A box's options as the stat editor builds them, with the card world bound. */
function box(owner: CodeBoxOwner | null, self: Stat, withWorld = true, from: CodeCardWorld = cardWorld): SurfaceAnalysisOptions {
  const owners = statCodeOwners({ stats: from.stats, entities: from.entities, placeholders });
  return {
    surface: STAT_CODE_SURFACE,
    selfName: self.name,
    ...(owner ? { owner: owner.kind } : {}),
    statNames: ['Courage', 'Stamina', 'Fatigue'],
    traits: worldTraitPlaces(from, placeholders).map((place) => place.name),
    entities: entityTraitNames(from, placeholders),
    placeholders: { list: placeholders, owners: placeholderOwners, dictionaries: [{ id: 'fauna', name: 'Fauna' }] },
    lookup: statBoxLookup(owners, { owner, timing: 'after', self }, withWorld ? from : undefined),
  };
}

const worldBox = box(null, courage);
const maraBox = box({ kind: 'entity', entityId: 'mara' }, mara.stats![0]);

function cardAt(doc: string, options: SurfaceAnalysisOptions): CodeCard | null {
  return codeCard(doc.replace('|', ''), doc.indexOf('|'), options);
}

const rowsOf = (card: CodeCard | null) => Object.fromEntries((card?.rows ?? []).map((row) => [row.label, row.value]));

function labels(doc: string, options: SurfaceAnalysisOptions) {
  return (statCodeCompletions(doc.replace('|', ''), doc.indexOf('|'), options)?.options ?? []).map((option) => option.label);
}

describe('trait cards', () => {
  it('shows Mode, Requires, Changes and Bearers, with the description and the item', () => {
    const card = cardAt('return traits.Br|ave.enabled;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Mode', value: 'Optional' },
      { label: 'Requires', value: 'Courage >= 50 and not Shy\nor playing as Tom' },
      { label: 'Changes', value: 'Stamina max +10, Fatigue regen −1%, Fatigue off' },
      { label: 'Bearers', value: 'You, Tom' },
    ]);
    expect(card?.description).toBe('Faces danger without flinching.');
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('names Automatic by its player-facing name and drops empty Requires and Changes', () => {
    expect(rowsOf(cardAt('return traits.Sh|y.enabled;', worldBox))).toEqual({ Mode: 'Automatic', Bearers: 'You' });
  });

  it('reaches an entity’s own trait by its route, with the entity on the item', () => {
    const card = cardAt('return entities.Mara.traits.Ca|lm.enabled;', worldBox);
    expect(rowsOf(card)).toEqual({ Mode: 'Hidden', Bearers: 'Mara' });
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'calm', entityId: 'mara' });
  });

  it('reaches a linked trait through `persona` as the original', () => {
    expect(cardAt('return persona.traits.Br|ave.enabled;', worldBox)?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('reaches the box owner’s trait through `owner.traits`, and shows its card', () => {
    expect(rowsOf(cardAt('return owner.traits.Ca|lm.enabled;', maraBox))).toEqual({ Mode: 'Hidden', Bearers: 'Mara' });
  });

  it('shows no World Details where the box has no card world', () => {
    expect(cardAt('return traits.Br|ave.enabled;', box(null, courage, false))?.rows).toBeUndefined();
  });
});

describe('owner names in completion (T01-1, T01-3)', () => {
  it('offers the owner’s traits after `owner.traits["` and its placeholders after `owner.placeholders.`', () => {
    expect(labels('return owner.traits["|"];', maraBox)).toEqual(['Calm']);
    expect(labels('return owner.placeholders.|', maraBox)).toEqual(['Look']);
  });

  it('offers nothing through `owner` in a world stat’s box', () => {
    expect(labels('return owner.traits["|"];', worldBox)).toEqual([]);
    expect(labels('return owner.placeholders.|', worldBox)).toEqual([]);
  });

  it('offers nothing without the box lookup, as before', () => {
    const { lookup: _lookup, ...unbound } = maraBox;
    expect(labels('return owner.traits["|"];', unbound)).toEqual([]);
    expect(labels('return owner.placeholders.|', unbound)).toEqual([]);
  });
});

describe('placeholder cards', () => {
  it('shows Owner, Kind and Pinned By in Pin precedence, and every value with its weight', () => {
    const card = cardAt('return placeholders.Mo|od.value;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Owner', value: 'World' },
      { label: 'Kind', value: 'Wildcard' },
      { label: 'Pinned By', value: 'Location: Fen: wary\nTrait: Brave: calm' },
    ]);
    expect(card?.allowedValues).toEqual({
      values: [{ text: 'calm', weight: 2 }, { text: 'wary', weight: 1 }, { text: 'giddy', weight: 0 }],
      more: 0,
    });
    expect(card?.item).toEqual({ kind: 'placeholder', placeholderId: 'mood' });
  });

  it('shows a Copy’s own weights, under its owner, with no Pinned By row', () => {
    const card = cardAt('return owner.placeholders.Lo|ok.value;', maraBox);
    expect(rowsOf(card)).toEqual({ Owner: 'Mara', Kind: 'Wildcard' });
    expect(card?.allowedValues?.values).toEqual([{ text: 'grim', weight: 0 }, { text: 'sly', weight: 3 }]);
  });

  it('reads a negative or broken weight as benched, as the draw does', () => {
    expect(placeholderValues({ ...mood, weights: { calm: -2, wary: Number.NaN } }).values)
      .toEqual([{ text: 'calm', weight: 0 }, { text: 'wary', weight: 1 }, { text: 'giddy', weight: 1 }]);
  });

  it('cuts a long value list at the cap', () => {
    const many: Placeholder = { id: 'many', name: 'Many', values: Array.from({ length: CARD_LIST_CAP + 3 }, (_, i) => ({ id: `v${i}`, text: `v${i}` })) };
    const options = box(null, courage);
    const wide = { ...options, placeholders: { ...options.placeholders!, list: [...placeholders, many] } };
    const lookup = statBoxLookup(statCodeOwners({ stats: [courage], placeholders: [] }), { owner: null, timing: 'after', self: courage },
      { ...cardWorld, placeholders: [...placeholders, many] });
    const card = cardAt('return placeholders.Ma|ny.value;', { ...wide, lookup });
    expect(card?.allowedValues?.values).toHaveLength(CARD_LIST_CAP);
    expect(card?.allowedValues?.more).toBe(3);
  });
});

describe('entity, dictionary and persona cards', () => {
  it('shows an entity’s description and what it holds', () => {
    const card = cardAt('return entities.Ma|ra.name;', worldBox);
    expect(card?.description).toBe('A quiet scout.');
    expect(rowsOf(card)).toEqual({ Type: 'Ranger', Stats: 'Health', Traits: 'Calm', Placeholders: 'Look' });
    expect(card?.item).toEqual({ kind: 'entity', entityId: 'mara' });
    expect(rowsOf(cardAt('return entities.T|om.name;', worldBox))).toEqual({ Persona: 'Can be played', Stats: 'None', Traits: 'Brave', Placeholders: 'None' });
  });

  it('leaves out an entity’s AI-only description', () => {
    const quiet: Entity = { id: 'quiet', name: 'Quiet', aiDescription: 'For the AI only.' };
    const card = cardAt('return entities.Qu|iet.name;', box(null, courage, true, { ...cardWorld, entities: [mara, tom, quiet] }));
    expect(card?.item).toEqual({ kind: 'entity', entityId: 'quiet' });
    expect(card?.description).toBeUndefined();
  });

  it('shows the plain `owner` card in an owned box whose entity is gone', () => {
    const card = cardAt('return own|er.name;', box({ kind: 'entity', entityId: 'gone' }, courage));
    expect(card?.rows).toBeUndefined();
    expect(card?.description).not.toMatch(/Holds nothing/);
  });

  it('shows the entity rows on `owner` in an owned box (T06-6)', () => {
    const card = cardAt('return own|er.name;', maraBox);
    expect(rowsOf(card)).toEqual({ Type: 'Ranger', Stats: 'Health', Traits: 'Calm', Placeholders: 'Look' });
    expect(card?.item).toEqual({ kind: 'entity', entityId: 'mara' });
  });

  it('shows a dictionary’s description, its placeholders and its entry count', () => {
    const card = cardAt('return dictionaries.Fa|una.name;', worldBox);
    expect(card?.description).toBe('Animals of the marsh.');
    expect(rowsOf(card)).toEqual({ Placeholders: 'Beast', Entries: '2' });
    expect(card?.item).toEqual({ kind: 'dictionary', dictionaryId: 'fauna' });
  });

  it('lists who the player can play on `persona`, and how code reaches the Custom Persona', () => {
    const card = cardAt('return pers|ona.name;', worldBox);
    expect(card?.rows).toEqual([{ label: 'Can Play', value: 'Tom' }]);
    expect(card?.description).toMatch(/Under a library persona, reach the Custom Persona through entities\[\.\.\.\]$/);
  });
});

describe('clock.daypart', () => {
  it('lists the six dayparts with no weights, also with no lookup', () => {
    const values = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening'].map((text) => ({ text }));
    expect(cardAt('return clock.day|part === "night" ? 1 : 0;', { surface: STAT_CODE_SURFACE })?.allowedValues).toEqual({ values, more: 0 });
    expect(cardAt('return clock.previous.day|part === "night" ? 1 : 0;', worldBox)?.allowedValues?.values).toEqual(values);
  });
});

describe('listText', () => {
  it('cuts a comma list at the cap and names how many it left out', () => {
    const names = Array.from({ length: CARD_LIST_CAP + 2 }, (_, i) => `N${i}`);
    expect(listText(names)).toBe(`${names.slice(0, CARD_LIST_CAP).join(', ')} and 2 more`);
    expect(listText(names.slice(0, CARD_LIST_CAP))).toBe(names.slice(0, CARD_LIST_CAP).join(', '));
    expect(listText([])).toBe('None');
  });
});
