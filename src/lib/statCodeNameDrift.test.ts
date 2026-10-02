/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect } from 'vitest';
import type { Entity, Placeholder, PlayerStat, Trait, WorldOverview } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { statCodeCompletions, statCodeDiagnostics } from './statCodeAnalysis';
import { statCodeName, statCodeNamed } from './statCodeNames';
import { placeholderPathLabel, placeholderPathMap, walkPlaceholderPath } from './statCodePaths';
import type { PlaceholderOwners } from './placeholderHomes';
import { checkStatCode } from './testBench/statCodeCheck';
import { runStatCodeTurn } from './statCodeTurn';
import { entityTraitNames } from './statCodeTraits';
import { STAT_CODE_TIMINGS, type StatCodeTiming } from './statCodeTiming';
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

/** One piece of code in one of the stat's two boxes. Both boxes read the same surface and the same names,
 *  so each case that runs code runs in both: a guard that only ever watched the after box would let the
 *  other drift. */
const inBox = (timing: StatCodeTiming, code: string): Partial<PlayerStat> =>
  (timing === 'before' ? { beforeCode: code } : { code });

/** The name the sandbox itself hands `self.name`, read back through a pin, under one playthrough's roll. */
async function nameInSandbox(rolled: string, timing: StatCodeTiming): Promise<string | null> {
  const subject = stat({ id: 's1', name: CHIPPED, ...inBox(timing, 'placeholders.Probe.pin(self.name);') });
  const out = await runStatCodeTurn({
    timing,
    stats: [subject],
    enabled: {},
    previous: [subject],
    asks: [],
    regenApplied: {},
    clock: {},
    bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  const pin = out.pinWrites['ph-probe'];
  return typeof pin === 'string' || pin === null ? pin : pin.join(', ');
}

/** The unknown-stat findings a world raises for one piece of code that looks a stat up by name. */
function benchFindings(lookup: string, timing: StatCodeTiming): string[] {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [
      stat({ id: 's1', name: CHIPPED }),
      stat({ id: 's2', name: 'Mana', ...inBox(timing, `return ${lookup}.value;`) }),
    ],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [beast],
  };
  return runRules(world).filter((f) => f.ruleId === 'stat-code-unknown-stat').map((f) => f.message);
}

describe.each(STAT_CODE_TIMINGS)('one code name across the sandbox, the completions, and the bench (%s box)', (timing) => {
  it('gives the sandbox the same name whatever the playthrough rolled', async () => {
    // The acceptance case: two saves, two different rolls, one name in code.
    expect(await nameInSandbox('Wolf', timing)).toBe(await nameInSandbox('Bear', timing));
  });

  it('offers that same name in the completions, and never the rolled text', async () => {
    const sandboxName = await nameInSandbox('Wolf', timing);
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
    const sandboxName = await nameInSandbox('Wolf', timing);
    expect(benchFindings(`stats[${JSON.stringify(sandboxName)}]`, timing)).toEqual([]);
    expect(benchFindings('stats["Wolf Power"]', timing)).toHaveLength(1);
  });

  it('derives that name from the one exported producer', async () => {
    expect(statCodeName(CHIPPED, [beast, probe])).toBe(await nameInSandbox('Wolf', timing));
  });
});

/**
 * A trait's name carries chips the same way a stat's does, and the same four surfaces name it. The sandbox's
 * own keys are read back through a pin, and the completions, the editor's checks and the bench are held to
 * them.
 */
const fury: Trait = { id: 'fury', name: '{{ph:ph-beast:world:p1}} Fury', statChanges: [] };

/** The names the sandbox itself keys `traits` on, read back through a pin, under one playthrough's roll. */
async function traitNamesInSandbox(rolled: string, timing: StatCodeTiming): Promise<string> {
  const reader = stat({
    id: 's1', name: 'Reader', ...inBox(timing, 'placeholders.Probe.pin(Object.keys(traits).join("|"));'),
  });
  const out = await runStatCodeTurn({
    timing,
    stats: [reader],
    enabled: {},
    previous: [reader],
    asks: [],
    regenApplied: {},
    clock: {},
    bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [fury], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  return String(out.pinWrites['ph-probe']);
}

/** The unknown-name findings the bench raises for one piece of code that switches a trait by name. */
function benchTraitFindings(lookup: string, timing: StatCodeTiming): Promise<string[]> {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: 'Mana', ...inBox(timing, `${lookup}.enabled = true;`) })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [], traits: [fury], statUpdates: [], dictionaries: [], placeholders: [beast],
  };
  return checkStatCode(world).then((found) => found.map((f) => f.message));
}

