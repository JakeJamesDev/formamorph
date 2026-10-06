import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateWorld } from '@/lib/version';
import { RULES, type RuleWorld } from './rules';

// The editor-speed pin world with 1-pixel images: "Mood" pinned 551 times, three sources pinning 200 each.
let dir = '';
let world: RuleWorld;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pin-world-'));
  const out = join(dir, 'pins.json');
  execFileSync(process.execPath, ['testing/editor-speed/genLargeWorld.mjs', '--pins', '1', '--image', '1', '--out', out], { stdio: 'ignore' });
  world = migrateWorld(JSON.parse(readFileSync(out, 'utf8')));
}, 60_000);

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

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
