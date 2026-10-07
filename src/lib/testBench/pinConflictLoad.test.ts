import { describe, it, expect, beforeAll } from 'vitest';
import { loadPinWorld } from '@/test/pinWorld';
import { RULES, type RuleWorld } from './rules';

let world: RuleWorld;

beforeAll(() => {
  world = loadPinWorld();
}, 60_000);

describe('placeholder-pin-conflict on the pin world', () => {
  it('finds Mood\'s conflict in under 200 ms', () => {
    const rule = RULES.find((r) => r.id === 'placeholder-pin-conflict')!;
    const t0 = performance.now();
    const findings = rule.check(world);
    const ms = performance.now() - t0;
    // Mood's finding names every source that pins it.
    expect(findings.map((f) => [f.items[0].name, f.items.length])).toEqual([['Mood', 552]]);
    expect(ms).toBeLessThan(200);
  });
});
