import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup } from '@/types';
import { statUses } from './codeStatUses';
import type { CodeUse } from './codeUses';
import { statCodeOwners, type StatRouteWorld } from './statCodeTargets';
import { boxScripts } from '@/test/scriptFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', value: 0, min: 0, max: 100, ...extra } as Stat);

// The world has a Health, and Mara, who can be played, owns another. Bram owns a third. Howl is a Blueprint Mara
// links; Bram's link overrides its After box. Echo is a Blueprint nobody links.
const blueprints = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;
const worldHealth = stat('world-health', 'Health', {
  scripts: boxScripts({ after: [
    'stats.Health.value += 1;',
    'return stats["Health"].value + stats.Health.max;',
    'const m = entities.Mara.stats.Health.value + persona.stats.Health.value;',
  ].join('\n') }),
});
const alert = stat('alert', 'Alert', { scripts: boxScripts({ before: '// nothing here\nreturn entities["Mara"].stats[\'Health\'].value;' }) });
const maraHealth = stat('mara-health', 'Health', {
  scripts: boxScripts({ before: 'self.value = 1;\nowner.stats.Health.max = 50;\nstats.Health.value -= 1;' }),
});
const bramHealth = stat('bram-health', 'Health', { scripts: boxScripts({ after: 'return owner.stats.Health.value;' }) });
const howl = stat('howl', 'Howl', { groupId: 'bp', scripts: boxScripts({ after: 'return self.value;\nreturn owner.stats.Howl.value;' }) });
const echo = stat('echo', 'Echo', { groupId: 'bp', scripts: boxScripts({ before: 'self.value = 0;' }) });
const tide = stat('tide', 'Tide', { scripts: boxScripts({ after: 'return entities.Mara.stats.Howl.value + entities.Bram.stats.Howl.value;' }) });
const link = (id: string, code?: string) => ({
  id, originalId: 'howl', kind: 'stat' as const, originalName: 'Howl', groupId: null, order: 1,
  ...(code === undefined ? {} : { overrides: { howl: { scripts: { value: boxScripts({ after: code }), blueprint: howl.scripts ?? [] } } } }),
});
const mara: Entity = { id: 'mara', name: 'Mara', persona: true, stats: [maraHealth], statLinks: [link('l-mara')] };
const bram: Entity = { id: 'bram', name: 'Bram', stats: [bramHealth], statLinks: [link('l-bram', 'return self.max;')] };
const world: StatRouteWorld = {
  stats: [worldHealth, alert, howl, echo, tide], statGroups: [blueprints], entities: [mara, bram], placeholders: [],
};

const usesOf = (item: { statId: string; entityId?: string }, at: StatRouteWorld = world) => statUses(statCodeOwners(at), item);
/** Each row as its box and line read, for a compact comparison. */
const rows = (uses: CodeUse[]) => uses.map((use) => `${use.entity ? `${use.entity} › ` : ''}${use.name} ${use.timing} ${use.line}${use.noOwners ? ' no owners' : ''}`);

describe('statUses', () => {
  it('lists one row per box and line, so two spellings on one line join', () => {
    expect(rows(usesOf({ statId: 'world-health' }))).toEqual([
      'Health after 1',
      'Health after 2',
      'Mara › Health before 3',
    ]);
  });

  it('keeps two owners’ same-named stats apart and joins every route to one of them', () => {
    expect(rows(usesOf({ statId: 'mara-health', entityId: 'mara' }))).toEqual([
      'Health after 3',
      'Alert before 2',
      'Mara › Health before 1',
      'Mara › Health before 2',
    ]);
    expect(rows(usesOf({ statId: 'bram-health', entityId: 'bram' }))).toEqual(['Bram › Health after 1']);
  });

  it('counts a stat’s own self lines', () => {
    expect(usesOf({ statId: 'mara-health', entityId: 'mara' }).find((use) => use.line === 1 && use.entity)).toMatchObject({
      entityId: 'mara', rowId: 'mara-health', timing: 'before',
    });
  });

  it('lists a Blueprint box no owner runs, marked No Owners', () => {
    expect(rows(usesOf({ statId: 'echo' }))).toEqual(['Echo before 1 no owners']);
    expect(usesOf({ statId: 'echo' })[0]).toMatchObject({ entityId: null, rowId: 'echo' });
  });

  it('reads a Blueprint stat as every owner’s copy, and one owner’s copy as that owner’s alone', () => {
    expect(rows(usesOf({ statId: 'howl' }))).toEqual([
      'Tide after 1',
      'Howl after 1',
      'Howl after 2',
      'Bram › Howl after 1',
    ]);
    // Mara runs the Blueprint's box; Bram's Link overrides it, so only his own box reads his copy.
    expect(rows(usesOf({ statId: 'howl', entityId: 'mara' }))).toEqual(['Tide after 1', 'Howl after 1', 'Howl after 2']);
    expect(rows(usesOf({ statId: 'howl', entityId: 'bram' }))).toEqual(['Tide after 1', 'Bram › Howl after 1']);
  });

  it('opens a Link override box on the Link’s row', () => {
    expect(usesOf({ statId: 'howl', entityId: 'bram' }).at(-1)).toMatchObject({ entityId: 'bram', rowId: 'l-bram', timing: 'after' });
  });

  it('finds nothing for a stat no code names', () => {
    expect(usesOf({ statId: 'alert' })).toEqual([]);
  });

  it('lists a world script’s uses, where self is empty and names no stat', () => {
    const worldScripts = [{ id: 'weather', timing: 'after' as const, code: 'self.value = 1;\nstats.Alert.value = 2;' }];
    const uses = statUses(statCodeOwners(world), { statId: 'alert' }, { traits: [], traitGroups: [], worldScripts });
    expect(uses).toEqual([
      { entityId: null, rowId: 'weather', world: true, timing: 'after', scriptId: 'weather', name: 'World', line: 2, noOwners: false },
    ]);
  });

  it('lists a World Tool’s uses by its id and name, at the line, under the timing its script runs in', () => {
    const worldTools = [
      scriptWorldTool('travel-id', 'travel', 'const where = args.place;\nstats.Alert.value = 2;', 'after'),
      scriptWorldTool('filter-id', 'filter', 'stats.Alert.value = 1;', 'output'),
      scriptWorldTool('roll-id', 'roll', 'return stats.Alert.value;', 'call'),
      scriptWorldTool('other-id', 'other', 'return stats.Health.value;', 'after'),
    ];
    const uses = statUses(statCodeOwners(world), { statId: 'alert' }, { traits: [], traitGroups: [], worldTools });
    expect(uses).toEqual([
      { entityId: null, rowId: 'travel-id', tool: true, timing: 'after', scriptId: 'travel-id', name: 'travel', line: 2, noOwners: false },
      { entityId: null, rowId: 'filter-id', tool: true, timing: 'output', scriptId: 'filter-id', name: 'filter', line: 1, noOwners: false },
      { entityId: null, rowId: 'roll-id', tool: true, timing: 'before', scriptId: 'roll-id', name: 'roll', line: 1, noOwners: false },
    ]);
  });

  it('reads no code from a World Tool that is a lookup or a template', () => {
    const lookup = { ...scriptWorldTool('l', 'look', ''), handler: { kind: 'template' as const, body: 'stats.Alert.value' } };
    expect(statUses(statCodeOwners(world), { statId: 'alert' }, { traits: [], traitGroups: [], worldTools: [lookup] })).toEqual([]);
  });
});
