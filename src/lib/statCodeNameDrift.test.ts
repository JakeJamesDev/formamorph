/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlayerStat, Trait, WorldOverview } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { statCodeCompletions, statCodeDiagnostics } from './statCodeAnalysis';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { placeholderPathAt, placeholderPathLabel, placeholderPathMap } from './statCodePaths';
import type { PlaceholderOwners } from './placeholderHomes';
import { checkStatCode } from './testBench/statCodeCheck';
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
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  const pin = out.pinWrites['ph-probe'];
  return typeof pin === 'string' || pin === null ? pin : pin.join(', ');
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

/**
 * A trait's name carries chips the same way a stat's does, and the same four surfaces name it. The sandbox's
 * own keys are read back through a pin, and the completions, the editor's checks and the bench are held to
 * them.
 */
const fury: Trait = { id: 'fury', name: '{{ph:ph-beast:world:p1}} Fury', statChanges: [] };

/** The names the sandbox itself keys `traits` on, read back through a pin, under one playthrough's roll. */
async function traitNamesInSandbox(rolled: string): Promise<string> {
  const reader = stat({ id: 's1', name: 'Reader', code: 'placeholders.Probe.pin(Object.keys(traits).join("|"));' });
  const out = await runStatCodeTurn({
    stats: [reader],
    enabled: {},
    previous: [reader],
    asks: [],
    regenApplied: {},
    clock: {},
    traits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [fury], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  return String(out.pinWrites['ph-probe']);
}

/** The unknown-name findings the bench raises for one piece of code that switches a trait by name. */
function benchTraitFindings(lookup: string): Promise<string[]> {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: 'Mana', code: `${lookup}.enabled = true;` })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [], traits: [fury], statUpdates: [], dictionaries: [], placeholders: [beast],
  };
  return checkStatCode(world).then((found) => found.map((f) => f.message));
}

describe('one trait code name across the sandbox, the completions, the editor and the bench', () => {
  it('gives the sandbox the same trait name whatever the playthrough rolled', async () => {
    expect(await traitNamesInSandbox('Wolf')).toBe(await traitNamesInSandbox('Bear'));
  });

  it('offers that same name in the completions, and never the rolled text', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf');
    const traitNames = statCodeNamed([fury], [beast, probe]).map((entry) => entry.name);
    const code = 'traits[""].enabled = true;';
    const caret = code.indexOf('""') + 1;
    const offered = statCodeCompletions(code, caret, { traits: traitNames })?.options.map((option) => option.label);
    expect(offered).toContain(sandboxName);
    expect(offered).not.toContain('Wolf Fury');
    expect(offered).not.toContain(fury.name);
  });

  it('lets the editor check that same name, and underline no other spelling of it', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf');
    const traits = statCodeNamed([fury], [beast, probe]).map((entry) => entry.name);
    const check = (lookup: string) =>
      statCodeDiagnostics(`traits[${JSON.stringify(lookup)}].enabled = true;`, { traits }).map((d) => d.message);
    expect(check(sandboxName)).toEqual([]);
    expect(check('Wolf Fury')).toHaveLength(1);
  });

  it('lets the bench find that same name, and no other spelling of it', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf');
    expect(await benchTraitFindings(`traits[${JSON.stringify(sandboxName)}]`)).toEqual([]);
    expect(await benchTraitFindings('traits["Wolf Fury"]')).toHaveLength(1);
  });

  it('derives that name from the one exported producer', async () => {
    expect(statCodeName(fury.name, [beast, probe])).toBe(await traitNamesInSandbox('Wolf'));
  });
});

/**
 * A placeholder is reached by the path the editor shows, and four surfaces have to spell that path the same
 * way: the sandbox builds the map from it, the completions offer it, the editor checks it, and the bench
 * reports what a write missed by it. The sandbox's own keys are read back through a pin; the rest are held
 * to them.
 */
