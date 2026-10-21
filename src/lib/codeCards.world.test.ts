import { describe, it, expect, vi } from 'vitest';
import { codeCard, statRows, type CodeCard } from './codeCards';
import { lazyLookup, statBoxLookup, type CodeBox, type CodeBoxOwner } from './codeWorldLookup';
import type { SurfaceAnalysisOptions } from './statCodeAnalysis';
import { STAT_CODE_SURFACE, WORLD_SCRIPT_SURFACE } from './statCodeSurface';
import { statCodeOwners, type StatRouteWorld } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';
import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });

const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
// A Blueprint group, so `owner.stats` in Rage's box holds Calm too.
const beast: StatGroup = { id: 'beast', name: 'Beast', parentId: 'bp' };
const rage = stat('rage', 'Rage', { groupId: 'beast', description: 'How angry the owner is.' });
const calm = stat('calm', 'Calm', { groupId: 'beast' });
const health = stat('health', 'Health');
// Fixtures author the opening number as `value`, the start value (Q8).
const fatigue = stat('fatigue', 'Fatigue', {
  description: 'How worn out the player is.', value: 20, regen: -2 / 24, regenUnit: 'days', hidden: true, enabled: false,
});

const link = (id: string, overrides?: StatLink['overrides']): StatLink =>
  ({ id, originalId: 'rage', kind: 'stat', originalName: 'Rage', groupId: null, ...(overrides ? { overrides } : {}) });

const mara: Entity = {
  id: 'mara', name: 'Mara',
  stats: [stat('mara-health', 'Health', { max: 10, value: 5 })],
  statLinks: [link('mara-rage', { rage: { max: { value: 50, blueprint: 100 } } })],
};
const tom: Entity = { id: 'tom', name: 'Tom', persona: true, statLinks: [link('tom-rage', { rage: { max: { value: 60, blueprint: 100 } } })] };
// Kai's Link overrides the scripts, so none of the Blueprint's scripts run for Kai (Q32).
const kai: Entity = { id: 'kai', name: 'Kai', statLinks: [link('kai-rage', { rage: { scripts: { value: boxScripts({ after: 'return 1;' }), blueprint: boxScripts({ after: '' }) } } })] };

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
  it('shows Type and Range, and drops every row at its default and the Owners row of a world stat', () => {
    const card = cardAt('return stats.Hea|lth.value;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Type', value: 'Number' },
      { label: 'Range', value: '0 – 100' },
    ]);
    expect(card?.signature).toEqual({ kind: 'stat', path: 'stats.Health', type: 'Stat', scope: 'global' });
  });

  it('shows each row off its default, in order, and the authored description', () => {
    const card = cardAt('return stats.Fat|igue.value;', worldBox);
    expect(card?.rows).toEqual([
      { label: 'Type', value: 'Number' },
      { label: 'Range', value: '0 – 100' },
      { label: 'Starts At', value: '20' },
      { label: 'Regen', value: '−2 per story day' },
      { label: 'Shown To', value: 'AI only' },
      { label: 'Off', value: 'Until a trait turns it on' },
    ]);
    expect(card?.description).toBe('How worn out the player is.');
    expect(card?.item).toEqual({ kind: 'stat', statId: 'fatigue' });
  });

  // Q8: the authored value is the start, not `starting`.
  it('reads Starts At from the authored value', () => {
    const rows = statRows({ stat: stat('s', 'S', { starting: 10, value: 5 }), owners: ['Tom'] });
    expect(rows.find((row) => row.label === 'Starts At')?.value).toBe('5');
  });

  it('reads a percentage stat’s amounts with a percent sign', () => {
    const rows = statRows({ stat: stat('p', 'P', { type: 'percentage', value: 40, regen: 1 }), owners: ['Tom'] });
    expect(rows.map((row) => row.value)).toEqual(['Percentage', '0 – 100%', '40%', '+1% per story hour', 'Tom']);
  });

  // The default-row table: a stat at each default keeps only the rows that always show.
  it.each([
    ['Starts At', { value: 0 }, { value: 1 }],
    ['Starts At', { min: 10, value: 10 }, { min: 10, value: 20 }],
    ['Starts At', { starting: 1 }, { value: 1 }], // Q8: `starting` is not the start value
    ['Regen', { regen: 0 }, { regen: 1 }],
    ['Shown To', { hidden: false }, { hidden: true }],
    ['Off', { enabled: true }, { enabled: false }],
  ] as const)('%s drops at its default and shows off it', (label, atDefault, offDefault) => {
    const labels = (extra: Partial<Stat>) => statRows({ stat: stat('s', 'S', extra), owners: ['Tom'] }).map((row) => row.label);
    expect(labels(atDefault)).toEqual(['Type', 'Range', 'Owners']);
    expect(labels(offDefault)).toContain(label);
  });

  it('shows no World Details where the editor has no lookup', () => {
    const card = codeCard('return stats.Health.value;', 'return stats.He'.length, { surface: STAT_CODE_SURFACE });
    expect(card?.rows).toBeUndefined();
  });
});

