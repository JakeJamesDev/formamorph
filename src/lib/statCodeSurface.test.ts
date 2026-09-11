import { describe, it, expect } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import {
  BUILTIN_MEMBERS, LANGUAGE_NAMES, PREVIOUS_FIELDS, REQUESTED_FIELDS, SANDBOX_BUILTINS, SANDBOX_GLOBALS,
  SELF_WRITABLE_FIELDS, STATS_MEMBERS, STAT_FIELDS, nearestSurfaceName,
} from './statCodeSurface';
import type { Stat } from '@/types';

const stat = (over: Partial<Stat>): Stat => ({
  id: 'a', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, ...over,
} as Stat);

const stats = [stat({}), stat({ id: 'b', name: 'Stamina', value: 20 })];

/** Run a probe through the real sandbox. The surface module is only trustworthy if what it claims is
 *  reachable actually is — so the guard asks QuickJS rather than reading the executor's source. */
const run = (code: string) => executeStatCode(code, stats, stats[0]);

describe('the described surface against the sandbox that provides it', () => {
  it.each(SANDBOX_GLOBALS.map(entry => entry.name))('injects %s', async (name) => {
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
    await expect(run(`return Object.keys(stats[0]).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`))
      .resolves.toEqual({ value: 1, error: null });
  });

  it.each([['previous', PREVIOUS_FIELDS], ['requested', REQUESTED_FIELDS]] as const)(
    'describes every field on a stat’s %s, and no field it does not',
    async (field, described) => {
      const expected = described.map(entry => entry.name).sort().join(',');
      await expect(run(`return Object.keys(stats[0].${field}).sort().join(',') === ${JSON.stringify(expected)} ? 1 : 0;`))
        .resolves.toEqual({ value: 1, error: null });
    },
  );

  it('offers self as the stat’s own entry in stats', async () => {
    await expect(run('return self === stats.find(s => s.id === currentStatId) ? 1 : 0;'))
      .resolves.toEqual({ value: 1, error: null });
  });

  // A field listed as writable that the host never reads back is the editor promising a write that does nothing.
  it.each(SELF_WRITABLE_FIELDS)('reads a write to self.%s back out of the sandbox', async (field) => {
    await expect(run(`self.${field} = 7;`)).resolves.toEqual({ value: 7, error: null });
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

  it.each(STATS_MEMBERS.map(member => member.name))('reaches stats.%s', async (member) => {
    await expect(run(`return typeof stats.${member} === 'undefined' ? 0 : 1;`))
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