const mollyHair: Placeholder = { id: 'molly-hair', name: 'Hair', values: phValues(['{{ph:shade:world:p-shade}}']) };
const shade: Placeholder = { id: 'shade', name: 'Shade', values: phValues(['ash', 'jet']), ownerId: 'molly-hair' };
const worldHair: Placeholder = { id: 'world-hair', name: 'Hair', values: phValues(['plain']) };
const scoped = [worldHair, probe, mollyHair, shade];
const molly: Entity = { id: 'e-molly', name: 'Molly', placeholders: [mollyHair, shade] };
const owners: PlaceholderOwners = new Map([
  ['molly-hair', { kind: 'entity', id: 'e-molly', name: 'Molly' }],
  ['shade', { kind: 'entity', id: 'e-molly', name: 'Molly' }],
]);

/** One stat's `code` run over the scoped fixture, and the pins it left, by placeholder id. */
async function runScoped(code: string): Promise<Record<string, string | string[] | null>> {
  const only = stat({ id: 's1', name: 'Reader', code });
  const out = await runStatCodeTurn({
    stats: [only],
    enabled: {},
    previous: [only],
    asks: [],
    regenApplied: {},
    clock: {},
    traits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: scoped, owners, rolls: { world: {} } },
  });
  return out.pinWrites;
}

/** The keys the sandbox itself builds, read back through a pin: the top level, then Molly's own. */
async function pathKeysInSandbox(): Promise<string> {
  const pins = await runScoped(
    'placeholders.Probe.pin(Object.keys(placeholders).join("|") + "/" + Object.keys(placeholders.Molly).join("|"));',
  );
  return String(pins['ph-probe']);
}

/** The unknown-name findings the bench raises for one piece of code that writes a placeholder by path. */
function benchPathFindings(lookup: string): Promise<string[]> {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: 'Mana', code: `${lookup}.pin("x");` })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [molly], traits: [], statUpdates: [], dictionaries: [], placeholders: [worldHair, probe],
  };
  return checkStatCode(world).then((found) => found.map((f) => f.message));
}

describe('one placeholder path across the sandbox, the completions, the editor and the bench', () => {
  it('keys the sandbox by the owner node and its placeholders, the world’s own row beside them', async () => {
    // The world's Hair wins the bare name; Molly's is reached through her node, which lists only what she owns.
    expect(await pathKeysInSandbox()).toBe('Hair|Probe|Molly|Shade/Hair');
  });

  it('offers those same keys in the completions, at the top level and under the owner node', async () => {
    const top = (await pathKeysInSandbox()).split('/')[0].split('|');
    const options = { placeholders: { list: scoped, owners } };
    const offered = statCodeCompletions('return placeholders.', 'return placeholders.'.length, options)
      ?.options.map((option) => option.label) ?? [];
    for (const key of top) expect(offered).toContain(key);
    // The exact path leads, because `Hair` alone reaches only one of the two.
    expect(offered[0]).toBe('Molly.Hair');
    const under = 'return placeholders.Molly.';
    expect(statCodeCompletions(under, under.length, options)?.options.map((option) => option.label)).toEqual(['Hair']);
  });

  it('lets the editor check that same path, and underline no other spelling of it', () => {
    const options = { placeholders: { list: scoped, owners } };
    const check = (lookup: string) => statCodeDiagnostics(`${lookup}.pin("x");`, options).map((d) => d.message);
    expect(check('placeholders.Molly.Hair.Shade')).toEqual([]);
    expect(check('placeholders.Molly.Shade')).toHaveLength(1);
  });

  it('lets the bench find that same path, and report the one no entry answers', async () => {
    expect(await benchPathFindings('placeholders.Molly.Hair.Shade')).toEqual([]);
    const [missed] = await benchPathFindings('placeholders.Molly.Hiar');
    expect(missed).toContain('Molly › Hiar');
  });

  it('lands a pin through the path on the child alone, by its id', async () => {
    expect(await runScoped('placeholders.Molly.Hair.Shade.pin("silver");')).toEqual({ shade: 'silver' });
  });

  it('derives every one of those names from the one exported resolver', async () => {
    const map = placeholderPathMap({ list: scoped, owners });
    const top = (await pathKeysInSandbox()).split('/')[0].split('|');
    expect([...map.keys.keys()]).toEqual(top);
    expect(placeholderPathLabel(placeholderPathAt(map, ['Molly', 'Hair', 'Shade'])!.path)).toBe('Molly › Hair › Shade');
  });
});
