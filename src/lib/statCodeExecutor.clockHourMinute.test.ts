/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeStatCode } from './statCodeExecutor';
import type { Stat } from '@/types';

const stat: Stat = {
  id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 10000, value: 0, regen: 0, descriptors: [],
};

const read = (code: string, clock: { deltaHours?: number; elapsedHours?: number }) =>
  executeStatCode(code, [stat], stat, { clock }).then((res) => res.value);

describe('clock hour and minute', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reads 21:59.7 as hour 22, minute 0', async () => {
    const clock = { deltaHours: 1, elapsedHours: 13.995 };
    expect(await read('return clock.hour;', clock)).toBe(22);
    expect(await read('return clock.minute;', clock)).toBe(0);
  });

  it('reads the turn start on clock.previous', async () => {
    const clock = { deltaHours: 2, elapsedHours: 5.5 };
    // End 13:30, start 11:30.
    expect(await read('return clock.hour * 100 + clock.minute;', clock)).toBe(1330);
    expect(await read('return clock.previous.hour * 100 + clock.previous.minute;', clock)).toBe(1130);
  });

  it('reads the default start hour on the opening turn', async () => {
    expect(await read('return clock.hour;', { deltaHours: 0, elapsedHours: 0 })).toBe(8);
  });
});
