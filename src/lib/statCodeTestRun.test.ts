/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runTestCode, statCodeNames, statHomeNamed, type StatCodeWorld, type TestRunOptions } from './statCodeTestRun';
import type { Stat } from '@/types';

const health: Stat = { id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const luck: Stat = { id: 'l', name: 'Luck', type: 'number', description: '', min: 0, max: 10, value: 3, regen: 1, descriptors: [] };
const world: StatCodeWorld = {
  stats: [health], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [],
};
const hubWorld: StatCodeWorld = { ...world, stats: [health, luck] };
const HEALTH = { kind: 'globalStat', stat: health } as const;

describe('runTestCode bound writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists a bound the run wrote', async () => {
    const report = await runTestCode('self.max = 60;', 'after', HEALTH, world);
    expect(report.error).toBeNull();
    expect(report.writes).toHaveLength(1);
  });

  it('reports the result in the range the run left on itself', async () => {
    expect((await runTestCode('self.max = 60; return 90;', 'after', HEALTH, world)).value).toBe(60);
    expect((await runTestCode('return 500;', 'after', HEALTH, world)).value).toBe(100);
  });

  it.each(['value', 'min', 'max', 'regen'])('fails on null written to self.%s and lists no writes', async (field) => {
    const report = await runTestCode(`self.max = 60; self.${field} = null;`, 'after', HEALTH, world);
    expect(report.error).toContain(`self.${field} must be`);
    expect(report.writes).toEqual([]);
  });
});

describe('runTestCode writes to other stats', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists each write to another stat with its stat name, field and number, beside the box’s own', async () => {
    const code = 'self.max = 60; stats.Luck.value += 2; stats.Luck.max = 12; stats["Luck"].regen = 0.5; return 40;';
    const report = await runTestCode(code, 'after', HEALTH, hubWorld);
    expect(report.error).toBeNull();
    expect(report.value).toBe(40);
    expect(report.writes).toEqual([
      'Max: 60', 'stats.Luck.value = 5', 'stats.Luck.max = 12', 'stats.Luck.regen = 0.5',
    ]);
    expect(report.dropped).toEqual([]);
  });

  it('lists a bound written to the value it already holds, as any bound assignment is a write', async () => {
    const report = await runTestCode('stats.Luck.max = 10;', 'after', HEALTH, hubWorld);
    expect(report.writes).toEqual(['stats.Luck.max = 10']);
  });

  it('names a stat with a space in its name the way code reaches it', async () => {
    const vision: Stat = { ...luck, id: 'v', name: 'Night Vision' };
    const report = await runTestCode('stats["Night Vision"].value = 9;', 'after', HEALTH, { ...world, stats: [health, vision] });
    expect(report.writes).toEqual(['stats["Night Vision"].value = 9']);
  });

  it('applies nothing to the authored world', async () => {
    const before = JSON.stringify(hubWorld);
    await runTestCode('self.max = 60; stats.Luck.value = 9; stats.Luck.max = 99; return 1;', 'after', HEALTH, hubWorld);
    expect(JSON.stringify(hubWorld)).toBe(before);
    expect(luck).toMatchObject({ value: 3, max: 10, regen: 1 });
  });

  it('drops and names a write to a stat that does not exist, and to one a trait switched off', async () => {
    const off: Stat = { ...luck, id: 'o', name: 'Dusk', enabled: false };
    const report = await runTestCode(
      'stats.Helth.value = 1; stats.Dusk.value = 2; stats.Luck.value = 4;', 'after', HEALTH,
      { ...world, stats: [health, luck, off] },
    );
    expect(report.writes).toEqual(['stats.Luck.value = 4']);
    expect(report.dropped).toEqual([
      'Unknown stat names. Writes ignored: stats.Helth.value.',
      'Switched-off stats. Writes ignored: stats.Dusk.value.',
    ]);
  });
});

describe('runTestCode at turn one (Q3)', () => {
  // Bram's Boast raises the global Luck once picked; Albus can only be played, so turn one casts only Bram.
  const boast = { id: 'boast', name: 'Boast', statChanges: [{ statId: 'l', value: 2, type: 'starting' as const }] };
  const turnOne: StatCodeWorld = {
    ...hubWorld,
    entities: [{ id: 'bram', name: 'Bram', traits: [boast] }, { id: 'albus', name: 'Albus', persona: true, personaOnly: true }],
  };

  it('applies no entity trait, since nothing is picked', async () => {
    expect((await runTestCode('return stats.Luck.value;', 'after', HEALTH, turnOne)).value).toBe(3);
  });

  it('casts only the entities a new game with no persona casts', async () => {
    const report = await runTestCode('return Object.keys(entities).length * 10 + (Object.keys(entities)[0] === "Bram" ? 1 : 0);', 'after', HEALTH, turnOne);
    expect(report.value).toBe(11);
  });
});

