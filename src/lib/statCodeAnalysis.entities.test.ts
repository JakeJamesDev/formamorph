import { describe, it, expect } from 'vitest';
import { statCodeCompletions, statCodeDiagnostics } from './statCodeAnalysis';
import {
  DELTA_FIELDS, DELTA_MEMBERS, ENTITY_FIELDS, PREVIOUS_FIELDS, STAT_FIELDS, TRAIT_ENTRY_FIELDS,
} from './statCodeSurface';

/** Completions for a caret written as `|` in the doc. */
function labels(doc: string, options?: Parameters<typeof statCodeCompletions>[2]) {
  const pos = doc.indexOf('|');
  expect(pos, 'every completion case marks its caret with |').toBeGreaterThanOrEqual(0);
  return (statCodeCompletions(doc.replace('|', ''), pos, options)?.options ?? []).map((option) => option.label);
}

const messages = (code: string, options?: Parameters<typeof statCodeDiagnostics>[1]) =>
  statCodeDiagnostics(code, options).map((diagnostic) => diagnostic.message);

/** Top-level traits under these names. */
const topLevel = (...names: string[]) => names.map((name) => ({ id: name, name, path: [] }));

// Two entities share the code name Rook; the later one's set is what code reads.
const entities = [
  { id: 'mira', name: 'Mira', persona: true, traits: topLevel('Scarred', 'Night Owl') },
  { id: 'old-rook', name: 'Old Rook', persona: false, traits: topLevel('Calm') },
  { id: 'rook', name: 'Rook', persona: false, traits: topLevel('Calm') },
  { id: 'later-rook', name: 'Rook', persona: false, traits: topLevel('Angry', 'Loyal') },
];

describe('entities in stat code', () => {
  it('reads a clean switch and a guarded read as clean', () => {
    expect(messages("entities.Mira.traits['Night Owl'].enabled = self.value <= 0;", { entities })).toEqual([]);
    expect(messages("return entities['Old Rook'].traits.Calm.acquired && entities.Mira.name ? 1 : 0;", { entities })).toEqual([]);
  });

  it('completes entity names, an entity’s members, its own trait names, and a trait’s members', () => {
    expect(labels('return entities.|', { entities })).toEqual(['Mira', 'Rook']);
    expect(labels('return entities["|"];', { entities })).toEqual(['Mira', 'Old Rook', 'Rook']);
    expect(labels('return entities.Mira.|', { entities })).toEqual(ENTITY_FIELDS.map((f) => f.name));
    expect(labels('return entities.Mira.traits.|', { entities })).toEqual(['Scarred']);
    expect(labels("return entities['Old Rook'].traits[\"|\"];", { entities, traits: ['Brave'] })).toEqual(['Calm']);
    expect(labels('return entities.Rook.traits.|', { entities })).toEqual(['Angry', 'Loyal']);
    expect(labels('return entities.Mira.traits["Night Owl"].|', { entities })).toEqual(TRAIT_ENTRY_FIELDS.map((f) => f.name));
  });

  it('offers no unnamed entity, as the sandbox lists none', () => {
    const withBlank = [...entities, { id: 'blank', name: '', persona: false, traits: topLevel('Hidden') }];
    expect(labels('return entities["|"];', { entities: withBlank })).toEqual(['Mira', 'Old Rook', 'Rook']);
    expect(labels('return entities[""].traits.|', { entities: withBlank })).toEqual([]);
  });

  it('warns on a shared entity code name, naming the rule that picks one', () => {
    expect(messages('return entities.Rook.traits.Angry.enabled ? 1 : 0;', { entities }))
      .toEqual(['2 entities are named “Rook”. This reads the last one authored.']);
  });

  it('warns on an unknown entity name with a suggestion, since a library entity can have it', () => {
    const [problem] = statCodeDiagnostics('return entities.Mia.traits.Scarred.enabled ? 1 : 0;', { entities });
    expect(problem).toMatchObject({ severity: 'warning' });
    expect(problem.message).toBe('Unknown entity name “Mia”. A library entity can have it. Did you mean “Mira”?');
  });

  it('warns on a trait the entity’s set does not have, and reads the later entity’s set for a shared name', () => {
    const [problem] = statCodeDiagnostics('return entities.Mira.traits.Scared.enabled ? 1 : 0;', { entities });
    expect(problem).toMatchObject({ severity: 'warning' });
    expect(messages('return entities.Mira.traits.Scared.enabled ? 1 : 0;', { entities }))
      .toEqual(['“Mira” has no trait named “Scared”. Did you mean “Scarred”?']);
    expect(messages('return entities.Rook.traits.Calm.enabled ? 1 : 0;', { entities }))
      .toContain('“Rook” has no trait named “Calm”.');
  });

  it('flags writes to the map, an entry, an entry’s members and a trait’s read-only field', () => {
    expect(messages('entities.Mira = null;', { entities })).toEqual(['entities.Mira is read-only.']);
    expect(messages('entities.Mira.traits = {};', { entities })).toEqual(['entities.Mira.traits is read-only.']);
    expect(messages('entities.Mira.traits.Scarred.acquired = true;', { entities }))
      .toEqual(['entities.Mira.traits.Scarred.acquired can’t be written. Only entities.Mira.traits.Scarred.enabled can.']);
    expect(messages('entities.Mira.traits.Scarred = false;', { entities }))
      .toEqual(['Write to entities.Mira.traits.Scarred.enabled instead.']);
  });

  it('counts an entity switch as what the code does, so no missing-return warning fires', () => {
    expect(messages('entities.Mira.traits.Scarred.enabled = false;')).toEqual([]);
  });

  it('leaves a local named entities alone', () => {
    expect(messages('const entities = { x: {} }; entities.x.y = 1; return 1;', { entities })).toEqual([]);
  });
});

