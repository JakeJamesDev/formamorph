import { describe, expect, it } from 'vitest';
import type { Entity, RequirementOwner, Trait, TraitGroup } from '@/types';
import { editorGateInput } from './owners';
import { requirementTargets, targetKey } from './requirementTargets';
import { scoped } from './scope';
import type { ClauseHost, GateEntity, GateInput, GateStat, GateStatSet } from './traitGates';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });

describe('requirementTargets: stats', () => {
  const entities: GateEntity[] = [
    { id: 'ash', name: 'Ash' },
    { id: 'hero', name: 'Hero', persona: true },
    { id: 'cp', name: 'Custom', persona: true, customPersona: true },
    { id: 'bare', name: 'Bare' },
  ];
  const stats: NonNullable<GateInput['stats']> = scoped<GateStatSet>({ rage: S('Rage'), gold: S('Gold', { min: 0, max: 1000 }) }, {
    ash: { hunger: S('Hunger') },
    hero: { grit: S('Grit') },
    cp: { luck: S('Luck') },
    bare: {},
  });
  const input: Omit<GateInput, 'active' | 'persona'> = { global: { traits: [], groups: [] }, owners: [], entities, stats };
  const world: ClauseHost = { kind: 'world' };
  const ash: ClauseHost = { kind: 'entity', id: 'ash', name: 'Ash' };

  /** Each page as its heading, whether it is the host's own, its stats, and the owner a pick stores. */
  const read = (host: ClauseHost, gate = input) => requirementTargets(gate, host).pages.map((p) => ({
    heading: p.heading, own: !!p.own, rows: p.options.map((o) => o.label), owner: p.owner ?? null,
  }));
  const persona = { heading: 'Persona', own: false, rows: ['Grit', 'Luck'], owner: { kind: 'you' } };
  const hero = { heading: 'Hero', own: false, rows: ['Grit'], owner: { kind: 'entity', id: 'hero', name: 'Hero' } };
  const custom = { heading: 'Custom', own: false, rows: ['Luck'], owner: { kind: 'entity', id: 'cp', name: 'Custom' } };

  it('lists, for a world trait, the global stats first with no owner, then Persona, then each entity that has stats', () => {
    expect(read(world)).toEqual([
      { heading: 'Global', own: true, rows: ['Rage', 'Gold'], owner: null },
      persona,
      { heading: 'Ash', own: false, rows: ['Hunger'], owner: { kind: 'entity', id: 'ash', name: 'Ash' } },
      hero,
      custom,
    ]);
  });

  it('lists, for an entity, its own stats, then the global stats, both with no owner, then Persona, then the others', () => {
    expect(read(ash)).toEqual([
      { heading: 'Ash', own: true, rows: ['Hunger'], owner: null },
      { heading: 'Global', own: false, rows: ['Rage', 'Gold'], owner: null },
      persona,
      hero,
      custom,
    ]);
  });

  it('lists every entity that can be played under Persona, and never one that can’t', () => {
    expect(read(ash).find((p) => p.heading === 'Persona')?.rows).not.toContain('Hunger');
    expect(read({ kind: 'entity', id: 'hero', name: 'Hero' })[0]).toEqual({ heading: 'Hero', own: true, rows: ['Grit'], owner: null });
  });

  it('leaves out an inert stat and an entity with no stats', () => {
    const inert = { ...input, stats: { ...stats, owners: { ...stats.owners, ash: { hunger: S('Hunger', { inert: true }), thirst: S('Thirst') } } } };
    expect(read(ash, inert)[0].rows).toEqual(['Thirst']);
    expect(read(world).map((p) => p.heading)).not.toContain('Bare');
  });

  it('keeps hidden stats, which an author may gate on', () => {
    const hidden = { ...input, stats: { ...stats, global: { rage: S('Rage', { hidden: true }) } } };
    expect(read(world, hidden)[0].rows).toEqual(['Rage']);
  });

  it('adds each stat as ">= the middle of its span, in raw units"', () => {
    const [global] = requirementTargets(input, world).pages;
    expect(global.options.map((o) => o.requirement)).toEqual([
      { kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' },
      { kind: 'stat', id: 'gold', operator: '>=', value: 500, unit: 'raw' },
    ]);
  });

  it('lists nothing without stats', () => {
    expect(requirementTargets({ ...input, stats: undefined }, world).pages).toEqual([]);
  });
});

// Blueprints holds the trait Bold, the group Virtues and the stat Courage; Mira and Wren link Bold and hold
// Courage. Brave, Combat and Gold are global. Mira, who can be played, owns Grace in Manner and the stat Poise;
// Wren owns Hush in Quiet and the stat Calm. A trait and a stat with the same holders pair up: Bold and
// Courage, Grace and Poise, Hush and Calm, Brave and Gold.
const T = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });
const groups: TraitGroup[] = [
  { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' },
  { id: 'virtues', name: 'Virtues', parentId: 'bp' },
  { id: 'combat', name: 'Combat', parentId: null },
];
const traits = [T('brave', 'Brave', { groupId: 'combat' }), T('bold', 'Bold', { groupId: 'virtues' })];
const link = (id: string, originalId: string) => ({ id, originalId, kind: 'trait' as const, originalName: originalId, groupId: null, order: 9 });
const entities = [
  {
    id: 'mira', name: 'Mira', persona: true, traitLinks: [link('l1', 'bold')],
    traits: [T('grace', 'Grace', { groupId: 'manner' })], traitGroups: [{ id: 'manner', name: 'Manner', parentId: null }],
  },
  {
    id: 'wren', name: 'Wren', traitLinks: [link('l2', 'bold')],
    traits: [T('hush', 'Hush', { groupId: 'quiet' })], traitGroups: [{ id: 'quiet', name: 'Quiet', parentId: null }],
  },
] as unknown as Entity[];
const stats = scoped<GateStatSet>({ gold: S('Gold') }, { mira: { courage: S('Courage'), poise: S('Poise') }, wren: { courage: S('Courage'), calm: S('Calm') } });
const editor = editorGateInput({ traits, traitGroups: groups, entities }, stats, { courage: S('Courage') });

const MIRA = { kind: 'entity', id: 'mira', name: 'Mira' } as const;
const WREN = { kind: 'entity', id: 'wren', name: 'Wren' } as const;
const hosts: Record<string, ClauseHost> = { mira: MIRA, wren: WREN, world: { kind: 'world' }, blueprint: { kind: 'blueprint' } };

/** The page headings that list `kind`, in order. */
const headings = (host: ClauseHost, kind: string) =>
  requirementTargets(editor, host).pages.filter((p) => p.options.some((o) => o.requirement.kind === kind)).map((p) => p.heading);
/** What a pick of `label` from page `heading` stores as its owner. */
const pickOwner = (host: ClauseHost, heading: string, label: string) => {
  const option = requirementTargets(editor, host).pages.find((p) => p.heading === heading)?.options.find((o) => o.label === label);
  if (!option) return 'missing';
  return 'owner' in option.requirement ? option.requirement.owner ?? null : null;
};
/** The owner choices of a target, as the owner list names them: `none` is the no-owner choice. */
const choices = (host: ClauseHost, kind: string, id: string) =>
  (requirementTargets(editor, host).owners.get(`${kind}:${id}`) ?? []).map((o?: RequirementOwner) => (!o ? 'none' : o.kind === 'you' ? 'you' : o.id));

describe('requirementTargets: one page list for traits, groups and stats', () => {
  it('gives the three kinds the same pages in the same order on an entity, a Global Trait and a Blueprint', () => {
    expect(headings(WREN, 'trait')).toEqual(['Wren', 'Global', 'Blueprints', 'Persona', 'Mira']);
    expect(headings(hosts.world, 'trait')).toEqual(['Global', 'Blueprints', 'Persona', 'Mira', 'Wren']);
    expect(headings(hosts.blueprint, 'trait')).toEqual(['Blueprints', 'Global', 'Persona', 'Mira', 'Wren']);
    for (const host of [WREN, hosts.world, hosts.blueprint]) {
      expect(headings(host, 'group')).toEqual(headings(host, 'trait'));
      expect(headings(host, 'stat')).toEqual(headings(host, 'trait'));
    }
  });

  it('names no menu page World', () => {
    for (const host of Object.values(hosts)) expect(headings(host, 'trait')).not.toContain('World');
    expect(requirementTargets(editor, hosts.world).swapList.find((o) => o.label === 'Combat')?.breadcrumb).toEqual(['Global']);
  });

  it('marks only the host’s own page as its own', () => {
    const own = (host: ClauseHost) => requirementTargets(editor, host).pages.filter((p) => p.own).map((p) => p.heading);
    expect([own(MIRA), own(hosts.world), own(hosts.blueprint)]).toEqual([['Mira'], ['Global'], ['Blueprints']]);
  });
});

describe('requirementTargets: the owner a pick stores', () => {
  it('stores no owner from the host’s own page', () => {
    expect([pickOwner(MIRA, 'Mira', 'Grace'), pickOwner(MIRA, 'Mira', 'Poise')]).toEqual([null, null]);
  });

  it('stores no owner from Global', () => {
    expect([pickOwner(MIRA, 'Global', 'Brave'), pickOwner(MIRA, 'Global', 'Gold')]).toEqual([null, null]);
  });

  it('stores no owner from Blueprints', () => {
    expect([pickOwner(MIRA, 'Blueprints', 'Bold'), pickOwner(MIRA, 'Blueprints', 'Courage')]).toEqual([null, null]);
  });

  it('stores the player from Persona', () => {
    expect([pickOwner(WREN, 'Persona', 'Grace'), pickOwner(WREN, 'Persona', 'Poise')]).toEqual([{ kind: 'you' }, { kind: 'you' }]);
  });

  it('names the entity from its page, linked targets included', () => {
    expect([pickOwner(MIRA, 'Wren', 'Hush'), pickOwner(MIRA, 'Wren', 'Bold'), pickOwner(MIRA, 'Wren', 'Calm')]).toEqual([WREN, WREN, WREN]);
  });
});

describe('requirementTargets: the owner list (Q43)', () => {
  it('holds the same owners for a trait and a stat with the same holders', () => {
    for (const host of Object.values(hosts)) {
      expect(choices(host, 'trait', 'bold')).toEqual(choices(host, 'stat', 'courage'));
      expect(choices(host, 'trait', 'grace')).toEqual(choices(host, 'stat', 'poise'));
      expect(choices(host, 'trait', 'hush')).toEqual(choices(host, 'stat', 'calm'));
      expect(choices(host, 'trait', 'brave')).toEqual(choices(host, 'stat', 'gold'));
    }
  });

  it('offers no owner on the host that holds the target, and shows the host once', () => {
    expect(choices(MIRA, 'trait', 'grace')).toEqual(['none', 'you']);
    expect(choices(MIRA, 'trait', 'bold')).toEqual(['none', 'you', 'wren']);
  });

  it('leaves out no owner on a host that does not hold the target', () => {
    expect(choices(WREN, 'trait', 'grace')).toEqual(['you', 'mira']);
    expect(choices(hosts.world, 'trait', 'bold')).toEqual(['you', 'mira', 'wren']);
  });

  it('offers no owner alone for a global target', () => {
    expect(choices(WREN, 'trait', 'brave')).toEqual(['none']);
  });

  it('offers no owner for a Blueprint target on a Blueprint’s field', () => {
    expect(choices(hosts.blueprint, 'trait', 'bold')).toEqual(['none', 'you', 'mira', 'wren']);
    expect(choices(hosts.blueprint, 'trait', 'grace')).toEqual(['you', 'mira']);
  });

  it('keys each target by its kind and id', () => {
    expect(targetKey({ kind: 'trait', id: 'bold', owner: MIRA })).toBe('trait:bold');
  });
});

describe('requirementTargets: a location’s and an item’s rule (Q44)', () => {
  const location: ClauseHost = { kind: 'persona' };
  const item: ClauseHost = { kind: 'item' };

  it('opens a location’s rule on Persona with no owner, then Global, Blueprints and each entity by name', () => {
    expect(headings(location, 'trait')).toEqual(['Persona', 'Global', 'Blueprints', 'Mira', 'Wren']);
    expect(headings(location, 'stat')).toEqual(headings(location, 'trait'));
    expect([pickOwner(location, 'Persona', 'Grace'), pickOwner(location, 'Wren', 'Hush'), pickOwner(location, 'Wren', 'Calm')]).toEqual([null, WREN, WREN]);
  });

  it('offers no owner on a location’s rule for what the player can hold, and never the player again', () => {
    expect(choices(location, 'trait', 'grace')).toEqual(['none', 'mira']);
    expect(choices(location, 'trait', 'hush')).toEqual(['wren']);
    expect(choices(location, 'stat', 'courage')).toEqual(['none', 'mira', 'wren']);
  });

  it('opens an item’s rule on Item Owner with no owner, then Persona and each entity by name', () => {
    expect(headings(item, 'trait')).toEqual(['Item Owner', 'Persona', 'Mira', 'Wren']);
    expect(headings(item, 'stat')).toEqual(headings(item, 'trait'));
    expect([pickOwner(item, 'Item Owner', 'Hush'), pickOwner(item, 'Persona', 'Grace'), pickOwner(item, 'Mira', 'Poise')]).toEqual([null, { kind: 'you' }, MIRA]);
  });

  it('always offers no owner on an item’s rule', () => {
    expect(choices(item, 'trait', 'hush')).toEqual(['none', 'wren']);
    expect(choices(item, 'stat', 'calm')).toEqual(['none', 'wren']);
  });
});
