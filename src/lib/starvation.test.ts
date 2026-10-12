import { describe, it, expect } from 'vitest';
import { starvationLoss } from './starvation';
import type { PlayerStat } from '@/types';

const stat = (id: string, name: string, value: number): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const stats = (hunger: number) => [stat('h', 'Health', 80), stat('u', 'Hunger', hunger)];

describe('starvationLoss', () => {
  it('costs 5 Health an hour while Hunger sits at 20 or less', () => {
    expect(starvationLoss(stats(20), {}, 2)).toBe(10);
    expect(starvationLoss(stats(21), {}, 2)).toBeNull();
  });

  it('costs nothing while either stat is switched off or missing', () => {
    expect(starvationLoss(stats(5), { u: false }, 1)).toBeNull();
    expect(starvationLoss(stats(5), { h: false }, 1)).toBeNull();
    expect(starvationLoss([stat('u', 'Hunger', 5)], {}, 1)).toBeNull();
  });
});
