import { describe, expect, it } from 'vitest';
import { requirementStatSections } from './requirementStatOptions';
import type { GateEntity, GateInput, GateStat, GateStatSet } from './traitGates';
import { scoped, type OwnerId } from './scope';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });

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
const input = { owners: [], entities, stats } as Pick<GateInput, 'owners' | 'entities' | 'stats'>;

/** Each section as "heading: names", with the owner its rows add under. */
const read = (host: OwnerId, world = input) => requirementStatSections(world, host).map((s) => ({
  heading: s.heading,
  own: !!s.own,
  rows: s.options.map((o) => o.label),
  owners: [...new Set(s.options.map((o) => JSON.stringify(o.requirement.kind === 'stat' ? o.requirement.owner ?? null : null)))],
}));

describe('requirementStatSections', () => {
  const persona = { heading: 'Persona Stats', own: false, rows: ['Grit', 'Luck'], owners: ['{"kind":"you"}'] };
  const hero = { heading: 'Hero Stats', own: false, rows: ['Grit'], owners: ['{"kind":"entity","id":"hero","name":"Hero"}'] };
  const custom = { heading: 'Custom Stats', own: false, rows: ['Luck'], owners: ['{"kind":"entity","id":"cp","name":"Custom"}'] };

  // Q29: the global stats alone, then Persona Stats under You, then every other entity by name.
  it('lists, for a world trait, the global stats first with no owner, then Persona Stats, then each entity that has stats', () => {
    expect(read(null)).toEqual([
      { heading: 'Global Stats', own: true, rows: ['Rage', 'Gold'], owners: ['null'] },
      persona,
      { heading: 'Ash Stats', own: false, rows: ['Hunger'], owners: ['{"kind":"entity","id":"ash","name":"Ash"}'] },
      hero,
      custom,
    ]);
  });

  // Q10: a global stat takes no owner from any host.
  it('lists, for an entity, its own stats, then the global stats, both with no owner, then You, then the others', () => {
    expect(read('ash')).toEqual([
      { heading: 'Ash Stats', own: true, rows: ['Hunger'], owners: ['null'] },
      { heading: 'Global Stats', own: false, rows: ['Rage', 'Gold'], owners: ['null'] },
      persona,
      hero,
      custom,
    ]);
  });

  // Q29 replaces Q28: a world persona's stats show under Persona Stats as well as its own name.
  it('lists every entity that can be played under Persona Stats, and never one that can’t', () => {
    expect(read('ash').find((s) => s.heading === 'Persona Stats')?.rows).not.toContain('Hunger');
    expect(read('hero')[0]).toEqual({ heading: 'Hero Stats', own: true, rows: ['Grit'], owners: ['null'] });
  });

  it('leaves out an inert stat and an entity with no stats', () => {
    const world = { ...input, stats: { ...stats, owners: { ...stats.owners, ash: { hunger: S('Hunger', { inert: true }), thirst: S('Thirst') } } } };
    expect(read('ash', world)[0].rows).toEqual(['Thirst']);
    expect(read(null).map((s) => s.heading)).not.toContain('Bare Stats');
  });

  // Q29: the global section holds the global stats alone, so Luck sits under Persona Stats.
  it('keeps hidden stats, which an author may gate on', () => {
    const world = { ...input, stats: { ...stats, global: { rage: S('Rage', { hidden: true }) } } };
    expect(read(null, world)[0].rows).toEqual(['Rage']);
  });

  it('adds each stat as ">= the middle of its span, in raw units"', () => {
    const [global] = requirementStatSections(input, null);
    expect(global.options.map((o) => o.requirement)).toEqual([
      { kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' },
      { kind: 'stat', id: 'gold', operator: '>=', value: 500, unit: 'raw' },
    ]);
  });

  it('lists nothing without stats', () => {
    expect(requirementStatSections({ ...input, stats: undefined }, null)).toEqual([]);
  });
});
