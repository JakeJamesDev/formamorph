import { describe, it, expect } from 'vitest';
import type { PersonaRef, Trait, TraitRequirement, WorldOption } from '@/types';
import { clauseText, conditionClauses, type ClauseHost, type ClauseView, type GateInput, type GateStatSet } from './traitGates';
import { scoped } from './scope';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const stat = (name: string) => ({ name, value: 5, min: 0, max: 10 });

const OPTIONS: WorldOption[] = [
  {
    id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: false,
    values: [{ id: 'easy', name: 'Easy' }, { id: 'hard', name: 'Hard' }], default: 'easy',
  },
  { id: 'perma', name: 'Permadeath', type: 'boolean', shownToPlayer: true, midGame: false, default: false },
  { id: 'party', name: 'Party Size', type: 'number', shownToPlayer: true, midGame: false, min: 1, max: 6, default: 2 },
];

// Paladin and the Combat group are global; Mira owns Knight and Arms; Albus is a world persona.
const base: Omit<GateInput, 'active' | 'persona'> = {
  global: { traits: [T('Paladin'), T('Duel', { groupId: 'combat' })], groups: [{ id: 'combat', name: 'Combat', parentId: null }] },
  owners: [{ id: 'mira', name: 'Mira', traits: [T('Knight', { groupId: 'arms' })], groups: [{ id: 'arms', name: 'Arms', parentId: null }] }],
  entities: [{ id: 'mira', name: 'Mira' }, { id: 'albus', name: 'Albus', persona: true }],
  stats: scoped<GateStatSet>({ gold: stat('Gold') }, { mira: { health: stat('Health') }, albus: { health: stat('Health') } }),
  worldItems: [{ id: 'lantern', name: 'Lantern' }],
  worldOptions: OPTIONS,
  openings: [{ label: 'World', options: [
    { id: 'h', key: { ownerId: null, openingId: 'harbor' }, label: 'Harbor' },
    { id: 'r', key: { ownerId: null, openingId: 'ruins' }, label: 'Ruins' },
  ] }],
};

const MIRA: ClauseHost = { kind: 'entity', id: 'mira', name: 'Mira' };
const ALBUS = { kind: 'entity', id: 'albus' } as const;
const YOU = { kind: 'you' } as const;

const author = (req: TraitRequirement, view: ClauseView = { host: MIRA }) => clauseText(conditionClauses(base)(req, view));
const player = (req: TraitRequirement, view: ClauseView = { host: MIRA }, persona: PersonaRef = { source: 'world', entityId: 'albus' }) =>
  clauseText(conditionClauses({ ...base, reader: 'player', persona })(req, view));
const broken = (req: TraitRequirement, view: ClauseView = { host: MIRA }) =>
  conditionClauses(base)(req, view).filter((p) => p.broken).map((p) => [p.role, p.text]);