describe('entity stats in stat code', () => {
  const withStats = [
    { ...entities[0], stats: ['Trust', 'Old Grudge'] },
    { id: 'bram', name: 'Bram', persona: false, traits: [], stats: ['Stock'] },
  ];

  it('completes an entity’s own stat names, a stat’s fields, and its previous and delta', () => {
    expect(labels('return entities.Mira.stats.|', { entities: withStats })).toEqual(['Trust']);
    expect(labels('return entities.Mira.stats["|"];', { entities: withStats, statNames: ['Health'] })).toEqual(['Trust', 'Old Grudge']);
    expect(labels('return persona.stats["|"];', { entities: withStats, statNames: ['Health'] })).toEqual(['Trust', 'Old Grudge']);
    expect(labels('return entities.Bram.stats.|', { entities: withStats })).toEqual(['Stock']);
    expect(labels('return entities.Mira.stats.Trust.|', { entities: withStats })).toEqual(STAT_FIELDS.map((f) => f.name));
    expect(labels('return entities.Mira.stats["Old Grudge"].previous.|', { entities: withStats }))
      .toEqual(PREVIOUS_FIELDS.map((f) => f.name));
    expect(labels('return entities.Bram.stats.Stock.delta.|', { entities: withStats })).toEqual(DELTA_MEMBERS.map((f) => f.name));
    expect(labels('return entities.Bram.stats.Stock.delta.regen.|', { entities: withStats })).toEqual(DELTA_FIELDS.map((f) => f.name));
  });

  it('completes the persona’s stats from every persona entity', () => {
    expect(labels('return persona.stats.|', { entities: withStats })).toEqual(['Trust']);
    expect(labels('return persona.stats.Trust.|', { entities: withStats })).toEqual(STAT_FIELDS.map((f) => f.name));
  });

  it('reads an entity’s stats as clean, takes a write to a writable field, and flags a whole map or any other field', () => {
    expect(messages('return entities.Bram.stats.Stock.value + entities.Mira.stats.Trust.delta.actual.value;', { entities: withStats }))
      .toEqual([]);
    expect(messages('entities.Bram.stats.Stock.value = 3;', { entities: withStats })).toEqual([]);
    expect(messages('persona.stats.Trust.max = 3;', { entities: withStats })).toEqual([]);
    expect(messages('entities.Bram.stats.Stock.name = "x";', { entities: withStats })[0])
      .toMatch(/^entities\.Bram\.stats\.Stock\.name can’t be written/);
    expect(messages('entities.Bram.stats = {};', { entities: withStats })).toEqual(['entities.Bram.stats is read-only.']);
  });
});
