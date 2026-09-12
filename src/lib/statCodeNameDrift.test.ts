/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import type { Placeholder, PlayerStat, WorldOverview } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { statCodeCompletions } from './statCodeAnalysis';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { runStatCodeTurn } from './statCodeTurn';
import { runRules, type RuleWorld } from './testBench/rules';

/**
 * The three surfaces that name a stat to code have to agree, or an author completes one name and runs
 * another. Each assertion below reads the name back out of a surface rather than restating it, and the
 * sandbox's own answer is what the other two are held to.
 */
const beast: Placeholder = { id: 'ph-beast', name: 'Beast', values: phValues(['Wolf', 'Bear']) };
const probe: Placeholder = { id: 'ph-probe', name: 'Probe', values: phValues(['unset']) };
const CHIPPED = '{{ph:ph-beast:world:p1}} Power';

const stat = (over: Partial<PlayerStat> & { id: string; name: string }): PlayerStat => ({
  type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [], ...over,
});

const power = stat({ id: 's1', name: CHIPPED, code: 'placeholders.Probe.pin(self.name);' });

/** The name the sandbox itself hands `self.name`, read back through a pin, under one playthrough's roll. */
async function nameInSandbox(rolled: string): Promise<string | null> {
  const out = await runStatCodeTurn({
    stats: [power],
    enabled: {},
    previous: [power],
    asks: [],
    regenApplied: {},
    clock: {},
    traits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
    statNameOf: (stat) => stat.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  return out.pinWrites['ph-probe'];
}

/** The unknown-stat findings a world raises for one piece of code that looks a stat up by name. */
function benchFindings(lookup: string): string[] {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: CHIPPED }), stat({ id: 's2', name: 'Mana', code: `return ${lookup}.value;` })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [beast],
  };
  return runRules(world).filter((f) => f.ruleId === 'stat-code-unknown-stat').map((f) => f.message);
}

describe('one code name across the sandbox, the completions, and the bench', () => {
  it('gives the sandbox the same name whatever the playthrough rolled', async () => {
    // The acceptance case: two saves, two different rolls, one name in code.
    expect(await nameInSandbox('Wolf')).toBe(await nameInSandbox('Bear'));
  });

  it('offers that same name in the completions, and never the rolled text', async () => {
    const sandboxName = await nameInSandbox('Wolf');
    const statNames = statCodeNamed([power], [beast, probe]).map((entry) => entry.name);
    // A code name with a space is reached through brackets, so that is where the list shows up.
    const code = 'return stats[""];';
    const caret = code.indexOf('""') + 1;
    const offered = statCodeCompletions(code, caret, { statNames })?.options.map((option) => option.label);
    expect(offered).toContain(sandboxName);
    expect(offered).not.toContain('Wolf Power');
    expect(offered).not.toContain(CHIPPED);
  });

  it('lets the bench find that same name, and no other spelling of it', async () => {
    const sandboxName = await nameInSandbox('Wolf');
    expect(benchFindings(`stats[${JSON.stringify(sandboxName)}]`)).toEqual([]);
    expect(benchFindings('stats["Wolf Power"]')).toHaveLength(1);
  });

  it('derives that name from the one exported producer', async () => {
    expect(statCodeName(CHIPPED, [beast, probe])).toBe(await nameInSandbox('Wolf'));
  });
});
