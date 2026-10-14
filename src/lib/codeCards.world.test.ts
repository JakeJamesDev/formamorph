import { describe, it, expect, vi } from 'vitest';
import { codeCard, statRows, type CodeCard } from './codeCards';
import { lazyLookup, statBoxLookup, type CodeBox, type CodeBoxOwner } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE } from './statCodeSurface';
import { statCodeOwners, type StatRouteWorld } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';
import type { Entity, Stat, StatGroup, StatLink } from '@/types';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });

const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
// A Blueprint group, so `owner.stats` in Rage's box holds Calm too.
const beast: StatGroup = { id: 'beast', name: 'Beast', parentId: 'bp' };
const rage = stat('rage', 'Rage', { groupId: 'beast', description: 'How angry the bearer is.' });
const calm = stat('calm', 'Calm', { groupId: 'beast' });
const health = stat('health', 'Health');
const fatigue = stat('fatigue', 'Fatigue', {
  description: 'How worn out the player is.', starting: 20, regen: -2 / 24, regenUnit: 'days', hidden: true, enabled: false,
});

const link = (id: string, overrides?: StatLink['overrides']): StatLink =>
  ({ id, originalId: 'rage', kind: 'stat', originalName: 'Rage', groupId: null, ...(overrides ? { overrides } : {}) });

const mara: Entity = {
  id: 'mara', name: 'Mara',
  stats: [stat('mara-health', 'Health', { max: 10, starting: 5 })],
  statLinks: [link('mara-rage', { rage: { max: { value: 50, blueprint: 100 } } })],
};
const tom: Entity = { id: 'tom', name: 'Tom', persona: true, statLinks: [link('tom-rage', { rage: { max: { value: 60, blueprint: 100 } } })] };
// Kai's Link runs its own After code, so the Blueprint's After box doesn't run for Kai.
const kai: Entity = { id: 'kai', name: 'Kai', statLinks: [link('kai-rage', { rage: { code: { value: 'return 1;', blueprint: '' } } })] };

const world: StatRouteWorld = {
  stats: [health, fatigue, rage, calm], statGroups: [blueprints, beast], entities: [mara, tom, kai], placeholders: [],
};

/** A box's analysis options, its lookup bound the way the stat editor binds it. */
function box(owner: CodeBoxOwner | null, self: Stat, timing: StatCodeTiming = 'after', from: StatRouteWorld = world): SurfaceAnalysisOptions {
  const bound: CodeBox = { owner, timing, self };
  return {
    surface: STAT_CODE_SURFACE,
    selfName: self.name,
    ...(owner ? { owner: owner.kind } : {}),
    lookup: statBoxLookup(statCodeOwners(from), bound),
  };
}

const worldBox = box(null, health);
const maraBox = box({ kind: 'entity', entityId: 'mara' }, mara.stats![0]);
const rageBox = (timing: StatCodeTiming = 'after') => box({ kind: 'blueprint' }, rage, timing);

/** The card under a caret written as `|`. */
function cardAt(doc: string, options: SurfaceAnalysisOptions): CodeCard | null {
  const pos = doc.indexOf('|');
  return codeCard(doc.replace('|', ''), pos, options);
}

const rowsOf = (card: CodeCard | null) => Object.fromEntries((card?.rows ?? []).map((row) => [row.label, row.value]));

describe('stat cards: World Details', () => {
  it('shows Type, Range and Owner, and drops every row at its default', () => {
    expect(cardAt('return stats.Hea|lth.value;', worldBox)?.rows).toEqual([
      { label: 'Type', value: 'Number' },
      { label: 'Range', value: '0 – 100' },
      { label: 'Owner', value: 'World' },
    ]);
  });

  it('shows each row off its default, in order, and the authored description', () => {
    const card = cardAt('return stats.Fat|igue.value;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Type', value: 'Number' },
      { label: 'Range', value: '0 – 100' },
      { label: 'Starts At', value: '20' },
      { label: 'Regen', value: '−2 per story day' },
      { label: 'Owner', value: 'World' },
      { label: 'Shown To', value: 'AI only' },
      { label: 'Off', value: 'Until a trait turns it on' },
    ]);
    expect(card?.description).toBe('How worn out the player is.');
    expect(card?.item).toEqual({ kind: 'stat', statId: 'fatigue' });
  });

  it('reads a percentage stat’s amounts with a percent sign', () => {
    const rows = statRows({ stat: stat('p', 'P', { type: 'percentage', starting: 40, regen: 1 }), owner: 'World' });
    expect(rows.map((row) => row.value)).toEqual(['Percentage', '0 – 100%', '40%', '+1% per story hour', 'World']);
  });

  // The default-row table: a stat at each default keeps only the rows that always show.
  it.each([
    ['Starts At', { starting: 0 }, { starting: 1 }],
    ['Starts At', { value: 0 }, { value: 1 }],
    ['Starts At', { min: 10, starting: 10 }, { min: 10, starting: 0 }],
    ['Regen', { regen: 0 }, { regen: 1 }],
    ['Shown To', { hidden: false }, { hidden: true }],
    ['Off', { enabled: true }, { enabled: false }],
  ] as const)('%s drops at its default and shows off it', (label, atDefault, offDefault) => {
    const labels = (extra: Partial<Stat>) => statRows({ stat: stat('s', 'S', extra), owner: 'World' }).map((row) => row.label);
    expect(labels(atDefault)).toEqual(['Type', 'Range', 'Owner']);
    expect(labels(offDefault)).toContain(label);
  });

  it('shows no World Details where the editor has no lookup', () => {
    const card = codeCard('return stats.Health.value;', 'return stats.He'.length, { surface: STAT_CODE_SURFACE });
    expect(card?.rows).toBeUndefined();
  });
});