describe('runTestCode trait gates', () => {
  it("reads a stat gate against each stat's authored start", async () => {
    const berserk = {
      id: 'berserk', name: 'Berserk', statChanges: [],
      requires: [{ all: [{ kind: 'stat' as const, id: 'h', operator: '>=' as const, value: 80, unit: 'raw' as const }] }],
    };
    const at = (value: number): StatCodeWorld => ({ ...world, stats: [{ ...health, value }], traits: [berserk] });
    const code = 'return traits.Berserk.available ? 1 : 0;';
    expect((await runTestCode(code, 'after', HEALTH, at(85))).value).toBe(1);
    expect((await runTestCode(code, 'after', HEALTH, at(70))).value).toBe(0);
  });
});

describe('runTestCode entity fields', () => {
  const castWorld: StatCodeWorld = {
    ...world,
    entities: [{ id: 'mira', name: 'Mira', type: 'Guide', pronouns: 'she/her' }, { id: 'rook', name: 'Rook' }],
  };
  it.each([
    ['pronouns', "entities.Mira.pronouns === 'she/her'"],
    ['type', "entities.Mira.type === 'Guide'"],
    ['an unset pronouns', "entities.Rook.pronouns === ''"],
  ])('reads an entity’s authored %s', async (_, check) => {
    expect((await runTestCode(`return ${check} ? 1 : 0;`, 'after', HEALTH, castWorld)).value).toBe(1);
  });
});

// A city world: the world's Destruction and a switched-off Dusk, the Creature's own Fury and Stamina and a
// switched-off Idle, Wren's Nerve (Wren can be played), and a Blueprint group of Fear and Calm.
const stat = (id: string, name: string, value: number, max = 100, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max, value, regen: 0, descriptors: [], ...extra });
const destruction = stat('destruction', 'Destruction', 10);
const alert = stat('alert', 'Alert', 20, 50);
const dusk = stat('dusk', 'Dusk', 1, 10, { enabled: false });
const fury = stat('fury', 'Fury', 2, 10);
const stamina = stat('stamina', 'Stamina', 8, 20);
const idle = stat('idle', 'Idle', 1, 10, { enabled: false });
const nerve = stat('nerve', 'Nerve', 3, 10);
const fear = stat('fear', 'Fear', 4, 10, { groupId: 'bp-fear' });
const calm = stat('calm', 'Calm', 6, 10, { groupId: 'bp-fear' });
const cityWorld: StatCodeWorld = {
  ...world,
  stats: [destruction, alert, dusk, fear, calm],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }, { id: 'bp-fear', name: 'Fear', parentId: 'bp' }],
  entities: [
    { id: 'creature', name: 'The Creature', stats: [fury, stamina, idle] },
    { id: 'wren', name: 'Wren', persona: true, stats: [nerve] },
  ],
};

/** Test Code on the stat of `cityWorld` named `statName`, from the home `statHomeNamed` finds for it. */
async function runOn(statName: string, code: string, options: TestRunOptions = {}) {
  const home = statHomeNamed(cityWorld, statCodeNames(cityWorld), statName);
  if (!home) throw new Error(`no stat named ${statName}`);
  return runTestCode(code, 'after', home, cityWorld, options);
}

describe('runTestCode for an owned stat', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads the world’s stats as `stats` and its own owner’s stats as `owner.stats`, each at its starting value', async () => {
    const report = await runOn('Fury', 'return stats.Destruction.value - owner.stats.Stamina.value;');
    expect(report.error).toBeNull();
    expect(report.value).toBe(2);
  });

  it('lists a write to a world stat and a write to the owner’s own stat, each with its route, stat, field and number', async () => {
    const report = await runOn('Fury', 'stats.Destruction.value += 5; owner.stats.Stamina.max = 12;');
    expect(report.writes).toEqual(['stats.Destruction.value = 15', 'owner.stats.Stamina.max = 12']);
    expect(report.dropped).toEqual([]);
  });

  it('takes `self` and its `owner.stats` entry as one stat', async () => {
    const report = await runOn('Fury', 'owner.stats.Fury.value = 9;');
    expect(report.value).toBe(9);
    expect(report.writes).toEqual([]);
  });

  it('lists a write through the owner’s `entities` entry under `owner.stats`, as one route', async () => {
    const report = await runOn('Fury', 'entities["The Creature"].stats.Stamina.value = 1;');
    expect(report.writes).toEqual(['owner.stats.Stamina.value = 1']);
  });

  it('lists a write to another entity’s stats under that entity', async () => {
    const report = await runOn('Fury', 'entities.Wren.stats.Nerve.max = 4;');
    expect(report.writes).toEqual(['entities.Wren.stats.Nerve.max = 4']);
  });

  it('applies nothing to the authored world', async () => {
    const before = JSON.stringify(cityWorld);
    await runOn('Fury', 'stats.Destruction.value = 99; owner.stats.Stamina.value = 0; entities.Wren.stats.Nerve.value = 1; self.max = 3;');
    expect(JSON.stringify(cityWorld)).toBe(before);
  });
});

