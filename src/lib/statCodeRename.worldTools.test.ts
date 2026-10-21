/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity, Placeholder, PlayerStat, Tool } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { planCodeRename } from './statCodeRename';
import { type StatCodeWorld } from './statCodeTestRun';
import { tryWorldToolScript } from '@/lib/tools/worldToolTry';
import { withToolCode } from '@/lib/tools/worldTools';
import { scriptWorldTool } from '@/test/worldToolFixtures';

const gale = (name: string): PlayerStat => ({
  id: 'gale', name, type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [],
});
const storm = scriptWorldTool('storm-id', 'storm', 'stats.Gale.value = 3;');
const calm = scriptWorldTool('calm-id', 'calm', 'return 0;');

const worldOf = (stat: PlayerStat): StatCodeWorld => ({
  stats: [stat], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [],
  dictionaries: [], locations: [],
});

describe('a rename that a World Tool script names', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('rewrites the Tool’s script for a stat rename, and the Tool then still moves the renamed stat', async () => {
    const plan = planCodeRename({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stats: [gale('Gust')], worldTools: [storm, calm], otherNames: [], stat: { id: 'gale' },
    });
    expect(plan?.edits).toEqual([{ home: { kind: 'tool', toolId: 'storm-id' }, name: 'storm', scripts: { 'storm-id': 'stats.Gust.value = 3;' } }]);
    expect(plan?.references).toBe(1);

    const rewritten = withToolCode([storm, calm], plan!.edits[0].scripts);
    expect(rewritten.map((tool) => tool.handler.kind === 'script' && tool.handler.code)).toEqual(['stats.Gust.value = 3;', 'return 0;']);
    const world = worldOf(gale('Gust'));
    const moved = await tryWorldToolScript(rewritten[0], '{}', world);
    expect(moved.writes).toEqual(['stats.Gust.value = 3']);
    // Left as it was, the Tool names a stat that no longer exists.
    const stranded = await tryWorldToolScript(storm, '{}', world);
    expect(stranded.writes).toEqual([]);
  });

  it('keeps the Tool’s timing, Reply and Stack Calls when it rewrites the code', () => {
    const armed: Tool = { ...storm, handler: { kind: 'script', code: 'stats.Gale.value = 3;', timing: 'output', reply: 'Windy.', stack: true } };
    const [out] = withToolCode([armed], { 'storm-id': 'stats.Gust.value = 3;' });
    expect(out.handler).toEqual({ kind: 'script', code: 'stats.Gust.value = 3;', timing: 'output', reply: 'Windy.', stack: true });
  });

  it('carries a trait rename into a Tool, beside the world’s scripts', () => {
    const plan = planCodeRename({
      root: 'traits', oldName: 'Brave', newName: 'Bold', stats: [], traits: [], worldTools: [scriptWorldTool('t', 'dare', 'traits.Brave.enabled = true;')],
      otherNames: [],
    });
    expect(plan?.edits).toEqual([{ home: { kind: 'tool', toolId: 't' }, name: 'dare', scripts: { t: 'traits.Bold.enabled = true;' } }]);
  });

  it('carries a placeholder rename into a Tool’s placeholders path', () => {
    const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm']) };
    const plan = planCodeRename({
      root: 'placeholders', oldName: 'Mood', newName: 'Temper', stats: [], otherNames: [], subject: { kind: 'placeholder', id: 'mood' },
      placeholders: { list: [{ ...mood, name: 'Temper' }] }, worldTools: [scriptWorldTool('t', 'dare', `placeholders.Mood.pin('wary');`)],
    });
    expect(plan?.edits).toEqual([{ home: { kind: 'tool', toolId: 't' }, name: 'dare', scripts: { t: `placeholders.Temper.pin('wary');` } }]);
  });

  it('carries an entity rename into a Tool’s entities key, beside its placeholder path', () => {
    const hair: Placeholder = { id: 'h1', name: 'Hair', values: phValues(['red']) };
    const mira: Entity = { id: 'mira', name: 'Mira' };
    const plan = planCodeRename({
      root: 'placeholders', oldName: 'Mira', newName: 'Old Mira', stats: [], otherNames: [], subject: { kind: 'entity', id: 'mira' },
      placeholders: { list: [hair], owners: new Map([['h1', { kind: 'entity', id: 'mira', name: 'Mira' }]]) }, entities: [mira],
      worldTools: [scriptWorldTool('t', 'greet', `memories.add(entities.Mira.name + entities.Mira.placeholders.Hair.text);`)],
    });
    expect(plan?.edits[0]).toEqual({
      home: { kind: 'tool', toolId: 't' }, name: 'greet',
      scripts: { t: `memories.add(entities['Old Mira'].name + entities['Old Mira'].placeholders.Hair.text);` },
    });
  });

  it('leaves a lookup or template Tool alone', () => {
    const template: Tool = { ...storm, handler: { kind: 'template', body: 'stats.Gale.value' } };
    expect(planCodeRename({
      root: 'stats', oldName: 'Gale', newName: 'Gust', stats: [gale('Gust')], worldTools: [template], otherNames: [], stat: { id: 'gale' },
    })).toBeNull();
  });
});
