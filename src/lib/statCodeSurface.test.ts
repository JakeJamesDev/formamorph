import { describe, it, expect } from 'vitest';
import { phNode } from '@/test/sandboxPlaceholders';
import { executeStatCode, type CodeBoundField } from './statCodeExecutor';
import {
  BUILTIN_MEMBERS, DELTA_FIELDS, DELTA_MEMBERS, LANGUAGE_NAMES, placeholderEntryFields, PREVIOUS_FIELDS, SANDBOX_BUILTINS, SANDBOX_GLOBALS,
  SANDBOX_UNDOCUMENTED_GLOBALS, SELF_WRITABLE_FIELDS, STAT_FIELDS, TRAIT_ENTRY_FIELDS, nearestSurfaceName,
} from './statCodeSurface';
import { runStatCodeTurn } from './statCodeTurn';
import { STAT_CODE_TIMINGS, type StatCodeTiming } from './statCodeTiming';
import type { PlayerStat, Stat } from '@/types';

const stat = (over: Partial<Stat>): Stat => ({
  id: 'a', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, ...over,
} as Stat);

const stats = [stat({}), stat({ id: 'b', name: 'Stamina', value: 20 })];

/** Run a probe through the real sandbox. The surface module is only trustworthy if what it claims is
 *  reachable actually is — so the guard asks QuickJS rather than reading the executor's source. */
const run = (code: string) => executeStatCode(code, stats, stats[0]);

describe('the described surface against the sandbox that provides it', () => {
  it.each([...SANDBOX_GLOBALS.map(entry => entry.name), ...SANDBOX_UNDOCUMENTED_GLOBALS])('injects %s', async (name) => {
    await expect(run(`return typeof ${name} === 'undefined' ? 0 : 1;`)).resolves.toEqual({ value: 1, error: null });
  });

  // These suppress the unknown-identifier squiggle, so one the VM lacks means the linter stays quiet
  // about the exact ReferenceError it exists to predict.
  // `this` and `undefined` are excluded because the probe can't tell present from absent for either —
  // `typeof undefined` is 'undefined' by definition, and `this` is whatever the call site makes it.
  it.each([...SANDBOX_BUILTINS.map(entry => entry.name), ...LANGUAGE_NAMES]
    .filter(name => name !== 'this' && name !== 'undefined'))(
    'has %s, which the linter lets through unflagged',
    async (name) => {
      await expect(run(`return typeof ${name} === 'undefined' ? 0 : 1;`)).resolves.toEqual({ value: 1, error: null });
    },
  );

  it('describes every field a marshalled stat carries, and no field it does not', async () => {
    const expected = STAT_FIELDS.map(field => field.name).sort().join(',');
    await expect(run(`return Object.keys(stats.Health).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`))
      .resolves.toEqual({ value: 1, error: null });
  });

  // An unknown name is underlined, not silenced, so its fields complete like any other stat's.
  it('describes every field of the blank entry an unknown stat name reads as', async () => {
    const expected = STAT_FIELDS.map(field => field.name).sort().join(',');
    await expect(run(`return Object.keys(stats.Nope).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`))
      .resolves.toEqual({ value: 1, error: null });
  });

  it.each([
    ['previous', PREVIOUS_FIELDS],
    ['delta', DELTA_MEMBERS],
    ...DELTA_MEMBERS.map((member) => [`delta.${member.name}`, DELTA_FIELDS] as const),
  ] as const)(
    'describes every field on a stat’s %s, and no field it does not',
    async (field, described) => {
      const expected = described.map(entry => entry.name).sort().join(',');
      await expect(run(`return Object.keys(stats.Health.${field}).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`))
        .resolves.toEqual({ value: 1, error: null });
    },
  );

  it('describes every member of a placeholders entry, and no member it does not', async () => {
    const expected = placeholderEntryFields('Wildcard').map(entry => entry.name).sort().join(',');
    const entry = phNode('Mood', 'calm');
    await expect(executeStatCode(
      `return Object.keys(placeholders.Mood).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`,
      stats, stats[0], { placeholders: [entry] },
    )).resolves.toEqual({ value: 1, error: null });
  });

  it('describes every member of a traits entry, and no member it does not', async () => {
    const expected = TRAIT_ENTRY_FIELDS.map(entry => entry.name).sort().join(',');
    await expect(executeStatCode(
      `return Object.keys(traits.Brave).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`,
      stats, stats[0], { traits: [{ name: 'Brave', enabled: false, acquired: false }] },
    )).resolves.toEqual({ value: 1, error: null });
  });

  // The one writable trait field; a write the host never reads back is the editor promising a switch that does nothing.
  it('reads a write to a trait’s enabled back out of the sandbox', async () => {
    const result = await executeStatCode('traits.Brave.enabled = true;', stats, stats[0],
      { traits: [{ name: 'Brave', enabled: false, acquired: false }] });
    expect(result.traits).toEqual([{ name: 'Brave', enabled: true }]);
  });

  it('offers self as the stat’s own entry in stats', async () => {
    await expect(run('return self === stats[self.name] ? 1 : 0;'))
      .resolves.toEqual({ value: 1, error: null });
  });

  // A field listed as writable that the host never reads back is the editor promising a write that does nothing.
  it.each(SELF_WRITABLE_FIELDS)('reads a write to self.%s back out of the sandbox', async (field) => {
    const result = await run(`self.${field} = 7;`);
    expect(field === 'value' ? result.value : result.bounds?.[field as CodeBoundField]).toBe(7);
  });

  // The member tables are keyed by name, so a built-in renamed in one list and not the other would offer
  // its members after a name the linter flags as unknown.
  it('keys its member tables on built-ins the surface also describes', () => {
    const known = SANDBOX_BUILTINS.map(entry => entry.name);
    expect([...BUILTIN_MEMBERS.keys()].filter(name => !known.includes(name))).toEqual([]);
  });

  // Offered after a dot, so a name the VM lacks is the editor promising an author `undefined`.
  it.each([...BUILTIN_MEMBERS].flatMap(
    ([builtin, members]) => members.map(member => [builtin, member.name] as const),
  ))('reaches %s.%s', async (builtin, member) => {
    await expect(run(`return typeof ${builtin}.${member} === 'undefined' ? 0 : 1;`))
      .resolves.toEqual({ value: 1, error: null });
  });

  // `stats` is keyed by name, so each stat's name reaches that stat.
  it.each(stats.map(entry => [entry.name, entry.id] as const))('reaches stats.%s by name', async (name, id) => {
    await expect(run(`return stats.${name}.id === ${JSON.stringify(id)} ? 1 : 0;`))
      .resolves.toEqual({ value: 1, error: null });
  });

  // The other half of the guard: a surface that listed everything would pass the check above trivially.
  it.each(['window', 'fetch', 'localStorage', 'document', 'process'])(
    'leaves %s out, because the sandbox does too',
    async (name) => {
      expect(SANDBOX_GLOBALS.map(entry => entry.name)).not.toContain(name);
      await expect(run(`return typeof ${name} === 'undefined' ? 1 : 0;`)).resolves.toEqual({ value: 1, error: null });
    },
  );
});

