import { describe, it, expect } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import {
  LANGUAGE_NAMES, SANDBOX_BUILTINS, SANDBOX_GLOBALS, STAT_FIELDS, nearestSurfaceName,
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