describe.each(STAT_CODE_TIMINGS)('one trait code name across the sandbox, the completions, the editor and the bench (%s box)', (timing) => {
  it('gives the sandbox the same trait name whatever the playthrough rolled', async () => {
    expect(await traitNamesInSandbox('Wolf', timing)).toBe(await traitNamesInSandbox('Bear', timing));
  });

  it('offers that same name in the completions, and never the rolled text', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf', timing);
    const traitNames = statCodeNamed([fury], [beast, probe]).map((entry) => entry.name);
    const code = 'traits[""].enabled = true;';
    const caret = code.indexOf('""') + 1;
    const offered = statCodeCompletions(code, caret, { traits: traitNames })?.options.map((option) => option.label);
    expect(offered).toContain(sandboxName);
    expect(offered).not.toContain('Wolf Fury');
    expect(offered).not.toContain(fury.name);
  });

  it('lets the editor check that same name, and underline no other spelling of it', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf', timing);
    const traits = statCodeNamed([fury], [beast, probe]).map((entry) => entry.name);
    const check = (lookup: string) =>
      statCodeDiagnostics(`traits[${JSON.stringify(lookup)}].enabled = true;`, { traits }).map((d) => d.message);
    expect(check(sandboxName)).toEqual([]);
    expect(check('Wolf Fury')).toHaveLength(1);
  });

  it('lets the bench find that same name, and no other spelling of it', async () => {
    const sandboxName = await traitNamesInSandbox('Wolf', timing);
    expect(await benchTraitFindings(`traits[${JSON.stringify(sandboxName)}]`, timing)).toEqual([]);
    expect(await benchTraitFindings('traits["Wolf Fury"]', timing)).toHaveLength(1);
  });

  it('derives that name from the one exported producer', async () => {
    expect(statCodeName(fury.name, [beast, probe])).toBe(await traitNamesInSandbox('Wolf', timing));
  });
});

/**
 * An entity's name carries chips the same way, and the sandbox, the completions and the editor's checks have
 * to spell it alike. Two entities share one code name, so the later one's key is the one all three agree on.
 */
const rider: Entity = { id: 'e-rider', name: '{{ph:ph-beast:world:p1}} Rider', traits: [{ ...fury, id: 'rider-fury', name: 'Fury' }] };
const lateRider: Entity = { id: 'e-rider-2', name: '{{ph:ph-beast:world:p1}} Rider', traits: [{ ...fury, id: 'late-fury', name: 'Calm' }] };

/** The keys the sandbox gives `entities`, and the trait keys under the shared name, read back through a pin. */
async function entityKeysInSandbox(rolled: string, timing: StatCodeTiming): Promise<string> {
  const reader = stat({
    id: 's1', name: 'Reader',
    ...inBox(timing, 'placeholders.Probe.pin(Object.keys(entities).map((n) => n + ":" + Object.keys(entities[n].traits)).join("|"));'),
  });
  const entities = [rider, lateRider];
  const out = await runStatCodeTurn({
    timing,
    stats: [reader],
    enabled: {},
    previous: [reader],
    asks: [],
    regenApplied: {},
    clock: {},
    bearers: {
      acquired: [], disabledTraitIds: [], appliedValues: {}, entities,
      world: {
        traits: [], groups: [], entities, persona: { source: 'none' },
        bearers: entities.map((e) => ({ id: e.id, name: e.name, traits: e.traits ?? [], groups: [] })),
      },
    },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: [beast, probe], rolls: { world: { 'ph-beast': rolled } } },
  });
  return String(out.pinWrites['ph-probe']);
}

