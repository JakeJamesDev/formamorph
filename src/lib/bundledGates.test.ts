import { describe, expect, it } from 'vitest';
import { migrateWorld } from './version';
import { runRules } from './testBench/rules';

const raws = import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true });

// Q14: each bundled world's gates hold under the global scope split, loaded the way the seeder loads it.
describe.each(Object.entries(raws).map(([path, raw]) => [path.replace(/.*\/|\.json$/g, ''), raw]))('the %s world', (_, raw) => {
  it('raises no gate finding on the Test Bench', () => {
    const findings = runRules(migrateWorld(JSON.parse(raw)))
      .filter((f) => /^(trait-requirement-|trait-link-|trait-default-|image-rule-|entity-images-all-hideable)/.test(f.ruleId))
      .map((f) => `${f.ruleId}: ${f.message}`);
    expect(findings).toEqual([]);
  });
});