describe('stat cards: routes', () => {
  it('reaches the world stat through `stats` in an entity’s box, and the entity’s own through `owner.stats`', () => {
    expect(rowsOf(cardAt('return stats.Hea|lth.value;', maraBox))).toEqual({ Type: 'Number', Range: '0 – 100' });
    const own = cardAt('return owner.stats.Hea|lth.value;', maraBox);
    expect(rowsOf(own)).toEqual({ Type: 'Number', Range: '0 – 10', 'Starts At': '5', Owners: 'Mara' });
    expect(own?.signature).toEqual({ kind: 'stat', path: 'owner.stats.Health', type: 'Stat' });
    expect(cardAt('return owner.stats.Hea|lth.value;', maraBox)?.item).toEqual({ kind: 'stat', statId: 'mara-health', entityId: 'mara' });
  });

  it('names each entity in the Owners row, though `entities` keys only the last of two that share a name', () => {
    const guard = (id: string): Entity => ({ id, name: 'Guard', stats: [stat(`${id}-hp`, 'HP')] });
    const options = box({ kind: 'entity', entityId: 'g1' }, stat('g1-hp', 'HP'), 'after', { ...world, entities: [guard('g1'), guard('g2')] });
    expect(rowsOf(cardAt('return owner.stats.H|P.value;', options)).Owners).toBe('Guard');
    expect(cardAt('return own|er.name;', options)?.item).toEqual({ kind: 'entity', entityId: 'g1' });
  });

  it('shows a Link’s Overrides, then its Blueprint', () => {
    for (const doc of ['return owner.stats.Ra|ge.value;', 'return entities.Mara.stats.Ra|ge.value;']) {
      const card = cardAt(doc, maraBox);
      expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 50', Owners: 'Mara' });
      expect(card?.description).toBe('How angry the owner is.');
    }
  });

  it('names nothing through `owner.stats` in a world stat’s box', () => {
    expect(cardAt('return owner.stats.Hea|lth.value;', worldBox)?.rows).toBeUndefined();
  });

  it('shows the Blueprint’s own values and who runs the code through `owner.stats` in a Blueprint box', () => {
    const card = cardAt('return owner.stats.Ra|ge.value;', rageBox());
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 100', Owners: 'Mara, Tom' });
    expect(card?.signature).toEqual({ kind: 'stat', path: 'owner.stats.Rage', type: 'Stat', scope: 'blueprint' });
    expect(rowsOf(cardAt('return owner.stats.Ca|lm.value;', rageBox('before'))))
      .toEqual({ Type: 'Number', Range: '0 – 100', Owners: 'Mara, Tom' });
  });

  it('says No Owners on a Blueprint stat no one runs', () => {
    expect(rowsOf(cardAt('return owner.stats.Ca|lm.value;', box({ kind: 'blueprint' }, calm))).Owners).toBe('No Owners');
  });

  it('shows the one playable entity’s Link Overrides for `persona.stats`, with its item (T15-1)', () => {
    const card = cardAt('return persona.stats.Ra|ge.value;', worldBox);
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 60', Owners: 'Tom' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'rage', entityId: 'tom' });
  });

  it('finds the uses of the one playable entity’s stat from its `persona.stats` card', () => {
    const reader = stat('mood', 'Mood', { scripts: boxScripts({ after: 'return persona.stats.Rage.value;' }) });
    const options = box(null, reader, 'after', { ...world, stats: [health, fatigue, rage, calm, reader] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(options.lookup!.uses(card!.item!).map((use) => [use.name, use.line])).toEqual([['Mood', 1]]);
  });

  it('shows the one playable entity’s own stat for `persona.stats`, with its item', () => {
    const ivy: Entity = { id: 'ivy', name: 'Ivy', persona: true, stats: [stat('ivy-rage', 'Rage', { max: 7 })] };
    const options = box(null, health, 'after', { ...world, entities: [mara, kai, ivy] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 7', Owners: 'Ivy' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'ivy-rage', entityId: 'ivy' });
  });

  it('shows the Blueprint’s values for `persona.stats` when every playable owner links it (Q34)', () => {
    const lia: Entity = { id: 'lia', name: 'Lia', persona: true, statLinks: [link('lia-rage')] };
    const card = cardAt('return persona.stats.Ra|ge.value;', box(null, health, 'after', { ...world, entities: [mara, tom, kai, lia] }));
    expect(rowsOf(card)).toEqual({ Type: 'Number', Range: '0 – 100', Owners: 'Tom, Lia' });
    expect(card?.item).toEqual({ kind: 'stat', statId: 'rage' });
  });

  it('shows only the owners for `persona.stats` when the playable owners’ stats differ', () => {
    const ivy: Entity = { id: 'ivy', name: 'Ivy', persona: true, stats: [stat('ivy-rage', 'Rage', { max: 7 })] };
    const options = box(null, health, 'after', { ...world, entities: [mara, tom, kai, ivy] });
    const card = cardAt('return persona.stats.Ra|ge.value;', options);
    expect(card?.rows).toEqual([{ label: 'Owners', value: 'Tom, Ivy' }]);
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
      { label: 'Owners', value: 'Mara' },
    ]);
  });

  it('names a world or Blueprint stat’s scope in the `self` Stat row, under the global’s signature', () => {
    const world = cardAt('return se|lf.value;', worldBox);
    expect(world?.signature.kind).toBe('global');
    expect(world?.signature.scope).toBeUndefined();
    expect(rowsOf(world)).toEqual({ Stat: 'Health (global stat)', Type: 'Number', Range: '0 – 100' });
    expect(rowsOf(cardAt('return se|lf.value;', rageBox())))
      .toEqual({ Stat: 'Rage (Blueprint stat)', Type: 'Number', Range: '0 – 100', Owners: 'Mara, Tom' });
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
    expect(card?.description).toBe('Holds nothing in a global stat’s code. Writing through it changes nothing.');
    expect(card?.rows).toBeUndefined();
    expect(card?.item).toBeUndefined();
  });

  it('lists the owners that run a Blueprint box', () => {
    expect(cardAt('return own|er.name;', rageBox())?.rows).toEqual([{ label: 'Owners', value: 'Mara, Tom' }]);
    expect(cardAt('return own|er.name;', rageBox('before'))?.rows).toEqual([{ label: 'Owners', value: 'Mara, Tom' }]);
  });

  it('marks a Blueprint box no one runs', () => {
    expect(cardAt('return own|er.name;', box({ kind: 'blueprint' }, calm))?.rows).toEqual([{ label: 'Owners', value: 'No Owners' }]);
  });
});

describe('self in a world script', () => {
  // The lookup binds a stat as `self`, as it does for any box; the world script's `self` must not read it.
  const worldScript: SurfaceAnalysisOptions = {
    surface: WORLD_SCRIPT_SURFACE, selfName: '', lookup: statBoxLookup(statCodeOwners(world), { owner: null, timing: 'after', self: health }),
  };

  it('keeps the card of an empty object and names no stat', () => {
    const card = cardAt('const x = se|lf;', worldScript);
    expect(card?.description).toBe('Empty in a world script');
    expect(card?.rows).toBeUndefined();
    expect(card?.item).toBeUndefined();
  });

  it('gives a field of self no card, since the object is empty', () => {
    expect(cardAt('const x = self.val|ue;', worldScript)).toBeNull();
    expect(cardAt('const x = self.val|ue;', worldBox)?.signature.path).toBe('Stat.value');
  });

  it('keeps the surface line on owner too', () => {
    expect(cardAt('const x = ow|ner;', worldScript)?.description).toBe('Empty in a world script');
  });

  it('still names the stat on a stat script’s self', () => {
    expect(rowsOf(cardAt('const x = se|lf;', worldBox))).toMatchObject({ Stat: 'Health (global stat)' });
  });
});