describe.each(STAT_CODE_TIMINGS)('one entity code name across the sandbox, the completions and the editor (%s box)', (timing) => {
  const editorEntities = entityTraitNames({ traits: [], traitGroups: [], entities: [rider, lateRider] }, [beast, probe]);

  it('keys the sandbox on the code name whatever the playthrough rolled, the later entity winning', async () => {
    const keys = await entityKeysInSandbox('Wolf', timing);
    expect(keys).toBe(await entityKeysInSandbox('Bear', timing));
    expect(keys).toBe('Beast Rider:Calm');
  });

  it('offers that same name and the winner’s traits in the completions', () => {
    const code = 'entities[""]';
    const offered = statCodeCompletions(code, code.indexOf('""') + 1, { entities: editorEntities })?.options.map((o) => o.label);
    expect(offered).toEqual(['Beast Rider']);
    const dotted = "entities['Beast Rider'].traits.";
    const traits = statCodeCompletions(dotted, dotted.length, { entities: editorEntities })?.options.map((o) => o.label);
    expect(traits).toEqual(['Calm']);
  });

  it('warns on the shared name in the editor, and underlines the rolled spelling', () => {
    const check = (lookup: string) =>
      statCodeDiagnostics(`return entities[${JSON.stringify(lookup)}].name;`, { entities: editorEntities }).map((d) => d.message);
    expect(check('Beast Rider')).toEqual(['2 entities are named “Beast Rider”. This reads the last one authored.']);
    expect(check('Wolf Rider')).toEqual([expect.stringContaining('Unknown entity name “Wolf Rider”')]);
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
/** What the editor knows of the cast: Molly, with no traits. */
const editorOptions = { placeholders: { list: scoped, owners }, entities: [{ id: 'e-molly', name: 'Molly', traits: [], persona: false }] };

/** One stat's `code` run over the scoped fixture, with Molly in the cast, and the pins it left, by placeholder id. */
async function runScoped(code: string, timing: StatCodeTiming): Promise<Record<string, string | string[] | null>> {
  const only = stat({ id: 's1', name: 'Reader', ...inBox(timing, code) });
  const out = await runStatCodeTurn({
    timing,
    stats: [only],
    enabled: {},
    previous: [only],
    asks: [],
    regenApplied: {},
    clock: {},
    bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, entities: [molly], world: { traits: [], groups: [] } },
    statNameOf: (stat) => stat.name,
    traitNameOf: (trait) => trait.name,
    placeholders: { placeholders: scoped, owners, rolls: { world: {} } },
  });
  return out.pinWrites;
}

/** The keys the sandbox itself builds, read back through a pin: the top level, then Molly's own. */
async function pathKeysInSandbox(timing: StatCodeTiming): Promise<string> {
  const pins = await runScoped(
    'placeholders.Probe.pin(Object.keys(placeholders).join("|") + "/" + Object.keys(entities.Molly.placeholders).join("|"));',
    timing,
  );
  return String(pins['ph-probe']);
}

/** The unknown-name findings the bench raises for one piece of code that writes a placeholder by path. */
function benchPathFindings(lookup: string, timing: StatCodeTiming): Promise<string[]> {
  const world: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: 'Mana', ...inBox(timing, `${lookup}.pin("x");`) })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [molly], traits: [], statUpdates: [], dictionaries: [], placeholders: [worldHair, probe],
  };
  return checkStatCode(world).then((found) => found.map((f) => f.message));
}

