import { describe, it, expect } from 'vitest';
import type { ToolParam } from '@/types';
import { codeCompletions, codeDiagnostics } from '@/lib/statCodeAnalysis';
import { runToolScript } from './toolScript';
import { sampleToolSnapshot } from './toolSnapshot';
import { SCENE_MEMBERS, WORLD_MEMBERS, toolScriptSurface } from './toolScriptSurface';

const params: ToolParam[] = [
  { name: 'name', type: 'string', description: 'Who to find.', required: true, options: [] },
  { name: 'mood', type: 'enum', description: '', required: false, options: ['calm', 'angry'] },
  { name: 'place-name', type: 'number', description: '', required: true, options: [] },
];
const surface = toolScriptSurface(params);

function labelsAt(doc: string) {
  const pos = doc.indexOf('|');
  return (codeCompletions(doc.replace('|', ''), pos, { surface })?.options ?? []).map((option) => option.label);
}
const messages = (code: string) => codeDiagnostics(code, { surface }).map((d) => d.message);
const names = (entries: readonly { name: string }[]) => entries.map((e) => e.name).sort();

describe('the Tool script surface matches the sandbox', () => {
  const snapshot = sampleToolSnapshot();

  it('lists every global the script can reach, and each is really there', async () => {
    const globals = surface.globals.map((g) => g.name);
    expect(globals).toEqual(['args', 'world', 'scene', 'console']);
    const probe = `return [${globals.map((g) => `typeof ${g}`).join(', ')}];`;
    const result = await runToolScript(probe, { name: 'Wren' }, snapshot);
    expect(JSON.parse((result as { text: string }).text)).not.toContain('undefined');
  });

  it('lists exactly the world’s and the scene’s fields', () => {
    expect(names(WORLD_MEMBERS)).toEqual(Object.keys(snapshot.world).sort());
    expect(names(SCENE_MEMBERS)).toEqual(Object.keys(snapshot.scene).sort());
    expect(names(surface.members.get('scene.location')!)).toEqual(Object.keys(snapshot.scene.location!).sort());
    expect(names(surface.members.get('scene.time')!)).toEqual(Object.keys(snapshot.scene.time!).sort());
  });

  it('names each item’s fields as the world holds them', () => {
    const shape = (key: 'entities' | 'locations' | 'dictionary') =>
      WORLD_MEMBERS.find((m) => m.name === key)!.detail.replace(/[{}[\]\s]/g, '').split(',').sort();
    expect(shape('entities')).toEqual(Object.keys(snapshot.world.entities[0]).sort());
    expect(shape('locations')).toEqual(Object.keys(snapshot.world.locations[0]).sort());
    expect(shape('dictionary')).toEqual(Object.keys(snapshot.world.dictionary[0]).sort());
  });
});

describe('args', () => {
  it('offers each parameter with its type', () => {
    expect(labelsAt('return args.|')).toEqual(['name', 'mood', 'place-name']);
    const mood = surface.members.get('args')!.find((m) => m.name === 'mood')!;
    expect(mood.detail).toBe('"calm" | "angry"');
    expect(mood.info).toBe('What the AI passed. Absent when the AI leaves it out.');
    expect(surface.members.get('args')!.find((m) => m.name === 'place-name')!.detail).toBe('number');
  });

  it('follows the parameters as they change', () => {
    expect(toolScriptSurface([]).members.get('args')).toEqual([]);
    expect(toolScriptSurface([{ ...params[0], name: '' }]).members.get('args')).toEqual([]);
  });

  it('offers one Variable menu entry per parameter, bracketed where the name needs it', () => {
    expect(surface.snippets.slice(0, 3).map((s) => s.text)).toEqual(['args.name', 'args.mood', 'args["place-name"]']);
  });
});

describe('completions and diagnostics read the surface', () => {
  it('offers the world’s and the scene’s fields after a dot', () => {
    expect(labelsAt('return world.|')).toEqual(['entities', 'locations', 'dictionary']);
    expect(labelsAt('return scene.location.|')).toEqual(['id', 'name']);
  });

  it('flags stat-code names in the Tool script’s words', () => {
    expect(messages('return stats.Health;')).toEqual(['“stats” isn’t available in a Tool script.']);
  });

  it('accepts a script that reads its own names and warns when it returns nothing', () => {
    expect(messages('return world.entities.filter((e) => e.name === args.name);')).toEqual([]);
    expect(messages('const x = scene.notes;')).toEqual(['This script never returns, so the Tool sends its empty result.']);
  });
});