describe('the Condition clause, author view (Q20)', () => {
  it('reads a trait Condition, and its Not', () => {
    expect(author({ kind: 'trait', id: 'Knight' })).toBe('Mira has Knight');
    expect(author({ kind: 'trait', id: 'Knight', not: true })).toBe("Mira doesn't have Knight");
    expect(author({ kind: 'trait', id: 'Knight', owner: ALBUS })).toBe('Albus has Knight');
    expect(author({ kind: 'trait', id: 'Knight', owner: YOU })).toBe('the player has Knight');
  });

  it('reads a group Condition, and its Not', () => {
    expect(author({ kind: 'group', id: 'arms' })).toBe('Mira has a trait in Arms');
    expect(author({ kind: 'group', id: 'arms', not: true })).toBe('Mira has no trait in Arms');
  });

  it('reads a Playing As Condition, and its Not (Q24)', () => {
    expect(author({ kind: 'playingAs', id: 'albus' })).toBe('the player is Albus');
    expect(author({ kind: 'playingAs', id: 'albus', not: true })).toBe('the player is not Albus');
  });

  it('reads a stat Condition in words, with Not before the comparison (Q12, Q19)', () => {
    const health = (operator: '>' | '<' | '>=' | '<=' | '=' | '≠', not?: true): TraitRequirement =>
      ({ kind: 'stat', id: 'health', operator, value: 50, unit: 'percent', ...(not ? { not } : {}) });
    expect(author(health('>='))).toBe("Mira's Health is at least 50%");
    expect(author(health('>', true))).toBe("Mira's Health is not above 50%");
    expect(['>', '<', '>=', '<=', '=', '≠'].map((op) => author(health(op as '>')).replace("Mira's Health is ", ''))).toEqual([
      'above 50%', 'below 50%', 'at least 50%', 'at most 50%', 'exactly 50%', 'different from 50%',
    ]);
    expect(author({ kind: 'stat', id: 'health', operator: '<', value: 3, unit: 'raw', owner: ALBUS })).toBe("Albus's Health is below 3");
  });

  it('reads the four item verbs, with checks only when set (Q16, Q21)', () => {
    const lantern = (status: 'owned' | 'equipped', not?: true): TraitRequirement => ({ kind: 'item', id: 'lantern', status, ...(not ? { not } : {}) });
    expect(author(lantern('owned'))).toBe('Mira owns Lantern');
    expect(author(lantern('owned', true))).toBe("Mira doesn't own Lantern");
    expect(author(lantern('equipped'))).toBe('Mira has equipped Lantern');
    expect(author(lantern('equipped', true))).toBe("Mira doesn't have equipped Lantern");
    expect(author({ kind: 'item', id: 'lantern', status: 'owned', state: ' lit ', identity: 'identified' })).toBe('Mira owns Lantern (lit, identified)');
  });

  it('reads a time Condition, and its Not, in day order from a gap', () => {
    expect(author({ kind: 'time', dayparts: ['night', 'evening'] })).toBe('it is evening or night');
    expect(author({ kind: 'time', dayparts: ['morning'], not: true })).toBe('it is not morning');
  });

  it('reads a weather Condition, and its Not', () => {
    expect(author({ kind: 'weather', kinds: ['snow', 'rain'] })).toBe('the weather is Rain or Snow');
    expect(author({ kind: 'weather', kinds: ['rain'], not: true })).toBe('the weather is not Rain');
  });

  it('reads an Opening Condition, and its Not', () => {
    const harbor = { ownerId: null, openingId: 'harbor' };
    const ruins = { ownerId: null, openingId: 'ruins' };
    expect(author({ kind: 'opening', openings: [harbor, ruins] })).toBe('the opening is Harbor or Ruins');
    expect(author({ kind: 'opening', openings: [harbor], not: true })).toBe('the opening is not Harbor');
  });

  it('reads each World Option type; on/off flips its value, a number has no Not', () => {
    expect(author({ kind: 'option', id: 'diff', valueId: 'hard' })).toBe('Difficulty is Hard');
    expect(author({ kind: 'option', id: 'diff', valueId: 'hard', not: true })).toBe('Difficulty is not Hard');
    expect(author({ kind: 'option', id: 'perma' })).toBe('Permadeath is on');
    expect(author({ kind: 'option', id: 'perma', not: true })).toBe('Permadeath is off');
    expect(author({ kind: 'option', id: 'party', operator: '>=', value: 3 })).toBe('Party Size is at least 3');
  });

  it('returns ordered parts with their roles', () => {
    expect(conditionClauses(base)({ kind: 'stat', id: 'health', operator: '>=', value: 50, unit: 'percent', owner: ALBUS }, { host: MIRA }))
      .toEqual([
        { role: 'subject', text: 'Albus' }, { role: 'word', text: "'s", attach: true }, { role: 'target', text: 'Health' },
        { role: 'verb', text: 'is' }, { role: 'comparison', text: 'at least' }, { role: 'value', text: '50%' },
      ]);
  });
});