describe('runTestCode for world code', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists a write to an entity’s stat under that entity, by the path the code wrote', async () => {
    const report = await runOn('Destruction', 'entities["The Creature"].stats.Stamina.max = 12; entities.Wren.stats.Nerve.value += 2;');
    expect(report.writes).toEqual(['entities["The Creature"].stats.Stamina.max = 12', 'entities.Wren.stats.Nerve.value = 5']);
  });

  it('runs with an empty `owner`, and drops and names a write through it', async () => {
    const report = await runOn('Destruction', 'owner.stats.Fury.value = 3; return Object.keys(owner.stats).length;');
    expect(report.value).toBe(0);
    expect(report.writes).toEqual([]);
    expect(report.dropped).toEqual(['Unknown stat names. Writes ignored: owner.stats.Fury.value.']);
  });
});

describe('runTestCode for a Blueprint stat', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('gives it an `owner.stats` that holds the Blueprint group’s stats only, and `stats` that holds the world’s', async () => {
    const report = await runOn('Fear', 'return Object.keys(owner.stats).length + Object.keys(stats).length * 2;');
    // Fear and Calm, and the world's Destruction, Alert and Dusk. The Blueprint stats are no world stats.
    expect(report.value).toBe(8);
  });

  it('lists a write to its group’s stat under `owner.stats`, and drops one to a stat outside the group', async () => {
    const report = await runOn('Fear', 'owner.stats.Calm.value = 7; owner.stats.Destruction.value = 1; stats.Destruction.value = 2;');
    expect(report.writes).toEqual(['stats.Destruction.value = 2', 'owner.stats.Calm.value = 7']);
    expect(report.dropped).toEqual(['Unknown stat names. Writes ignored: owner.stats.Destruction.value.']);
  });
});

describe('runTestCode persona stat writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('lists a `persona.stats` write with the pending persona writes, as a persona trait write is', async () => {
    const report = await runOn('Alert', 'persona.stats.Nerve.value = 6; stats.Destruction.value = 11;', { pendingPersona: true });
    expect(report.writes).toEqual(['stats.Destruction.value = 11']);
    expect(report.pending).toEqual(['persona.stats.Nerve.value = 6']);
    expect(report.dropped).toEqual([]);
  });

  it('drops and names it where no persona is pending, as the editor runs', async () => {
    const report = await runOn('Destruction', 'persona.stats.Nerve.value = 6;');
    expect(report.writes).toEqual([]);
    expect(report.dropped).toEqual(['Unknown stat names. Writes ignored: persona.stats.Nerve.value.']);
  });
});

describe('runTestCode dropped stat writes', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('names a write dropped on every route by the path the code wrote', async () => {
    const code = [
      'stats.Nope.value = 1;', 'stats.Dusk.value = 2;',
      'owner.stats.Nope.value = 1;', 'owner.stats.Idle.value = 2;',
      'entities.Wren.stats.Nope.value = 1;', 'entities.Nobody.stats.Nerve.value = 1;',
      'persona.stats.Nope.value = 1;',
    ].join(' ');
    const report = await runOn('Fury', code, { pendingPersona: true });
    expect(report.writes).toEqual([]);
    expect(report.pending).toEqual([]);
    expect(report.dropped).toEqual([
      'Unknown stat names. Writes ignored: stats.Nope.value, owner.stats.Nope.value, entities.Wren.stats.Nope.value, persona.stats.Nope.value, entities.Nobody.stats.Nerve.value.',
      'Switched-off stats. Writes ignored: stats.Dusk.value, owner.stats.Idle.value.',
    ]);
  });

  it('names a read-only field on every route', async () => {
    const report = await runOn('Fury', 'stats.Destruction.name = "x"; owner.stats.Stamina.id = "y"; entities.Wren.stats.Nerve.previous = null;');
    expect(report.dropped).toEqual([
      'Read-only fields. Writes ignored: stats.Destruction.name, owner.stats.Stamina.id, entities.Wren.stats.Nerve.previous.',
    ]);
  });
});

describe('statHomeNamed', () => {
  const names = statCodeNames(cityWorld);

  it('finds a world stat with no owner', () => {
    expect(statHomeNamed(cityWorld, names, 'Destruction')).toEqual({ kind: 'globalStat', stat: destruction });
  });

  it('finds a Blueprint stat with its group’s stats, and no entity', () => {
    expect(statHomeNamed(cityWorld, names, 'Calm')).toMatchObject({ kind: 'blueprintStat', stat: { id: 'calm' }, groupStats: [fear, calm] });
  });

  it('finds an entity’s own stat with that entity as its home', () => {
    expect(statHomeNamed(cityWorld, names, 'Stamina')).toMatchObject({ kind: 'entityStat', entityId: 'creature', stat: { id: 'stamina' } });
  });

  it('prefers a world stat to an entity stat of the same name, and finds nothing for an unknown name', () => {
    const twin: StatCodeWorld = { ...cityWorld, entities: [{ id: 'creature', name: 'The Creature', stats: [{ ...fury, name: 'Destruction' }] }] };
    expect(statHomeNamed(twin, statCodeNames(twin), 'Destruction')?.kind).toBe('globalStat');
    expect(statHomeNamed(cityWorld, names, 'Nope')).toBeUndefined();
  });
});