describe.each(STAT_CODE_TIMINGS)('one placeholder path across the sandbox, the completions, the editor and the bench (%s box)', (timing) => {
  it('keys the sandbox by the world’s own rows, and Molly’s entry by what she owns', async () => {
    expect(await pathKeysInSandbox(timing)).toBe('Hair|Probe/Hair');
  });

  it('offers those same keys in the completions, at the top level and under Molly’s entry', async () => {
    const [top, own] = (await pathKeysInSandbox(timing)).split('/').map((keys) => keys.split('|'));
    const offered = (doc: string) => statCodeCompletions(doc, doc.length, editorOptions)?.options.map((option) => option.label) ?? [];
    expect(offered('return placeholders.')).toEqual(top);
    expect(offered('return entities.Molly.placeholders.')).toEqual(own);
  });

  it('lets the bench find that same path, and report the one no entry answers', async () => {
    expect(await benchPathFindings('entities.Molly.placeholders.Hair.Shade', timing)).toEqual([]);
    const [missed] = await benchPathFindings('entities.Molly.placeholders.Hiar', timing);
    expect(missed).toContain('Molly › Hiar');
  });

  it('lands a pin through the path on the child alone, by its id', async () => {
    expect(await runScoped('entities.Molly.placeholders.Hair.Shade.pin("silver");', timing)).toEqual({ shade: 'silver' });
  });

  it('derives every one of those names from the one exported resolver', async () => {
    const map = placeholderPathMap({ list: scoped, owners });
    const [top] = (await pathKeysInSandbox(timing)).split('/').map((keys) => keys.split('|'));
    expect([...map.keys.keys()]).toEqual(top);
    const { node } = walkPlaceholderPath(map, ['Hair', 'Shade'], map.owners.get('e-molly') ?? null);
    expect(placeholderPathLabel(node!.path)).toBe('Molly › Hair › Shade');
  });
});

/** The editor's own reader over the scoped fixture, which is timing-blind: one box's text is all it sees. */
describe('the editor reads a placeholder path the way the sandbox keys it', () => {
  it('checks that same path, and underlines no other spelling of it', () => {
    const check = (lookup: string) => statCodeDiagnostics(`${lookup}.pin("x");`, editorOptions).map((d) => d.message);
    expect(check('entities.Molly.placeholders.Hair.Shade')).toEqual([]);
    expect(check('entities.Molly.placeholders.Shade')).toHaveLength(1);
    expect(check('placeholders.Molly.Hair.Shade')).toHaveLength(1);
  });
});

/**
 * One stat holding code in both boxes at once.
 *
 * The cases above fill one box at a time, so each proves its own box in isolation. This one proves the two
 * do not read each other: a fixture with a different miss in each box gets both reported, named apart, and
 * a run of one box reaches only that box's text.
 */
describe('a stat with code in both boxes', () => {
  const twoBoxes: RuleWorld = {
    worldOverview: { name: 'Drift', description: '', systemPrompt: 'Narrate.', readme: 'A primer.' } as WorldOverview,
    stats: [stat({ id: 's1', name: CHIPPED }), stat({
      id: 's2',
      name: 'Mana',
      beforeCode: 'return stats["Wolf Power"].value;',
      code: 'return stats["Bear Power"].value;',
    })],
    locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
    entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [beast],
  };

  it('reports each box’s own miss under that box’s name', () => {
    const found = runRules(twoBoxes).filter((f) => f.ruleId === 'stat-code-unknown-stat').map((f) => f.message);
    expect(found).toEqual([
      'Before the AI code on “Mana” looks up a stat named “Wolf Power”, which does not exist',
      'After the AI code on “Mana” looks up a stat named “Bear Power”, which does not exist',
    ]);
  });

  it('runs only the box the turn asked for, whatever the other box holds', async () => {
    const both = stat({
      id: 's1',
      name: 'Reader',
      beforeCode: 'placeholders.Probe.pin("before");',
      code: 'placeholders.Probe.pin("after");',
    });
    const pinFrom = async (timing: StatCodeTiming) => {
      const out = await runStatCodeTurn({
        timing,
        stats: [both],
        enabled: {},
        previous: [both],
        asks: [],
        regenApplied: {},
        clock: {},
        bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
        statNameOf: (entry) => entry.name,
        traitNameOf: (entry) => entry.name,
        placeholders: { placeholders: [probe], rolls: { world: {} } },
      });
      return out.pinWrites['ph-probe'];
    };
    expect(await pinFrom('before')).toBe('before');
    expect(await pinFrom('after')).toBe('after');
  });
});