describe('the no-owner subject (Q11, Q25)', () => {
  it("reads the host's name, else This entity", () => {
    expect(author({ kind: 'trait', id: 'Knight' }, { host: MIRA })).toBe('Mira has Knight');
    expect(author({ kind: 'trait', id: 'Knight' }, { host: { kind: 'entity' } })).toBe('this entity has Knight');
    expect(author({ kind: 'trait', id: 'Knight' })).toBe('Mira has Knight');
    expect(clauseText(conditionClauses(base)({ kind: 'trait', id: 'Knight' }))).toBe('this entity has Knight');
  });

  it('names no one for a Condition that falls to global scope', () => {
    expect(author({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'world' } })).toBe('Paladin is active');
    expect(author({ kind: 'trait', id: 'Paladin', not: true }, { host: { kind: 'world' } })).toBe('Paladin is not active');
    expect(author({ kind: 'group', id: 'combat' }, { host: { kind: 'world' } })).toBe('a trait in Combat is active');
    expect(author({ kind: 'group', id: 'combat', not: true }, { host: { kind: 'world' } })).toBe('no trait in Combat is active');
    expect(author({ kind: 'stat', id: 'gold', operator: '>=', value: 5, unit: 'raw' }, { host: { kind: 'world' } })).toBe('Gold is at least 5');
    // Mira holds no Paladin and no Gold, so her Conditions on them read global scope too.
    expect(author({ kind: 'trait', id: 'Paladin' })).toBe('Paladin is active');
    expect(author({ kind: 'stat', id: 'gold', operator: '>=', value: 5, unit: 'raw' })).toBe('Gold is at least 5');
  });

  it('keeps the subject when the host holds the target or has no id', () => {
    expect(author({ kind: 'stat', id: 'health', operator: '>=', value: 5, unit: 'raw' })).toBe("Mira's Health is at least 5");
    expect(author({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'entity', name: 'Mira' } })).toBe('Mira has Paladin');
  });

  it('reads the persona for an item on a world or persona host, and global scope with no subject for a world trait (Q25)', () => {
    expect(author({ kind: 'item', id: 'lantern', status: 'owned' }, { host: { kind: 'world' } })).toBe('the player owns Lantern');
    expect(author({ kind: 'item', id: 'lantern', status: 'owned' }, { host: { kind: 'persona' } })).toBe('the player owns Lantern');
    expect(author({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'persona' } })).toBe('Paladin is active');
    expect(player({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'persona' } })).toBe('Paladin is active');
    expect(author({ kind: 'trait', id: 'Paladin', owner: YOU }, { host: { kind: 'persona' } })).toBe('the player has Paladin');
    expect(player({ kind: 'trait', id: 'Paladin', owner: YOU }, { host: { kind: 'persona' } })).toBe('you have Paladin');
    expect(author({ kind: 'trait', id: 'Knight' }, { host: { kind: 'persona' } })).toBe('the player has Knight');
    expect(player({ kind: 'stat', id: 'health', operator: '>=', value: 5, unit: 'raw' }, { host: { kind: 'persona' } })).toBe('your Health is at least 5');
  });

  it("reads the item's owner on an item's image rule, a global target included", () => {
    expect(author({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'item' }, sentenceStart: true })).toBe("The item's owner has Paladin");
    expect(author({ kind: 'stat', id: 'gold', operator: '>=', value: 5, unit: 'raw' }, { host: { kind: 'item' } })).toBe("the item's owner's Gold is at least 5");
    expect(author({ kind: 'item', id: 'lantern', status: 'owned' }, { host: { kind: 'item' } })).toBe("the item's owner owns Lantern");
  });
});

describe('the Condition clause, player view (Q18)', () => {
  it('reads the persona as you, with second-person verbs', () => {
    expect(player({ kind: 'trait', id: 'Knight', owner: YOU })).toBe('you have Knight');
    expect(player({ kind: 'trait', id: 'Knight', owner: YOU, not: true })).toBe("you don't have Knight");
    expect(player({ kind: 'group', id: 'arms', owner: YOU })).toBe('you have a trait in Arms');
    expect(player({ kind: 'group', id: 'arms', owner: YOU, not: true })).toBe('you have no trait in Arms');
    expect(player({ kind: 'playingAs', id: 'albus' })).toBe('you are Albus');
    expect(player({ kind: 'playingAs', id: 'albus', not: true })).toBe('you are not Albus');
    expect(player({ kind: 'stat', id: 'health', operator: '>=', value: 50, unit: 'percent', owner: YOU })).toBe('your Health is at least 50%');
    expect(player({ kind: 'item', id: 'lantern', status: 'owned', owner: YOU })).toBe('you own Lantern');
    expect(player({ kind: 'item', id: 'lantern', status: 'owned', owner: YOU, not: true })).toBe("you don't own Lantern");
    expect(player({ kind: 'item', id: 'lantern', status: 'equipped', owner: YOU })).toBe('you have equipped Lantern');
    expect(player({ kind: 'item', id: 'lantern', status: 'equipped', owner: YOU, not: true })).toBe("you don't have equipped Lantern");
  });

  it('keeps other owners in the third person', () => {
    expect(player({ kind: 'trait', id: 'Knight' })).toBe('Mira has Knight');
    const mira = { kind: 'entity', id: 'mira' } as const;
    expect(player({ kind: 'stat', id: 'health', operator: '<', value: 2, unit: 'raw', owner: mira })).toBe("Mira's Health is below 2");
    expect(player({ kind: 'stat', id: 'health', operator: '<', value: 2, unit: 'raw', owner: ALBUS }, undefined, { source: 'none' })).toBe("Albus's Health is below 2");
  });

  it('reads the played entity as you, whether named by owner or by host', () => {
    expect(player({ kind: 'stat', id: 'health', operator: '<', value: 2, unit: 'raw', owner: ALBUS })).toBe('your Health is below 2');
    expect(player({ kind: 'trait', id: 'Knight', owner: ALBUS, not: true })).toBe("you don't have Knight");
    expect(player({ kind: 'stat', id: 'health', operator: '>', value: 1, unit: 'raw' }, { host: { kind: 'entity', id: 'albus', name: 'Albus' } })).toBe('your Health is above 1');
  });

  it('gives a no-owner world trait, group or stat no subject, as the editor does (Q25)', () => {
    expect(player({ kind: 'trait', id: 'Paladin' }, { host: { kind: 'world' } })).toBe('Paladin is active');
    expect(player({ kind: 'group', id: 'combat', not: true }, { host: { kind: 'world' } })).toBe('no trait in Combat is active');
    expect(player({ kind: 'stat', id: 'gold', operator: '>=', value: 5, unit: 'raw' }, { host: { kind: 'world' } })).toBe('Gold is at least 5');
    expect(player({ kind: 'item', id: 'lantern', status: 'owned' }, { host: { kind: 'world' } })).toBe('you own Lantern');
  });
});

