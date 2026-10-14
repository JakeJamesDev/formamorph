import { describe, expect, it } from 'vitest';
import { requirementStatSections } from './requirementStatOptions';
import { PLAYER_OWNER, type GateEntity, type GateInput, type GateStat } from './traitGates';

const S = (name: string, extra: Partial<GateStat> = {}): GateStat => ({ name, value: 10, min: 0, max: 100, ...extra });

const entities: GateEntity[] = [
  { id: 'ash', name: 'Ash' },
  { id: 'hero', name: 'Hero', persona: true },
  { id: 'cp', name: 'Custom', persona: true, customPersona: true },
  { id: 'bare', name: 'Bare' },
];
const stats: NonNullable<GateInput['stats']> = {
  [PLAYER_OWNER]: { rage: S('Rage'), gold: S('Gold', { min: 0, max: 1000 }) },
  ash: { hunger: S('Hunger') },
  hero: { grit: S('Grit') },
  cp: { luck: S('Luck') },
  bare: {},
};
const input = { owners: [], entities, stats } as Pick<GateInput, 'owners' | 'entities' | 'stats'>;

/** Each section as "heading: names", with the owner its rows add under. */
const read = (host: string, world = input) => requirementStatSections(world, host).map((s) => ({
  heading: s.heading,
  own: !!s.own,
  rows: s.options.map((o) => o.label),
  owners: [...new Set(s.options.map((o) => JSON.stringify(o.requirement.kind === 'stat' ? o.requirement.owner ?? null : null)))],
}));

describe('requirementStatSections', () => {
  it('lists, for a world trait, the player set first with no owner, then each entity that has stats', () => {
    expect(read(PLAYER_OWNER)).toEqual([
      { heading: 'Player Stats', own: true, rows: ['Rage', 'Gold', 'Luck'], owners: ['null'] },
      { heading: 'Ash Stats', own: false, rows: ['Hunger'], owners: ['{"kind":"entity","id":"ash","name":"Ash"}'] },
      { heading: 'Hero Stats', own: false, rows: ['Grit'], owners: ['{"kind":"entity","id":"hero","name":"Hero"}'] },
    ]);
  });

  it('lists, for an entity, its own stats with no owner, then You, then the others', () => {
    expect(read('ash')).toEqual([
      { heading: 'Ash Stats', own: true, rows: ['Hunger'], owners: ['null'] },
      { heading: 'Player Stats', own: false, rows: ['Rage', 'Gold', 'Luck'], owners: ['{"kind":"you"}'] },
      { heading: 'Hero Stats', own: false, rows: ['Grit'], owners: ['{"kind":"entity","id":"hero","name":"Hero"}'] },
    ]);
  });

  it('keeps a world persona’s own stats under its own owner, not under You (Q28)', () => {
    const you = read('ash').find((s) => s.heading === 'Player Stats');
    expect(you?.rows).not.toContain('Grit');
  });

  it('leaves out an inert stat and an entity with no stats', () => {
    const world = { ...input, stats: { ...stats, ash: { hunger: S('Hunger', { inert: true }), thirst: S('Thirst') } } };
    expect(read('ash', world)[0].rows).toEqual(['Thirst']);
    expect(read(PLAYER_OWNER).map((s) => s.heading)).not.toContain('Bare Stats');
  });

  it('keeps hidden stats, which an author may gate on', () => {
    const world = { ...input, stats: { ...stats, [PLAYER_OWNER]: { rage: S('Rage', { hidden: true }) } } };
    expect(read(PLAYER_OWNER, world)[0].rows).toEqual(['Rage', 'Luck']);
  });

  it('adds each stat as ">= the middle of its span, in raw units"', () => {
    const [player] = requirementStatSections(input, PLAYER_OWNER);
    expect(player.options.map((o) => o.requirement)).toEqual([
      { kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' },
      { kind: 'stat', id: 'gold', operator: '>=', value: 500, unit: 'raw' },
      { kind: 'stat', id: 'luck', operator: '>=', value: 50, unit: 'raw' },
    ]);
  });

  it('lists nothing without stats', () => {
    expect(requirementStatSections({ ...input, stats: undefined }, PLAYER_OWNER)).toEqual([]);
  });
});
