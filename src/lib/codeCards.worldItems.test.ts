import { describe, it, expect } from 'vitest';
import { codeCard, CARD_LIST_CAP, listText, placeholderValues, scopedKind, type CodeCard } from './codeCards';
import { statBoxLookup, type CodeBoxOwner, type CodeCardWorld } from './codeWorldLookup';
import { statCodeCompletions, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { codeDictionaries } from './statCodePlaceholders';
import { statCodeOwners } from './statCodeTargets';
import { entityTraitNames, worldTraitPlaces } from './statCodeTraits';
import type { PlaceholderOwners } from './placeholderHomes';
import { encodePlaceholderToken } from './placeholders';
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
  entries: [
    { id: 'e1', name: 'Heron', key: ['heron'], value: 'A grey bird.' }, { id: 'e2', name: 'Eel', key: ['eel'], value: 'A slick fish.' },
    { id: 'e3', name: 'Marsh Hen', key: ['hen', 'rail'], value: 'A shy bird.' },
    { id: 'e4', name: 'Bittern', key: ['bittern'], value: 'Off.', enabled: false },
  ],
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
    placeholders: { list: placeholders, owners: placeholderOwners, dictionaries: codeDictionaries(from.dictionaries, placeholders) },
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
  it('shows Mode, Requires and Changes and no Owners row on a global trait, with the description and the item', () => {
    const card = cardAt('return traits.Br|ave.enabled;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Mode', value: 'Optional' },
      { label: 'Requires', value: 'Courage >= 50 and not Shy\nor playing as Tom' },
      { label: 'Changes', value: 'Stamina max +10, Fatigue regen −1%, Fatigue off' },
    ]);
    expect(card?.signature.scope).toBe('global');
    expect(card?.description).toBe('Faces danger without flinching.');
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('names Automatic by its player-facing name and drops empty Requires and Changes', () => {
    const card = cardAt('return traits.Sh|y.enabled;', worldBox);
    expect(rowsOf(card)).toEqual({ Mode: 'Automatic' });
    expect(card?.signature).toEqual({ kind: 'trait', path: 'traits.Shy', type: 'Trait', scope: 'global' });
    expect(scopedKind(card!.signature)).toBe('global trait');
  });

  it('reaches an entity’s own trait by its route, with the entity on the item', () => {
    const card = cardAt('return entities.Mara.traits.Ca|lm.enabled;', worldBox);
    expect(rowsOf(card)).toEqual({ Mode: 'Hidden', Owners: 'Mara' });
    expect(card?.item).toEqual({ kind: 'trait', traitId: 'calm', entityId: 'mara' });
  });

  it('reaches a linked trait through `persona` as the original', () => {
    expect(cardAt('return persona.traits.Br|ave.enabled;', worldBox)?.item).toEqual({ kind: 'trait', traitId: 'brave' });
  });

  it('reaches the box owner’s trait through `owner.traits`, and shows its card', () => {
    expect(rowsOf(cardAt('return owner.traits.Ca|lm.enabled;', maraBox))).toEqual({ Mode: 'Hidden', Owners: 'Mara' });
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
  it('shows Kind and Pinned By in Pin precedence, and every value with its weight, and says world placeholder', () => {
    const card = cardAt('return placeholders.Mo|od.value;', worldBox);
    expect(card?.signature).toEqual({ kind: 'placeholder', path: 'placeholders.Mood', type: 'Placeholder', scope: 'world' });
    expect(card?.rows).toEqual([
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
    expect(rowsOf(card)).toEqual({ Owners: 'Mara', Kind: 'Wildcard' });
    expect(card?.signature.scope).toBeUndefined();
    expect(card?.allowedValues?.values).toEqual([{ text: 'grim', weight: 0 }, { text: 'sly', weight: 3 }]);
  });

  it('names a dictionary as the owner of its placeholders', () => {
    expect(rowsOf(cardAt('return dictionaries.Fauna.placeholders.Be|ast.value;', worldBox))).toEqual({ Owners: 'Fauna', Kind: 'Variable' });
  });

  it('shows a world nested placeholder’s Parent Placeholder, no Owners row, and says world placeholder (Q7)', () => {
    // Mood holds Tone through a chip in one of its values.
    const tone: Placeholder = { id: 'tone', name: 'Tone', ownerId: 'mood', values: [{ id: 'low', text: 'low' }] };
    const holding: Placeholder = { ...mood, values: [...mood.values, { id: 'toned', text: encodePlaceholderToken({ id: 'tone', mode: 'world', placementId: 'p1' }) }] };
    const nested = [holding, look, maraLook, beast, tone];
    const options = box(null, courage);
    const lookup = statBoxLookup(statCodeOwners({ stats: [courage], placeholders: [] }), { owner: null, timing: 'after', self: courage },
      { ...cardWorld, placeholders: nested });
    const card = cardAt('return placeholders.Mood.To|ne.value;', { ...options, placeholders: { ...options.placeholders!, list: nested }, lookup });
    expect(rowsOf(card)).toEqual({ 'Parent Placeholder': 'Mood', Kind: 'Variable' });
    expect(card?.signature.scope).toBe('world');
  });

  it('shows the owner and the Parent Placeholder for a placeholder nested in a dictionary’s own (Q12)', () => {
    // Beast holds Pelt, and the book's tree holds both.
    const pelt: Placeholder = { id: 'pelt', name: 'Pelt', ownerId: 'beast', values: [{ id: 'grey', text: 'grey' }] };
    const holding: Placeholder = { ...beast, values: [...beast.values, { id: 'pelted', text: encodePlaceholderToken({ id: 'pelt', mode: 'world', placementId: 'p2' }) }] };
    const nested = [mood, look, maraLook, holding, pelt];
    const owners: PlaceholderOwners = new Map([...placeholderOwners, ['pelt', { kind: 'dictionary', id: 'fauna', name: 'Fauna' }]]);
    const options = box(null, courage);
    const lookup = statBoxLookup(statCodeOwners({ stats: [courage], placeholders: [] }), { owner: null, timing: 'after', self: courage },
      { ...cardWorld, placeholders: nested, placeholderOwners: owners });
    const card = cardAt('return dictionaries.Fauna.placeholders.Beast.Pe|lt.value;', {
      ...options, placeholders: { ...options.placeholders!, list: nested, owners }, lookup,
    });
    expect(card?.rows).toEqual([
      { label: 'Owners', value: 'Fauna' }, { label: 'Parent Placeholder', value: 'Beast' }, { label: 'Kind', value: 'Variable' },
    ]);
    expect(card?.signature.scope).toBeUndefined();
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
    expect(rowsOf(cardAt('return entities.T|om.name;', worldBox))).toEqual({ Persona: 'Playable', Stats: 'None', Traits: 'Brave', Placeholders: 'None' });
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
    expect(rowsOf(card)).toEqual({ Placeholders: 'Beast', Entries: '4' });
    expect(card?.item).toEqual({ kind: 'dictionary', dictionaryId: 'fauna' });
  });

  it('describes a dictionary’s entries map and an entry’s four fields', () => {
    expect(cardAt('return dictionaries.Fauna.ent|ries;', worldBox)?.signature).toEqual({ kind: 'property', path: 'Dictionary.entries', type: 'object' });
    for (const [field, type] of [['id', 'string'], ['name', 'string'], ['keys', 'string[]'], ['value', 'string']]) {
      const card = cardAt(`return dictionaries.Fauna.entries["Marsh Hen"].${field}|;`, worldBox);
      expect(card?.signature).toEqual({ kind: 'property', path: `DictionaryEntry.${field}`, type });
      expect(card?.access).toBe('readOnly');
    }
  });

  it('shows an entry’s keywords through brackets, and gives an unknown or switched-off entry no card', () => {
    const card = cardAt('return dictionaries.Fauna.entries["Marsh| Hen"].value;', worldBox);
    expect(card?.signature).toEqual({ kind: 'entry', path: 'dictionaries.Fauna.entries["Marsh Hen"]', type: 'DictionaryEntry' });
    expect(rowsOf(card)).toEqual({ 'Trigger Keywords': 'hen, rail' });
    expect(card?.item).toEqual({ kind: 'dictionary', dictionaryId: 'fauna' });
    expect(cardAt('return dictionaries.Fauna.entries.Bit|tern.value;', worldBox)).toBeNull();
    expect(cardAt('return dictionaries.Fauna.entries.No|pe.value;', worldBox)).toBeNull();
  });

  it('completes a dictionary’s entry names and an entry’s fields', () => {
    expect(labels('return dictionaries.Fauna.entries.|', worldBox)).toEqual(['Heron', 'Eel']);
    expect(labels('return dictionaries.Fauna.entries["|', worldBox)).toEqual(expect.arrayContaining(['Heron', 'Eel', 'Marsh Hen']));
    expect(labels('return dictionaries.Fauna.entries.Heron.|', worldBox)).toEqual(['id', 'name', 'keys', 'value']);
    expect(labels('return dictionaries.Fauna.|', worldBox)).toEqual(['id', 'name', 'entries', 'placeholders']);
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