describe('stat cards: routes', () => {
  it('reaches the world stat through `stats` in an entity’s box, and the entity’s own through `owner.stats`', () => {
    expect(rowsOf(cardAt('return stats.Hea|lth.value;', maraBox))).toEqual({ Type: 'Number', Range: '0 – 100', Owner: 'World' });
    expect(rowsOf(cardAt('return owner.stats.Hea|lth.value;', maraBox)))
      .toEqual({ Type: 'Number', Range: '0 – 10', 'Starts At': '5', Owner: 'Mara' });
    expect(cardAt('return owner.stats.Hea|lth.value;', maraBox)?.item).toEqual({ kind: 'stat', statId: 'mara-health', entityId: 'mara' });
  });

  it('names each entity in the Owner row, though `entities` keys only the last of two that share a name', () => {
    const guard = (id: string): Entity => ({ id, name: 'Guard', stats: [stat(`${id}-hp`, 'HP')] });
    const options = box({ kind: 'entity', entityId: 'g1' }, stat('g1-hp', 'HP'), 'after', { ...world, entities: [guard('g1'), guard('g2')] });
    expect(rowsOf(cardAt('return owner.stats.H|P.value;', options)).Owner).toBe('Guard');
    expect(cardAt('return own|er.name;', options)?.item).toEqual({ kind: 'entity', entityId: 'g1' });
  });

  it('shows a Link’s Overrides, then its Blueprint', () => {
    for (const doc of ['return owner.stats.Ra|ge.value;', 'return entities.Mara.stats.Ra|ge.value;']) {
      const card = cardAt(doc, maraBox);
      expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 50', Owner: 'Mara' });
      expect(card?.description).toBe('How angry the bearer is.');
    }
  });

  it('names nothing through `owner.stats` in a world stat’s box', () => {
    expect(cardAt('return owner.stats.Hea|lth.value;', worldBox)?.rows).toBeUndefined();
  });

  it('shows the Blueprint’s own values and who runs the code through `owner.stats` in a Blueprint box', () => {
    expect(rowsOf(cardAt('return owner.stats.Ra|ge.value;', rageBox())))
      .toEqual({ Type: 'Number', Range: '0 – 100', Owner: 'Blueprint', Bearers: 'Mara, Tom' });
    expect(rowsOf(cardAt('return owner.stats.Ca|lm.value;', rageBox('before'))))
      .toEqual({ Type: 'Number', Range: '0 – 100', Owner: 'Blueprint', Bearers: 'Mara, Tom, Kai' });
  });

  it('shows the one playable entity’s Link Overrides for `persona.stats`, with its item (T15-1)', () => {
    const card = cardAt('return persona.stats.Ra|ge.value;', worldBox);
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 60', Owner: 'Tom' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'rage', entityId: 'tom' });
  });

  it('finds the uses of the one playable entity’s stat from its `persona.stats` card', () => {
    const reader = stat('mood', 'Mood', { code: 'return persona.stats.Rage.value;' });
    const options = box(null, reader, 'after', { ...world, stats: [health, fatigue, rage, calm, reader] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(options.lookup!.uses(card!.item!).map((use) => [use.stat, use.line])).toEqual([['Mood', 1]]);
  });

  it('shows the one playable entity’s own stat for `persona.stats`, with its item', () => {
    const ivy: Entity = { id: 'ivy', name: 'Ivy', persona: true, stats: [stat('ivy-rage', 'Rage', { max: 7 })] };
    const options = box(null, health, 'after', { ...world, entities: [mara, kai, ivy] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 7', Owner: 'Ivy' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'ivy-rage', entityId: 'ivy' });
  });

  it('shows the Blueprint’s values for `persona.stats` when every playable owner links it (Q34)', () => {
    const lia: Entity = { id: 'lia', name: 'Lia', persona: true, statLinks: [link('lia-rage')] };
    const card = cardAt('return persona.stats.Ra|ge.value;', box(null, health, 'after', { ...world, entities: [mara, tom, kai, lia] }));
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 100', Owner: 'Tom, Lia' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'rage' });
  });

  it('shows only the owners for `persona.stats` when the playable owners’ stats differ', () => {
    const ivy: Entity = { id: 'ivy', name: 'Ivy', persona: true, stats: [stat('ivy-rage', 'Rage', { max: 7 })] };
    const options = box(null, health, 'after', { ...world, entities: [mara, tom, kai, ivy] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(card?.rows).toEqual([{ label: 'Owner', value: 'Tom, Ivy' }]);
    expect(card?.item).toBeUndefined();
  });

  it('shows no World Details for `persona.stats` that no playable entity has', () => {
    expect(cardAt('return persona.stats.Hea|lth.value;', worldBox)?.rows).toBeUndefined();
  });
});

describe('lazyLookup', () => {
  it('builds the lookup on the first question, once', () => {
    const make = vi.fn(() => statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: health }));
    const lookup = lazyLookup(make);
    expect(make).not.toHaveBeenCalled();
    expect(lookup.stat({ route: 'world' }, 'Health')?.stat?.id).toBe('health');
    expect(lookup.owner()).toEqual({ kind: 'empty' });
    expect(lookup.trait({ route: 'world' }, 'Brave')).toBeNull();
    expect(lookup.self().stat.id).toBe('health');
    expect(make).toHaveBeenCalledTimes(1);
  });
});

describe('`self` and `owner` cards', () => {
  it('names the stat the code belongs to on `self`, above its rows', () => {
    const card = cardAt('return se|lf.value;', maraBox);
    expect(card?.rows).toEqual([
      { label: 'Stat', value: 'Health' },
      { label: 'Type', value: 'Number' },
      { label: 'Range', value: '0 – 10' },
      { label: 'Starts At', value: '5' },
      { label: 'Owner', value: 'Mara' },
    ]);
  });

  it('shows the owning entity in an owned box', () => {
    const card = cardAt('return own|er.name;', maraBox);
    // No card world here, so the entity rows hold its stats alone.
    expect(card?.rows).toEqual([
      { label: 'Stats', value: 'Health, Rage' }, { label: 'Traits', value: 'None' }, { label: 'Placeholders', value: 'None' },
    ]);
    expect(card?.item).toEqual({ kind: 'entity', entityId: 'mara' });
  });

  it('opens the owning entity’s card with its description, else keeps the `owner` line (T16-1)', () => {
    const vex: Entity = { id: 'vex', name: 'Vex', playerDescription: 'A smuggler with debts.', stats: [stat('vex-luck', 'Luck')] };
    const vexBox = box({ kind: 'entity', entityId: 'vex' }, vex.stats![0], 'after', { ...world, entities: [vex] });
    expect(cardAt('return own|er.name;', vexBox)?.description).toBe('A smuggler with debts.');
    expect(cardAt('return own|er.name;', maraBox)?.description).toMatch(/^The entity that owns this stat/);
  });

  it('says `owner` is empty in a world stat’s box, with nothing to open or search', () => {
    const card = cardAt('return own|er.name;', worldBox);
    expect(card?.description).toBe('Holds nothing in a world stat’s code. Writing through it changes nothing.');
    expect(card?.rows).toBeUndefined();
    expect(card?.item).toBeUndefined();
  });

  it('lists the owners that run a Blueprint box', () => {
    expect(cardAt('return own|er.name;', rageBox())?.rows).toEqual([{ label: 'Bearers', value: 'Mara, Tom' }]);
    expect(cardAt('return own|er.name;', rageBox('before'))?.rows).toEqual([{ label: 'Bearers', value: 'Mara, Tom, Kai' }]);
  });

  it('marks a Blueprint box no one runs', () => {
    expect(cardAt('return own|er.name;', box({ kind: 'blueprint' }, calm))?.rows).toEqual([{ label: 'Bearers', value: 'No bearers' }]);
  });
});
