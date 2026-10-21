import { describe, expect, it } from 'vitest';
import { codeCard } from './codeCards';
import { statBoxLookup, traitBoxSelf, type CodeCardWorld } from './codeWorldLookup';
import { codeCompletions, type SurfaceAnalysisOptions } from './statCodeAnalysis';
import { ENTITY_FIELDS, MEMORY_ENTRY_FIELDS, MEMORY_MEMBERS, scriptSurface, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners } from './statCodeTargets';
import type { Entity, GameLocation } from '@/types';

/** An element of `memories` or of a `present` list reads as its entry, with each field's card (Q13, Q42). */

const inn: GameLocation = { id: 'inn', name: 'Inn', isStarting: true };
const tor: Entity = { id: 'tor', name: 'Tor', locations: ['inn'], aliases: ['the smith'] };
const world: CodeCardWorld = {
  traits: [], traitGroups: [], entities: [tor], stats: [], statGroups: [], placeholders: [], locations: [inn], worldScripts: [], worldTools: [],
};
const lookup = statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: traitBoxSelf('', '') }, world);
const options: SurfaceAnalysisOptions = { surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'after'), lookup, locations: ['Inn'] };
const output: SurfaceAnalysisOptions = { ...options, surface: scriptSurface(WORLD_SCRIPT_SURFACE, 'output') };

const cardAt = (doc: string, at = options) => codeCard(doc.replace('|', ''), doc.indexOf('|'), at);
const completionsAt = (doc: string, at = options) =>
  (codeCompletions(doc.replace('|', ''), doc.indexOf('|'), at)?.options ?? []).map((option) => option.label);

const infoOf = (fields: typeof MEMORY_ENTRY_FIELDS, name: string) => fields.find((field) => field.name === name)?.info;

describe('an array element’s card', () => {
  it.each([
    ['an index', 'memories[0].te|xt;', 'text'],
    ['a variable index', 'memories[i].te|xt;', 'text'],
    ['at', 'memories.at(-1).times|tamp;', 'timestamp'],
    ['find', 'memories.find((m) => m.custom).dayp|art;', 'daypart'],
    ['findLast', 'memories.findLast((m) => m.custom).dayp|art;', 'daypart'],
    ['a chained pick', 'memories.filter((m) => m.custom)[0].te|xt;', 'text'],
    ['a callback parameter', 'memories.filter((m) => m.cus|tom);', 'custom'],
    ['a for-of binding', 'for (const m of memories) console.log(m.tu|rn);', 'turn'],
  ])('reads a memory field through %s', (_form, doc, field) => {
    const card = cardAt(doc);
    expect(card?.signature).toEqual({ kind: 'property', path: `Memory.${field}`, type: MEMORY_ENTRY_FIELDS.find((each) => each.name === field)?.detail });
    expect(card?.description).toBe(infoOf(MEMORY_ENTRY_FIELDS, field));
    expect(card?.access).toBe('readOnly');
  });

  it.each([
    ['the current location', 'location.present[0].follo|wing;', 'following'],
    ['a locations entry', 'locations.Inn.present.find((e) => e.inScene).loca|tion;', 'location'],
    ['a callback over present', 'location.present.some((e) => e.na|me === "Tor");', 'name'],
  ])('reads an entity field through %s', (_form, doc, field) => {
    const card = cardAt(doc);
    expect(card?.signature).toMatchObject({ kind: 'property', path: `Entity.${field}` });
    expect(card?.description).toBe(infoOf(ENTITY_FIELDS, field));
    expect(card?.access).toBe('readOnly');
  });

  it.each(['pin', 'forget', 'remove'])('shows the %s verb on an element', (verb) => {
    const entry = MEMORY_ENTRY_FIELDS.find((each) => each.name === verb);
    const card = cardAt(`memories[0].${verb.slice(0, 2)}|${verb.slice(2)}();`);
    expect(card?.signature).toEqual({ kind: 'method', path: `Memory.${verb}`, type: '() => void' });
    expect(card?.description).toBe(entry?.info);
    expect(card?.access).toBeUndefined();
  });

  it('shows the edit verb on a picked element', () => {
    expect(cardAt('memories.find((m) => !m.custom)?.ed|it("The bridge held.");')?.signature)
      .toEqual({ kind: 'method', path: 'Memory.edit', type: '(text) => void' });
  });

  it('reads findLast over the stats as one stat', () => {
    expect(cardAt('Object.values(stats).findLast((s) => s.value > 0).m|ax;')?.signature).toMatchObject({ path: 'Stat.max' });
  });

  it('keeps the list’s own verbs on the list', () => {
    expect(cardAt('memories.ad|d("Tor lied.");')?.signature).toMatchObject({ kind: 'method', path: 'memories.add' });
  });

  it.each([
    ['a string list’s element', 'return narration.sent[0].len|gth;', output],
    ['an array of no known shape', 'entities.Tor.aliases[0].len|gth;', options],
    ['the author’s own array', 'const memories = []; memories[0].te|xt;', options],
    ['a name bound to two element shapes', 'memories.map((x) => x.text); location.present.map((x) => x.na|me);', options],
    ['a member the element lacks', 'memories[0].na|me;', options],
    ['a name the code also declares', 'memories.forEach((x) => x.text); const x = {}; x.te|xt;', options],
    ['a joined array', 'memories.concat(location.present)[0].te|xt;', options],
  ])('gives %s no card', (_case, doc, at) => {
    expect(cardAt(doc, at)).toBeNull();
  });
});

describe('completion after an element', () => {
  it('offers a memory entry’s fields', () => {
    expect(completionsAt('memories[0].|')).toEqual(MEMORY_ENTRY_FIELDS.map((field) => field.name));
  });

  it('offers an entity entry’s fields after a present pick', () => {
    expect(completionsAt('location.present.at(0).|')).toEqual(ENTITY_FIELDS.map((field) => field.name));
  });

  it('still offers the list’s verbs after memories', () => {
    expect(completionsAt('memories.|')).toEqual(MEMORY_MEMBERS.map((member) => member.name));
  });

  it('offers nothing after a string list’s element', () => {
    expect(completionsAt('narration.sent[0].|', output)).toEqual([]);
  });
});