/** Two dictionaries share one code name, so a lookup reads the later one and the editor says so. */
describe('two dictionaries sharing a code name', () => {
  const dictionaries = [{ id: 'd1', name: 'Weather' }, { id: 'd2', name: 'Weather' }, { id: 'd3', name: 'Tides' }];
  const check = (code: string) => statCodeDiagnostics(code, { placeholders: { list: [], dictionaries } }).map((d) => d.message);
  const warning = '2 dictionaries are named “Weather”. This reads the last one authored.';

  it('warns on the entry itself', () => {
    expect(check("return dictionaries['Weather'].name;")).toEqual([warning]);
  });

  it('warns once on a placeholder path through the entry', () => {
    expect(check('return dictionaries.Weather.placeholders.Sky.value;')).toContain(warning);
  });

  it('stays quiet for a name one dictionary owns', () => {
    expect(check("return dictionaries['Tides'].name;")).toEqual([]);
  });
});

describe('two entities sharing a code name under a placeholder path', () => {
  it('warns on the path through the entry', () => {
    const entities = [{ id: 'a', name: 'Mira', persona: false, traits: [] }, { id: 'b', name: 'Mira', persona: false, traits: [] }];
    const found = statCodeDiagnostics('return entities.Mira.placeholders.Sky.value;', { entities, placeholders: { list: [] } }).map((d) => d.message);
    expect(found).toContain('2 entities are named “Mira”. This reads the last one authored.');
  });
});

describe.each(STAT_CODE_TIMINGS)('one dictionary code name across the sandbox, the completions and the editor (%s box)', (timing) => {
  const books = [{ id: 'd1', name: '{{ph:ph-beast:world:p1}} Lore' }, { id: 'd2', name: '{{ph:ph-beast:world:p1}} Lore' }];

  async function keysInSandbox(rolled: string): Promise<string> {
    const reader = stat({ id: 's1', name: 'Reader', ...inBox(timing, 'placeholders.Probe.pin(Object.keys(dictionaries).join("|"));') });
    const out = await runStatCodeTurn({
      timing, stats: [reader], enabled: {}, previous: [reader], asks: [], regenApplied: {}, clock: {},
      bearers: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [] } },
      statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
      placeholders: { placeholders: [beast, probe], dictionaries: books, rolls: { world: { 'ph-beast': rolled } } },
    });
    return String(out.pinWrites['ph-probe']);
  }

  it('keys the sandbox on the code name whatever the playthrough rolled', async () => {
    expect(await keysInSandbox('Wolf')).toBe(await keysInSandbox('Bear'));
    expect(await keysInSandbox('Wolf')).toBe('Beast Lore');
  });

  it('offers that name once, and warns on the shared one', () => {
    const named = books.map((b) => ({ id: b.id, name: statCodeName(b.name, [beast, probe]) }));
    const code = 'dictionaries[""]';
    const offered = statCodeCompletions(code, code.indexOf('""') + 1, { placeholders: { list: [beast, probe], dictionaries: named } })
      ?.options.map((o) => o.label);
    expect(offered).toEqual(['Beast Lore']);
    const found = statCodeDiagnostics("return dictionaries['Beast Lore'].name;", { placeholders: { list: [beast, probe], dictionaries: named } })
      .map((d) => d.message);
    expect(found).toEqual(['2 dictionaries are named “Beast Lore”. This reads the last one authored.']);
  });
});
