import { describe, expect, it } from 'vitest';
import type { Entity, Script, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import {
  editScripts, orderEdits, reorderWrites, scriptsByTiming, worldScriptEntries, worldScriptList, type ScriptEntry,
  type ScriptSlices, type ScriptTreeWorld,
} from './worldScripts';
import { patchScript, scriptsOf } from './scripts';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...extra });
const trait = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });
const s = (id: string, timing: Script['timing'], extra: Partial<Script> = {}): Script => ({ id, timing, code: `// ${id}`, ...extra });

const statBlueprints = { id: 'sbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;
const traitBlueprints = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as TraitGroup;

// One script on every home: the world, a global stat and trait, an entity's own stat and trait, a Blueprint
// stat and trait, and Bob's links that override each Blueprint's scripts. Ann links both and overrides nothing.
const health = stat('health', 'Health', { scripts: [s('h-after', 'after'), s('h-before', 'before')] });
const howl = stat('howl', 'Howl', { groupId: 'sbp', scripts: [s('howl-after', 'after')] });
const brave = trait('brave', 'Brave', { scripts: [s('brave-after', 'after')] });
const fury = trait('fury', 'Fury', { groupId: 'tbp', scripts: [s('fury-after', 'after')] });
const rage = stat('rage', 'Rage', { scripts: [s('rage-after', 'after')] });
const calm = trait('calm', 'Calm', { scripts: [s('calm-after', 'after')] });
const ann: Entity = {
  id: 'ann', name: 'Ann', stats: [rage], traits: [calm],
  statLinks: [{ id: 'ann-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null, order: 1 }],
  traitLinks: [{ id: 'ann-fury', originalId: 'fury', kind: 'trait', originalName: 'Fury', groupId: null }],
};
const bobHowl: Script[] = [s('howl-after', 'after', { code: '// bob howl' })];
const bobFury: Script[] = [s('fury-after', 'after', { code: '// bob fury' })];
const bob: Entity = {
  id: 'bob', name: 'Bob',
  statLinks: [{
    id: 'bob-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null, order: 0,
    overrides: { howl: { scripts: { value: bobHowl, blueprint: howl.scripts! } } },
  }],
  traitLinks: [{
    id: 'bob-fury', originalId: 'fury', kind: 'trait', originalName: 'Fury', groupId: null,
    overrides: { fury: { scripts: { value: bobFury, blueprint: fury.scripts! } } },
  }],
};
const world: ScriptTreeWorld = {
  scripts: [s('w-after', 'after'), s('w-start', 'start')],
  stats: [health, howl], statGroups: [statBlueprints],
  traits: [brave, fury], traitGroups: [traitBlueprints],
  entities: [ann, bob], placeholders: [],
};

/** Every script record the world stores, wherever its home keeps it. */
const stored = new Set([
  ...world.scripts!, ...world.stats.flatMap(scriptsOf), ...world.traits.flatMap(scriptsOf),
  ...world.entities.flatMap((entity) => [...(entity.stats ?? []), ...(entity.traits ?? [])].flatMap(scriptsOf)),
  ...bobHowl, ...bobFury,
]);

const ids = (entries: readonly ScriptEntry[]) => entries.map((entry) => `${entry.home.kind}:${entry.script.id}`);

describe('worldScriptList', () => {
  const keysOf = (rows: readonly { key: string }[]) => rows.map((row) => row.key).sort();

  it('lists the same scripts the Scripts tab lists', () => {
    expect(keysOf(worldScriptList(world, scriptsOf))).toEqual(keysOf(worldScriptEntries(world)));
  });

  it('files each script under the tab of its home', () => {
    expect(worldScriptList(world).map(({ box, section }) => `${box.home.kind}:${box.id}:${section}`)).toEqual([
      'world:w-after:scripts', 'world:w-start:scripts',
      'stat:h-after:stats', 'stat:h-before:stats', 'stat:howl-after:stats', 'entity:rage-after:entities', 'link:howl-after:entities',
      'trait:brave-after:traits', 'trait:fury-after:traits', 'entityTrait:calm-after:entities', 'traitLink:fury-after:entities',
    ]);
  });

  it('keeps a Blueprint’s one box, run by each owner whose link leaves its scripts alone', () => {
    const runsOf = (homeKind: string, id: string) => worldScriptList(world)
      .find(({ box }) => box.home.kind === homeKind && box.id === id)!.box.runs.map((run) => run.owner?.entity?.id);
    expect(runsOf('stat', 'howl-after')).toEqual(['ann']);
    expect(runsOf('trait', 'fury-after')).toEqual(['ann']);
  });

  it('skips a blank script unless the walk is widened', () => {
    const blank = { ...world, scripts: [s('w-blank', 'after', { code: '  ' })] };
    expect(worldScriptList(blank).some(({ box }) => box.id === 'w-blank')).toBe(false);
    expect(worldScriptList(blank, scriptsOf).some(({ box }) => box.id === 'w-blank')).toBe(true);
  });
});

describe('worldScriptEntries', () => {
  it('lists every script in owner order: world, global stats, global traits, each entity, then Blueprints', () => {
    expect(ids(scriptsByTiming(worldScriptEntries(world)).after)).toEqual([
      'world:w-after', 'stat:h-after', 'trait:brave-after',
      'entity:rage-after', 'entityTrait:calm-after',
      'link:howl-after', 'traitLink:fury-after',
      'stat:howl-after', 'trait:fury-after',
    ]);
  });

  it('lists an entity’s link scripts in its link tree’s order, as the runner reaches them', () => {
    const second = trait('second', 'Second', { groupId: 'tbp', scripts: [s('second-after', 'after')] });
    const override = (id: string, original: Trait, order: number) => ({
      id, originalId: original.id, kind: 'trait' as const, originalName: original.name, groupId: null, order,
      overrides: { [original.id]: { scripts: { value: original.scripts!, blueprint: original.scripts! } } },
    });
    // Stored Fury first, but placed second in the entity's tree.
    const cara: Entity = { id: 'cara', name: 'Cara', traitLinks: [override('cara-fury', fury, 1), override('cara-second', second, 0)] };
    const rows = scriptsByTiming(worldScriptEntries({ ...world, traits: [brave, fury, second], entities: [cara] })).after;
    expect(rows.filter((row) => row.entity?.id === 'cara').map((row) => row.script.id)).toEqual(['second-after', 'fury-after']);
  });

  it('lists global traits in the Traits tab’s order: a folder placed ahead of a root trait lists first', () => {
    const inner = trait('inner', 'Inner', { groupId: 'folder', scripts: [s('inner-after', 'after')] });
    const folder = { id: 'folder', name: 'Folder', parentId: null, order: 0 } as TraitGroup;
    const tree = { ...world, traits: [{ ...brave, order: 1 }, inner], traitGroups: [traitBlueprints, folder] };
    const rows = scriptsByTiming(worldScriptEntries(tree)).after.filter((row) => row.home.kind === 'trait');
    expect(rows.map((row) => row.script.id)).toEqual(['inner-after', 'brave-after']);
  });

  it('files each script under its own timing', () => {
    const byTiming = scriptsByTiming(worldScriptEntries(world));
    expect(ids(byTiming.before)).toEqual(['stat:h-before']);
    expect(ids(byTiming.start)).toEqual(['world:w-start']);
    expect(byTiming.output).toEqual([]);
    expect(byTiming.switch).toEqual([]);
  });

  it('hands the row the stored script itself, never its box', () => {
    const entries = worldScriptEntries(world);
    expect(entries).toHaveLength(11);
    for (const entry of entries) expect(stored.has(entry.script)).toBe(true);
  });

  it('lists a script with no code, which the runner skips but the author still edits', () => {
    const blank = { ...world, scripts: [s('w-blank', 'after', { code: '' })] };
    expect(ids(scriptsByTiming(worldScriptEntries(blank)).after)).toContain('world:w-blank');
  });

  it('runs ordered scripts first, ascending, as the runner does', () => {
    const ordered = { ...world, stats: [stat('health', 'Health', { scripts: [s('h-after', 'after', { order: 0 })] }), howl] };
    expect(ids(scriptsByTiming(worldScriptEntries(ordered)).after).slice(0, 2)).toEqual(['stat:h-after', 'world:w-after']);
  });

  it('labels a script by its name, or by its owner and timing', () => {
    const named = { ...world, scripts: [s('w-after', 'after', { name: 'Weather' })] };
    const [weather, healthAfter] = scriptsByTiming(worldScriptEntries(named)).after;
    expect(weather.label).toBe('Weather');
    expect(healthAfter.label).toBe('Health · After the AI');
  });

  it('gives each row a key no other row shares, a link’s copy of a Blueprint script included', () => {
    const keys = worldScriptEntries(world).map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('reorderWrites', () => {
  const after = scriptsByTiming(worldScriptEntries(world)).after;
  const key = (id: string, kind = 'stat') => after.find((entry) => entry.script.id === id && entry.home.kind === kind)!.key;

  it('numbers the timing in its new order and writes only the scripts whose order changed', () => {
    const writes = reorderWrites(after, key('brave-after', 'trait'), key('w-after', 'world'))!;
    expect(writes.map((w) => [`${w.entry.home.kind}:${w.entry.script.id}`, w.order])).toEqual([
      ['trait:brave-after', 0], ['world:w-after', 1], ['stat:h-after', 2], ['entity:rage-after', 3],
      ['entityTrait:calm-after', 4], ['link:howl-after', 5], ['traitLink:fury-after', 6], ['stat:howl-after', 7],
      ['trait:fury-after', 8],
    ]);
    const again = after.map((entry, i) => ({ ...entry, script: { ...entry.script, order: i } }));
    const swap = reorderWrites(again, again[1].key, again[2].key)!;
    expect(swap.map((w) => [w.entry.script.id, w.order])).toEqual([['brave-after', 1], ['h-after', 2]]);
  });

  it('moves a script to the top when it drops on its own timing', () => {
    const writes = reorderWrites(after, key('h-after'), 'top')!;
    expect(writes[0]).toMatchObject({ order: 0, entry: { script: { id: 'h-after' } } });
  });

  it('refuses a drop on a script of another timing', () => {
    const before = scriptsByTiming(worldScriptEntries(world)).before;
    expect(reorderWrites(after, key('h-after'), before[0].key)).toBeNull();
  });
});

describe('editScripts', () => {
  const entries = worldScriptEntries(world);
  const at = (kind: string, id: string) => entries.find((entry) => entry.home.kind === kind && entry.script.id === id)!;
  const code = (next: string) => (scripts: Script[]) => scripts.map((script) => ({ ...script, code: next }));

  it('writes each home where it lives, and only the slices it touched', () => {
    expect(editScripts(world, [{ home: at('world', 'w-after').home, edit: code('w') }])).toEqual({
      scripts: world.scripts!.map((script) => ({ ...script, code: 'w' })),
    });
    const stats = editScripts(world, [{ home: at('stat', 'howl-after').home, edit: code('x') }]);
    expect(Object.keys(stats)).toEqual(['stats']);
    expect(stats.stats![1].scripts).toEqual([{ ...howl.scripts![0], code: 'x' }]);
    const traits = editScripts(world, [{ home: at('trait', 'brave-after').home, edit: code('t') }]);
    expect(traits.traits![0].scripts![0].code).toBe('t');
  });

  it('writes an entity’s own stat and trait on the entity', () => {
    const next = editScripts(world, [
      { home: at('entity', 'rage-after').home, edit: code('r') },
      { home: at('entityTrait', 'calm-after').home, edit: code('c') },
    ]);
    expect(Object.keys(next)).toEqual(['entities']);
    expect(next.entities![0].stats![0].scripts![0].code).toBe('r');
    expect(next.entities![0].traits![0].scripts![0].code).toBe('c');
    expect(next.entities![1]).toBe(bob);
  });

  it('writes a link’s override and leaves the Blueprint and its snapshot alone', () => {
    const next = editScripts(world, [
      { home: at('link', 'howl-after').home, edit: code('l') },
      { home: at('traitLink', 'fury-after').home, edit: code('f') },
    ]);
    const [link] = next.entities![1].statLinks!;
    expect(link.overrides!.howl.scripts).toEqual({ value: [{ ...bobHowl[0], code: 'l' }], blueprint: howl.scripts });
    const [traitLink] = next.entities![1].traitLinks!;
    expect(traitLink.overrides!.fury.scripts).toEqual({ value: [{ ...bobFury[0], code: 'f' }], blueprint: fury.scripts });
    expect(next.stats).toBeUndefined();
  });

  it.each([
    ['a global stat', 'stat', 'h-after', (w: Partial<ScriptSlices>) => w.stats![0].scripts!],
    ['an entity stat', 'entity', 'rage-after', (w: Partial<ScriptSlices>) => w.entities![0].stats![0].scripts!],
    ['a trait', 'trait', 'brave-after', (w: Partial<ScriptSlices>) => w.traits![0].scripts!],
    ['a link override', 'link', 'howl-after', (w: Partial<ScriptSlices>) => w.entities![1].statLinks![0].overrides!.howl.scripts!.value],
    ['a world script', 'world', 'w-after', (w: Partial<ScriptSlices>) => w.scripts!],
  ])('merges a row’s patch on %s and writes nothing else into its home', (_kind, kind, id, listOf) => {
    const entry = at(kind, id);
    const was = entry.script;
    const next = editScripts(world, [{ home: entry.home, edit: (scripts) => patchScript(scripts, id, { code: 'return 7;', name: undefined }) }]);
    const list = listOf(next);
    const written = list.find((script) => script.id === id)!;
    expect(written).toStrictEqual({ id, timing: was.timing, code: 'return 7;' });
    expect(list).toHaveLength(listOf(editScripts(world, [{ home: entry.home, edit: (scripts) => scripts }])).length);
    for (const script of list) if (script.id !== id) expect(stored.has(script)).toBe(true);
  });

  it('drops an emptied stat or trait list, as the owner’s own Scripts section does', () => {
    const next = editScripts(world, [{ home: at('trait', 'brave-after').home, edit: () => [] }]);
    expect('scripts' in next.traits![0]).toBe(false);
  });
});

describe('orderEdits', () => {
  it('writes each moved script’s order on its home, one edit per home', () => {
    const after = scriptsByTiming(worldScriptEntries(world)).after;
    const writes = reorderWrites(after, after[1].key, after[0].key)!;
    const next = editScripts(world, orderEdits(writes));
    expect(next.scripts![0]).toMatchObject({ id: 'w-after', order: 1 });
    expect(next.scripts![1]).not.toHaveProperty('order');
    expect(next.stats![0].scripts).toEqual([{ ...health.scripts![0], order: 0 }, health.scripts![1]]);
    // The tree reads the new order back.
    const reread = scriptsByTiming(worldScriptEntries({ ...world, ...next })).after;
    expect(reread.slice(0, 2).map((entry) => entry.script.id)).toEqual(['h-after', 'w-after']);
  });
});