/**
 * The same surface through the turn runner, box by box.
 *
 * `executeStatCode` above is timing-blind, so it can only prove what the sandbox offers, not what each box
 * actually gets handed. These run a real turn and read the answer back as the stat's value, which is how a
 * before box that lost a global — or an after box that started reading zeros — would show up.
 */
const turnProbe = async (timing: StatCodeTiming, code: string): Promise<number | undefined> => {
  const probe: PlayerStat = { ...stats[0], value: 50, descriptors: [], ...(timing === 'before' ? { beforeCode: code } : { code }) };
  const out = await runStatCodeTurn({
    timing,
    stats: [probe],
    enabled: {},
    previous: [{ ...probe, value: 10 }],
    asks: [{ id: probe.id, value: 40, max: 0 }],
    regenApplied: { [probe.id]: 5 },
    clock: {},
    traits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
  });
  return out.stats[0].value;
};

describe('the described surface in each of the two boxes', () => {
  it.each(STAT_CODE_TIMINGS.flatMap(
    (timing) => SANDBOX_GLOBALS.map((entry) => [timing, entry.name] as const),
  ))('injects %s into the %s box', async (timing, name) => {
    await expect(turnProbe(timing, `return typeof ${name} === 'undefined' ? 0 : 1;`)).resolves.toBe(1);
  });

  it.each(DELTA_MEMBERS.map((member) => member.name))(
    'reads delta.%s as zero in the before box, where nothing has moved yet',
    async (member) => {
      const sum = DELTA_FIELDS.map((field) => `self.delta.${member}.${field.name}`).join(' + ');
      await expect(turnProbe('before', `return ${sum};`)).resolves.toBe(0);
    },
  );

  it('still reads the turn’s own changes in the after box, so the zeros are the before box’s alone', async () => {
    // The same turn the before box read as all zeros: a 40 ask and 5 of regen.
    await expect(turnProbe('after', 'return self.delta.ai.value + self.delta.regen.value;')).resolves.toBe(45);
  });

  it('reads previous as the stat itself in the before box, and as the turn’s start in the after box', async () => {
    await expect(turnProbe('before', 'return self.previous.value === self.value ? 1 : 0;')).resolves.toBe(1);
    await expect(turnProbe('after', 'return self.previous.value;')).resolves.toBe(10);
  });

  // The cases above fill one box at a time. One stat holding both proves the run reaches its own box's text
  // and not the other's, which is the one way the two surfaces could be right and still be swapped.
  it('runs the box the turn asked for on a stat that fills both', async () => {
    const both: PlayerStat = {
      ...stats[0], value: 50, descriptors: [], beforeCode: 'return 11;', code: 'return 22;',
    };
    const valueFrom = async (timing: StatCodeTiming) => {
      const out = await runStatCodeTurn({
        timing,
        stats: [both],
        enabled: {},
        previous: [both],
        asks: [],
        regenApplied: {},
        clock: {},
        traits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
        statNameOf: (entry) => entry.name,
        traitNameOf: (entry) => entry.name,
      });
      return out.stats[0].value;
    };
    expect(await valueFrom('before')).toBe(11);
    expect(await valueFrom('after')).toBe(22);
  });
});

describe('nearestSurfaceName', () => {
  it('points a near miss at the name it was reaching for', () => {
    expect(nearestSurfaceName('elapsedHrs')).toBe('elapsedHours');
    expect(nearestSurfaceName('Stats')).toBe('stats');
  });

  it('says nothing when the name is already right', () => {
    expect(nearestSurfaceName('stats')).toBeNull();
  });

  it('declines to guess when nothing is close', () => {
    expect(nearestSurfaceName('zqxwvutsr')).toBeNull();
  });

  it('will suggest a name the author declared themselves', () => {
    expect(nearestSurfaceName('hungerRat', ['hungerRate'])).toBe('hungerRate');
  });

  it('keeps short names from suggesting each other on a single letter', () => {
    expect(nearestSurfaceName('abc')).toBeNull();
  });
});