describe('the sentence start', () => {
  it('capitalizes the first fixed word only; names keep their case', () => {
    const start = { host: { kind: 'entity' }, sentenceStart: true } as const;
    expect(author({ kind: 'trait', id: 'Knight' }, start)).toBe('This entity has Knight');
    expect(author({ kind: 'trait', id: 'Knight', owner: YOU }, start)).toBe('The player has Knight');
    expect(author({ kind: 'time', dayparts: ['night'] }, start)).toBe('It is night');
    expect(author({ kind: 'group', id: 'combat' }, { host: { kind: 'world' }, sentenceStart: true })).toBe('A trait in Combat is active');
    expect(player({ kind: 'stat', id: 'health', operator: '>', value: 1, unit: 'raw', owner: YOU }, start)).toBe('Your Health is above 1');
    const lower = { ...base, owners: [{ id: 'mira', name: 'mira', traits: [], groups: [] }], entities: [{ id: 'mira', name: 'mira' }] };
    expect(clauseText(conditionClauses(lower)({ kind: 'trait', id: 'Paladin', owner: { kind: 'entity', id: 'mira' } }, { sentenceStart: true }))).toBe('mira has Paladin');
  });
});

describe('the broken part', () => {
  it('marks a missing target, keeping its stored name', () => {
    expect(broken({ kind: 'trait', id: 'gone', name: 'Old Oath' })).toEqual([['target', 'Old Oath']]);
    expect(broken({ kind: 'group', id: 'gone' })).toEqual([['target', 'a missing group']]);
    expect(broken({ kind: 'playingAs', id: 'gone' })).toEqual([['target', 'a missing persona']]);
    expect(broken({ kind: 'stat', id: 'gone', operator: '>', value: 1, unit: 'raw' })).toEqual([['target', 'a missing stat']]);
    expect(broken({ kind: 'item', id: 'gone', status: 'owned' })).toEqual([['target', 'a missing item']]);
    expect(broken({ kind: 'option', id: 'gone', valueId: 'x' })).toEqual([['target', 'a missing World Option']]);
  });

  it('marks a missing owner, but not on a global target, whose owner is inert (Q10)', () => {
    const gone = { kind: 'entity' as const, id: 'gone', name: 'Old Albus' };
    expect(broken({ kind: 'trait', id: 'Knight', owner: gone })).toEqual([['subject', 'Old Albus']]);
    expect(broken({ kind: 'item', id: 'lantern', status: 'owned', owner: { kind: 'entity', id: 'gone' } })).toEqual([['subject', 'a missing entity']]);
    expect(broken({ kind: 'trait', id: 'Paladin', owner: gone })).toEqual([]);
  });

  it('marks an empty set with a prompt (Q26)', () => {
    expect(author({ kind: 'time', dayparts: [] })).toBe('it is pick a time');
    expect(broken({ kind: 'time', dayparts: [] })).toEqual([['set', 'pick a time']]);
    expect(broken({ kind: 'weather', kinds: [] })).toEqual([['set', 'pick the weather']]);
    expect(broken({ kind: 'opening', openings: [] })).toEqual([['set', 'pick an opening']]);
    expect(broken({ kind: 'opening', openings: [{ ownerId: null, openingId: 'cut' }] })).toEqual([['set', 'a missing Opening']]);
  });

  it('marks a missing World Option value', () => {
    expect(broken({ kind: 'option', id: 'diff', valueId: 'cut', valueName: 'Nightmare' })).toEqual([['value', 'Nightmare']]);
    expect(broken({ kind: 'option', id: 'diff' })).toEqual([['value', 'a missing value']]);
    expect(broken({ kind: 'option', id: 'party', valueId: 'x' })).toEqual([['value', '0']]);
  });

  it('marks nothing on a resolved Condition', () => {
    expect(broken({ kind: 'trait', id: 'Knight' })).toEqual([]);
    expect(broken({ kind: 'option', id: 'diff', valueId: 'hard' })).toEqual([]);
  });
});
